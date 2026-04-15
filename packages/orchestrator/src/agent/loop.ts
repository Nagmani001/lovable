import OpenAI from "openai";
import fs from "fs";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { StreamChunk } from "@repo/common/types";
import { ToolExecutor } from "../tools/executor.js";
import { loadSystemPrompt, loadToolDefinitions } from "../tools/converter.js";
import type { ContextManager } from "../context/context-manager.js";

interface AgentLoopParams {
  openRouterApiKey: string;
  messages: ChatCompletionMessageParam[];
  sandbox: import("e2b").Sandbox;
  projectBasePath: string;
  onStream: (chunk: StreamChunk) => void;
  consoleLogs?: string[];
  networkRequests?: string[];
  contextManager?: ContextManager;
}

const MAX_BUILD_ITERATIONS = 25;

const MAX_FIXUP_ITERATIONS = 3;

function filterErrorsByFiles(
  tscOutput: string,
  modifiedFiles: string[],
): { filteredErrors: string; errorFiles: string[] } {
  if (!tscOutput || !tscOutput.trim()) {
    return { filteredErrors: "", errorFiles: [] };
  }

  const lines = tscOutput.split("\n");
  const matchedLines: string[] = [];
  const errorFileSet = new Set<string>();

  for (const line of lines) {
    // tsc error format: path(line,col): error TSxxxx: message
    const match = line.match(/^(.+?)\(\d+,\d+\):\s*error\s+TS\d+:/);
    if (!match) continue;

    const errorPath = match[1]!.trim();

    // Check if this file path matches any modified file
    for (const modFile of modifiedFiles) {
      if (
        errorPath === modFile ||
        errorPath.endsWith(`/${modFile}`) ||
        modFile.endsWith(`/${errorPath}`) ||
        errorPath.endsWith(modFile)
      ) {
        matchedLines.push(line);
        errorFileSet.add(modFile);
        break;
      }
    }
  }

  return {
    filteredErrors: matchedLines.join("\n"),
    errorFiles: [...errorFileSet],
  };
}

async function runTypeCheck(
  sandbox: import("e2b").Sandbox,
  projectBasePath: string,
): Promise<string> {
  const result = await sandbox.commands.run(
    `cd ${projectBasePath} && npx tsc --noEmit 2>&1`,
    { timeoutMs: 60_000 },
  );
  return result.stdout || "";
}

