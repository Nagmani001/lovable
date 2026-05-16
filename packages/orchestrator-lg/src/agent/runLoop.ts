import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { SystemMessage } from "@langchain/core/messages";
import type { StreamChunk } from "@repo/common/types";
import type { ContextManager } from "@repo/orchestrator/context";
import { ToolExecutor } from "@repo/orchestrator/tools";
import type { ChatCompletionMessageParam } from "@repo/orchestrator/types";
import type { Sandbox } from "e2b";
import { buildLangChainTools, loadSystemPrompt } from "../tools/buildTools.js";
import { buildAgentGraph, GRAPH_RECURSION_LIMIT } from "./graph.js";
import { fromLangChainMessages, toLangChainMessages } from "./messageBridge.js";

export interface RunLoopParams {
  apiKey: string;
  messages: ChatCompletionMessageParam[];
  sandbox: Sandbox;
  projectBasePath: string;
  onStream: (chunk: StreamChunk) => void;
  consoleLogs?: string[];
  networkRequests?: string[];
  contextManager: ContextManager;
}

export async function runAgentLoopLG(
  params: RunLoopParams,
): Promise<ChatCompletionMessageParam[] | undefined> {
  await new Promise((r) => setTimeout(r, 1000));

  const model = new ChatGoogleGenerativeAI({
    apiKey: params.apiKey,
    model: "gemini-3-flash-preview",
    maxOutputTokens: 8096,
    maxRetries: 5,
    streaming: false,
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
      { recursionLimit: GRAPH_RECURSION_LIMIT },
    )) as { messages: import("@langchain/core/messages").BaseMessage[] };

    const all = fromLangChainMessages(finalState.messages);
    return all.filter((m) => m.role !== "system");
  } catch (err) {
    console.log("error occured in run agent loop");
  }
}
