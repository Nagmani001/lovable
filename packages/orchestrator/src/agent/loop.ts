import OpenAI from "openai";
// import fs from "fs";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { StreamChunk } from "@repo/common/types";
import { ToolExecutor } from "../tools/executor.js";
import { loadSystemPrompt, loadToolDefinitions } from "../tools/converter.js";
import type { ContextManager } from "../context/context-manager.js";
import { runBuildCheck, runTypeCheck } from "./checkCodeUtils.js";
import { filterErrorsByFiles } from "./parserUtils.js";
import { runSingleLLMTurn, runMiniAgentLoop } from "./llm-utils.js";

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

  const typedToolDefs = toolDefinitions as OpenAI.ChatCompletionTool[];

  // ── Main coding loop ──────────────────────────────────────────────────
  let iteration = 0;

  while (iteration < MAX_BUILD_ITERATIONS) {
    iteration++;

    params.onStream({ type: "status", status: "thinking" });

    /*
    fs.writeFileSync(
      `/home/nagmani/root/temp/messages${iteration}.json`,
      JSON.stringify(messages, null, 2),
    );
    */

    const { finished } = await runSingleLLMTurn({
      client,
      messages,
      toolDefinitions: typedToolDefs,
      toolExecutor,
      onStream: params.onStream,
      statusWhileWorking: "writing",
    });

    if (finished) break;
  }

  // ── TypeScript fix-up loop ────────────────────────────────────────────
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

        await runMiniAgentLoop({
          client,
          messages,
          toolDefinitions: typedToolDefs,
          toolExecutor,
          onStream: params.onStream,
          statusWhileWorking: "fixing",
          maxSteps: 10,
          logPrefix: "[fixup] ",
        });

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

    // ── Build check loop ──────────────────────────────────────────────────
    const modifiedFilesForBuild = params.contextManager.getModifiedFiles();

    if (modifiedFilesForBuild.length > 0) {
      params.onStream({ type: "status", status: "fixing" });
      console.log("[fixup] Running build check...");

      const buildErrors = await runBuildCheck(
        params.sandbox,
        params.projectBasePath,
      );

      if (buildErrors) {
        console.log("[fixup] Build failed. Asking AI to fix...");

        // Build a context with the build errors
        const buildContext = params.contextManager.generateTypeCheckContext(
          buildErrors,
          modifiedFilesForBuild,
        );

        messages.push({
          role: "user",
          content: `${buildContext}\n\nThe project build (vite build) failed with the errors shown above. Please fix ALL errors using lov-line-replace or lov-write. Do NOT explain anything — just fix the code.`,
        });

        await runMiniAgentLoop({
          client,
          messages,
          toolDefinitions: typedToolDefs,
          toolExecutor,
          onStream: params.onStream,
          statusWhileWorking: "fixing",
          maxSteps: 10,
          logPrefix: "[fixup] ",
        });
      } else {
        console.log("[fixup] Build succeeded. ✓");
      }
    }
  }

  if (iteration >= MAX_BUILD_ITERATIONS) {
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
