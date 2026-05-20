import { SystemMessage } from "@langchain/core/messages";
import type { StreamChunk } from "@repo/common/types";
import type { ContextManager } from "@repo/orchestrator/context";
import { ToolExecutor } from "@repo/orchestrator/tools";
import type { ChatCompletionMessageParam } from "@repo/orchestrator/types";
import type { Sandbox } from "e2b";
import { buildLangChainTools, loadSystemPrompt } from "../tools/buildTools.js";
import { buildFailoverModel } from "./failoverModel.js";
import { buildAgentGraph, GRAPH_RECURSION_LIMIT } from "./graph.js";
import { fromLangChainMessages, toLangChainMessages } from "./messageBridge.js";

export interface RunLoopParams {
  apiKeys: string[];
  messages: ChatCompletionMessageParam[];
  sandbox: Sandbox;
  projectBasePath: string;
  onStream: (chunk: StreamChunk) => void;
  consoleLogs?: string[];
  networkRequests?: string[];
  contextManager: ContextManager;
  // Used for TCC tracing: projectId doubles as the chat session id, userId
  // becomes filterable metadata on every run.
  projectId: string;
  userId?: string;
}

export async function runAgentLoopLG(
  params: RunLoopParams,
): Promise<ChatCompletionMessageParam[] | undefined> {
  await new Promise((r) => setTimeout(r, 1000));

  const model = buildFailoverModel({
    apiKeys: params.apiKeys,
    //    model: "gemini-3-flash-preview",
    model: "gemini-3.1-flash-lite",
    maxOutputTokens: 8096,
    maxRetries: 0,
  });

  const executor = new ToolExecutor(
    params.sandbox,
    params.projectBasePath,
    params.contextManager,
  );
  if (params.consoleLogs) executor.storeConsoleLogs(params.consoleLogs);
  if (params.networkRequests)
    executor.storeNetworkRequests(params.networkRequests);

  const tools = buildLangChainTools(executor, params.onStream);

  const graph = buildAgentGraph({
    model,
    tools,
    sandbox: params.sandbox,
    projectBasePath: params.projectBasePath,
    contextManager: params.contextManager,
    onStream: params.onStream,
  });

  const systemPrompt = loadSystemPrompt();
  const inputMessages = [
    new SystemMessage({ content: systemPrompt }),
    ...toLangChainMessages(params.messages),
  ];

  try {
    const finalState = (await graph.invoke(
      { messages: inputMessages, fixupAttempt: 0 },
      {
        recursionLimit: GRAPH_RECURSION_LIMIT,
        metadata: {
          projectId: params.projectId,
          userId: params.userId ?? "anonymous",
          environment: process.env.NODE_ENV ?? "development",
          // Groups every turn of the same chat thread into one TCC session.
          tcc: { sessionId: params.projectId },
        },
      },
    )) as { messages: import("@langchain/core/messages").BaseMessage[] };

    const all = fromLangChainMessages(finalState.messages);
    return all.filter((m) => m.role !== "system");
  } catch (err) {
    console.error("[runLoop] agent loop failed:", err);
  }
}
