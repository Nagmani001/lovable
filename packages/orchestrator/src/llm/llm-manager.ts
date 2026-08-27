import type { StreamChunk } from "@repo/common/types";
import type { Sandbox } from "e2b";
import type { ChatCompletionMessageParam } from "../types/index.js";
import { ContextManager } from "../context/context-manager.js";
import { classifyIntent } from "../context/intent-classifier.js";
import { runAgentLoop } from "../agent/loop.js";
import {
  callLLMWithRetry,
  createLlmClientRotation,
} from "../agent/llm-utils.js";

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

interface PrettifyPromptParams {
  conversationHistory: ChatCompletionMessageParam[];
  message: string;
}

const PRETTIFY_SYSTEM_PROMPT = `You are a prompt-enhancement assistant for an AI app builder. A user will share a raw prompt describing an app or interface they want to build, along with the surrounding conversation for context. Rewrite their latest prompt into a clear, detailed, well-structured version that keeps their original intent.

Rules:
- Stay faithful to the user's intent. Do not invent features or requirements they did not imply.
- Be specific: capture the key features, structure, and visual expectations hinted at in the raw prompt.
- Use clean, natural language; short paragraphs or bullet points are fine where they improve readability.
- Do not mention "the prompt", "you", or any conversational framing.
- Respond with ONLY the prettified prompt. No preamble, no explanations, no quotes, no markdown code fences.`;

const MAX_PRETTIFY_HISTORY_MESSAGES = 10;

const PRETTIFY_MODEL = "gemini-3-flash-preview";

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

  async prettifyPrompt(params: PrettifyPromptParams): Promise<string> {
    const rotation = createLlmClientRotation(this.openRouterApiKey);

    const contextMessages = params.conversationHistory.slice(
      -MAX_PRETTIFY_HISTORY_MESSAGES,
    );

    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: PRETTIFY_SYSTEM_PROMPT },
      ...contextMessages,
      {
        role: "user",
        content: `Here is the prompt to prettify:\n\n${params.message}`,
      },
    ];

    const response = await callLLMWithRetry(
      rotation,
      messages,
      [],
      "[prettify] ",
      PRETTIFY_MODEL,
    );

    const prettified = response.choices[0]?.message?.content?.trim();
    if (!prettified) {
      return params.message;
    }

    return prettified;
  }
}