export async function runAgentLoop(
  params: AgentLoopParams,
): Promise<ChatCompletionMessageParam[]> {
  await new Promise((r) => setTimeout(r, 1000));

  // local llm
  const client = new OpenAI({
    apiKey: params.openRouterApiKey,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    // baseURL: "https://openrouter.ai/api/v1",
  });

  const systemPrompt = loadSystemPrompt();
  const toolDefinitions = loadToolDefinitions();
  const toolExecutor = new ToolExecutor(
    params.sandbox,
    params.projectBasePath,
    params.contextManager,
  );

  // Store any console logs or network requests the frontend sent
  if (params.consoleLogs) {
    toolExecutor.storeConsoleLogs(params.consoleLogs);
  }
  if (params.networkRequests) {
    toolExecutor.storeNetworkRequests(params.networkRequests);
  }

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...params.messages,
  ];

  let continueLoop = true;
  const maxIterations = MAX_BUILD_ITERATIONS;
  let iteration = 0;

  while (continueLoop && iteration < maxIterations) {
    iteration++;

    params.onStream({ type: "status", status: "thinking" });

    fs.writeFileSync(
      `/home/nagmani/root/temp/messages${iteration}.json`,
      JSON.stringify(messages, null, 2),
    );

    let response;

    {
      let retryCount = 0;
      while (true) {
        try {
          response = await client.chat.completions.create({
            //          model: "gpt-4o-mini",
            //          model: "gemini-2.5-flash-lite",
            model: "gemini-2.5-flash",
            max_completion_tokens: 8096,
            messages,
            tools: toolDefinitions as OpenAI.ChatCompletionTool[],
          });
          break;
        } catch (err: any) {
          if (err?.status === 429) {
            const delay = Math.min(1500 * Math.pow(2, retryCount), 60000);
            console.log(
              `Rate limited (429), retrying in ${delay}ms... (attempt ${retryCount + 1})`,
            );
            retryCount++;
            await new Promise((r) => setTimeout(r, delay));
          } else {
            console.log("error", err);
            throw err;
          }
        }
      }
    }

    const choice = response!.choices[0];
    if (!choice) {
      continueLoop = false;
      break;
    }

    const assistantMessage = choice.message;

    // Add assistant message to history
    messages.push(assistantMessage);

    // Stream text content if present
    if (assistantMessage.content) {
      params.onStream({ type: "text", content: assistantMessage.content });
    }

    // Process tool calls if present
    const toolCalls = assistantMessage.tool_calls;

    if (toolCalls && toolCalls.length > 0) {
      params.onStream({ type: "status", status: "writing" });

      // Execute each tool call and add results as separate tool messages
      for (const toolCall of toolCalls) {
        const args = JSON.parse(toolCall.function.arguments) as Record<
          string,
          unknown
        >;
        const result = await toolExecutor.execute(
          toolCall.function.name,
          args,
          params.onStream,
        );

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: result,
        });
      }
    } else {
      // No tool calls - the LLM is done
      continueLoop = false;
    }

    // Also stop if the API says we're done
    if (
      choice.finish_reason === "stop" &&
      (!toolCalls || toolCalls.length === 0)
    ) {
      continueLoop = false;
    }
  }

  if (params.contextManager) {
    const modifiedFiles = params.contextManager.getModifiedFiles();

    if (modifiedFiles.length > 0) {
      let fixupIteration = 0;

      while (fixupIteration < MAX_FIXUP_ITERATIONS) {
        params.onStream({ type: "status", status: "fixing" });
        console.log(
          `[fixup] Running TypeScript check (attempt ${fixupIteration + 1}/${MAX_FIXUP_ITERATIONS})...`,
        );

        const tscOutput = await runTypeCheck(
          params.sandbox,
          params.projectBasePath,
        );
        const { filteredErrors, errorFiles } = filterErrorsByFiles(
          tscOutput,
          modifiedFiles,
        );

        if (!filteredErrors) {
          console.log("[fixup] No TypeScript errors in modified files. ✓");
          break;
        }

        console.log(
          `[fixup] Found errors in ${errorFiles.length} file(s). Asking AI to fix...`,
        );

        // Build the fix-up context and inject as a user message
        const fixupContext = params.contextManager.generateTypeCheckContext(
          filteredErrors,
          errorFiles,
        );

        messages.push({
          role: "user",
          content: `${fixupContext}\n\nThe TypeScript compiler found errors in files you modified. Please fix ALL errors using lov-line-replace or lov-write. Do NOT explain anything — just fix the code.`,
        });

        // Run a mini agent loop for the fix-up
        let fixupDone = false;
        let fixupSteps = 0;
        const maxFixupSteps = 10; // Safety cap per fix-up iteration

        while (!fixupDone && fixupSteps < maxFixupSteps) {
          fixupSteps++;

          let fixupResponse;
          {
            let retryCount = 0;
            while (true) {
              try {
                fixupResponse = await client.chat.completions.create({
                  model: "gemini-2.5-flash",
                  max_completion_tokens: 8096,
                  messages,
                  tools: toolDefinitions as OpenAI.ChatCompletionTool[],
                });
                break;
              } catch (err: any) {
                if (err?.status === 429) {
                  const delay = Math.min(1500 * Math.pow(2, retryCount), 60000);
                  console.log(
                    `[fixup] Rate limited (429), retrying in ${delay}ms...`,
                  );
                  retryCount++;
                  await new Promise((r) => setTimeout(r, delay));
                } else {
                  console.log("[fixup] error", err);
                  throw err;
                }
              }
            }
          }

          const fixupChoice = fixupResponse!.choices[0];
          if (!fixupChoice) {
            fixupDone = true;
            break;
          }

          const fixupAssistantMsg = fixupChoice.message;
          messages.push(fixupAssistantMsg);

          if (fixupAssistantMsg.content) {
            params.onStream({
              type: "text",
              content: fixupAssistantMsg.content,
            });
          }

          const fixupToolCalls = fixupAssistantMsg.tool_calls;

          if (fixupToolCalls && fixupToolCalls.length > 0) {
            params.onStream({ type: "status", status: "fixing" });

            for (const toolCall of fixupToolCalls) {
              const args = JSON.parse(toolCall.function.arguments) as Record<
                string,
                unknown
              >;
              const result = await toolExecutor.execute(
                toolCall.function.name,
                args,
                params.onStream,
              );

              messages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                content: result,
              });
            }
          } else {
            // AI finished fixing (no more tool calls)
            fixupDone = true;
          }

          if (
            fixupChoice.finish_reason === "stop" &&
            (!fixupToolCalls || fixupToolCalls.length === 0)
          ) {
            fixupDone = true;
          }
        }

        fixupIteration++;
      }

      if (fixupIteration >= MAX_FIXUP_ITERATIONS) {
        console.log(
          `[fixup] Reached max fix-up iterations (${MAX_FIXUP_ITERATIONS}). Some errors may remain.`,
        );
        params.onStream({
          type: "text",
          content:
            "\n\n(Some TypeScript errors may remain after automatic fix-up attempts.)",
        });
      }
    }
  }

  if (iteration >= maxIterations) {
    params.onStream({
      type: "text",
      content:
        "\n\n(Reached maximum iteration limit. Please continue with another message.)",
    });
  }

  params.onStream({ type: "status", status: "done" });

  // Return messages without the system prompt (caller doesn't need it)
  return messages.slice(1);
}
