import OpenAI from "openai";
// import fs from "fs";
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

export async function runAgentLoop(
  params: AgentLoopParams,
): Promise<ChatCompletionMessageParam[]> {
  await new Promise((r) => setTimeout(r, 1000));

  // local llm
  const client = new OpenAI({
    apiKey: params.openRouterApiKey,
    //    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
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
  const maxIterations = 25;
  let iteration = 0;

  while (continueLoop && iteration < maxIterations) {
    iteration++;

    params.onStream({ type: "status", status: "thinking" });

    /*
    fs.writeFileSync(
      `/home/nagmani/root/temp/messages${iteration}.json`,
      JSON.stringify(messages, null, 2),
    );
    */

    let response;

    while (true) {
      try {
        response = await client.chat.completions.create({
          model: "gpt-4o-mini",
          max_completion_tokens: 8096,
          messages,
          tools: toolDefinitions as OpenAI.ChatCompletionTool[],
        });
        break;
      } catch (err) {
        console.log("error", err);
        await new Promise((r) => setTimeout(r, 1500));
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
