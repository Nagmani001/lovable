import type { StreamChunk } from "@repo/common/types";
import type { Sandbox } from "e2b";
import type { ChatCompletionMessageParam } from "../types/index.js";
import { ContextManager } from "../context/context-manager.js";
import { classifyIntent } from "../context/intent-classifier.js";
import { runAgentLoop } from "../agent/loop.js";

interface LlmManagerConfig {
  openRouterApiKey: string;
  projectBasePath: string;
}

interface RunProjectAgentParams {
  messages: ChatCompletionMessageParam[];
  sandbox: Sandbox;
  onStream: (chunk: StreamChunk) => void;
  consoleLogs?: string[];
  networkRequests?: string[];
  contextManager?: ContextManager;
}

interface HandleUserMessageParams {
  projectId: string;
  message: string;
  conversationHistory: ChatCompletionMessageParam[];
  sandbox: Sandbox;
  onStream: (chunk: StreamChunk) => void;
  consoleLogs?: string[];
  networkRequests?: string[];
}

export class LlmManager {
  private openRouterApiKey: string;
  private projectBasePath: string;
  private contextManagers: Map<string, ContextManager> = new Map();

  constructor(config: LlmManagerConfig) {
    this.openRouterApiKey = config.openRouterApiKey;
    this.projectBasePath = config.projectBasePath;
  }

  async runProjectAgent(
    params: RunProjectAgentParams,
  ): Promise<ChatCompletionMessageParam[]> {
    return runAgentLoop({
      openRouterApiKey: this.openRouterApiKey,
      messages: params.messages,
      sandbox: params.sandbox,
      projectBasePath: this.projectBasePath,
      onStream: params.onStream,
      consoleLogs: params.consoleLogs,
      networkRequests: params.networkRequests,
      contextManager: params.contextManager,
    });
  }

  async handleUserMessage(
    params: HandleUserMessageParams,
  ): Promise<ChatCompletionMessageParam[]> {
    let contextManager = this.contextManagers.get(params.projectId);
    if (!contextManager) {
      contextManager = ContextManager.createFromBaseline();
      this.contextManagers.set(params.projectId, contextManager);
    }

    // The router saves the current user message before this method is called.
    // First turn is detected by the absence of any assistant message in history.
    const isFirstTurn = !params.conversationHistory.some(
      (m) => m.role === "assistant",
    );
    const usefulContext = isFirstTurn
      ? contextManager.generateInitializationContext()
      : contextManager.generateContext(
          classifyIntent(params.message),
          params.message,
        );

    const lastUserIdx = params.conversationHistory.reduce(
      (acc, msg, idx) => (msg.role === "user" ? idx : acc),
      -1,
    );

    const llmMessages: ChatCompletionMessageParam[] =
      params.conversationHistory.map((msg, idx) => {
        if (idx !== lastUserIdx) return msg;

        if (typeof msg.content === "string") {
          return { ...msg, content: `${usefulContext}\n\n${msg.content}` };
        }

        if (Array.isArray(msg.content)) {
          const content = [
            { type: "text", text: `${usefulContext}\n\n` },
            ...msg.content,
          ] as Array<
            | { type: "text"; text: string }
            | { type: "image_url"; image_url: { url: string } }
          >;
          return { ...msg, content } as ChatCompletionMessageParam;
        }

        return msg;
      });

    const updatedMessages = await this.runProjectAgent({
      messages: llmMessages,
      sandbox: params.sandbox,
      onStream: params.onStream,
      consoleLogs: params.consoleLogs,
      networkRequests: params.networkRequests,
      contextManager,
    });

    const newMessages = updatedMessages.slice(
      params.conversationHistory.length,
    );
    return [...params.conversationHistory, ...newMessages];
  }
}
