import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { StreamChunk } from "@repo/common/types";
import { ToolExecutor } from "../tools/executor.js";

const GEMINI_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai/";
const MODEL = "gemini-3-flash-preview";
const MAX_COMPLETION_TOKENS = 8096;

function createLlmClient(apiKey: string): OpenAI {
  return new OpenAI({
    apiKey,
    baseURL: GEMINI_BASE_URL,
  });
}

export interface LlmClientRotation {
  keys: string[];
  currentKeyIndex: number;
  client: OpenAI;
  rotate: () => OpenAI;
}

export function createLlmClientRotation(
  apiKeyString: string,
): LlmClientRotation {
  const keys = apiKeyString
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);

  if (keys.length === 0) {
    throw new Error("No LLM API keys configured");
  }

  const rotation: LlmClientRotation = {
    keys,
    currentKeyIndex: 0,
    client: createLlmClient(keys[0]!),
    rotate: () => {
      rotation.currentKeyIndex =
        (rotation.currentKeyIndex + 1) % rotation.keys.length;
      rotation.client = createLlmClient(
        rotation.keys[rotation.currentKeyIndex]!,
      );
      return rotation.client;
    },
  };

  return rotation;
}

export async function callLLMWithRetry(
  rotation: LlmClientRotation,
  messages: ChatCompletionMessageParam[],
  toolDefinitions?: OpenAI.ChatCompletionTool[],
  logPrefix = "",
  model: string = MODEL,
): Promise<OpenAI.ChatCompletion> {
  let retryCount = 0;
  while (true) {
    try {
      const response = await rotation.client.chat.completions.create({
        model,
        max_completion_tokens: MAX_COMPLETION_TOKENS,
        messages,
        ...(toolDefinitions && toolDefinitions.length > 0
          ? { tools: toolDefinitions }
          : {}),
      });
      return response;
    } catch (err: any) {
      if (err?.status === 429) {
        const delay = Math.min(1500 * Math.pow(2, retryCount), 60000);
        rotation.rotate();
        console.log(
          `${logPrefix}Rate limited (429), rotated to key ${rotation.currentKeyIndex + 1}/${rotation.keys.length}, retrying in ${delay}ms... (attempt ${retryCount + 1})`,
        );
        retryCount++;
        await new Promise((r) => setTimeout(r, delay));
      } else {
        console.log(`${logPrefix}error`, err);
        throw err;
      }
    }
  }
}

export interface MiniLoopResult {
  finished: boolean;
}

export async function runSingleLLMTurn(opts: {
  rotation: LlmClientRotation;
  messages: ChatCompletionMessageParam[];
  toolDefinitions: OpenAI.ChatCompletionTool[];
  toolExecutor: ToolExecutor;
  onStream: (chunk: StreamChunk) => void;
  statusWhileWorking: StreamChunk["status"];
  logPrefix?: string;
}): Promise<{ finished: boolean }> {
  const {
    rotation,
    messages,
    toolDefinitions,
    toolExecutor,
    onStream,
    statusWhileWorking,
    logPrefix = "",
  } = opts;

  const response = await callLLMWithRetry(
    rotation,
    messages,
    toolDefinitions,
    logPrefix,
  );

  const choice = response.choices[0];
  if (!choice) {
    return { finished: true };
  }

  const assistantMessage = choice.message;
  messages.push(assistantMessage);

  if (assistantMessage.content) {
    onStream({ type: "text", content: assistantMessage.content });
  }

  const toolCalls = assistantMessage.tool_calls;

  if (toolCalls && toolCalls.length > 0) {
    onStream({ type: "status", status: statusWhileWorking });

    for (const toolCall of toolCalls) {
      const args = JSON.parse(toolCall.function.arguments) as Record<
        string,
        unknown
      >;
      const result = await toolExecutor.execute(
        toolCall.function.name,
        args,
        onStream,
      );

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: result,
      });
    }
  }

  const noToolCalls = !toolCalls || toolCalls.length === 0;
  const finished =
    noToolCalls || (choice.finish_reason === "stop" && noToolCalls);

  return { finished };
}

export async function runMiniAgentLoop(opts: {
  rotation: LlmClientRotation;
  messages: ChatCompletionMessageParam[];
  toolDefinitions: OpenAI.ChatCompletionTool[];
  toolExecutor: ToolExecutor;
  onStream: (chunk: StreamChunk) => void;
  statusWhileWorking: StreamChunk["status"];
  maxSteps: number;
  logPrefix?: string;
}): Promise<void> {
  const { maxSteps, ...turnOpts } = opts;

  for (let step = 0; step < maxSteps; step++) {
    const { finished } = await runSingleLLMTurn(turnOpts);
    if (finished) break;
  }
}
