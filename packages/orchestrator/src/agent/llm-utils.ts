import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { StreamChunk } from "@repo/common/types";
import { ToolExecutor } from "../tools/executor.js";

/**
 * Calls the LLM with exponential backoff on 429 rate-limit errors.
 */
export async function callLLMWithRetry(
  client: OpenAI,
  messages: ChatCompletionMessageParam[],
  toolDefinitions: OpenAI.ChatCompletionTool[],
  logPrefix = "",
): Promise<OpenAI.ChatCompletion> {
  let retryCount = 0;
  while (true) {
    try {
      const response = await client.chat.completions.create({
        model: "gemini-3-flash-preview",
        max_completion_tokens: 8096,
        messages,
        tools: toolDefinitions,
      });
      return response;
    } catch (err: any) {
      if (err?.status === 429) {
        const delay = Math.min(1500 * Math.pow(2, retryCount), 60000);
        console.log(
          `${logPrefix}Rate limited (429), retrying in ${delay}ms... (attempt ${retryCount + 1})`,
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
  /** Whether the LLM finished (no more tool calls) */
  finished: boolean;
}

/**
 * Runs a single LLM turn: calls the model, streams output, executes any
 * tool calls, and pushes all messages onto the conversation history.
 *
 * Returns whether the LLM finished (no more tool calls).
 */
export async function runSingleLLMTurn(opts: {
  client: OpenAI;
  messages: ChatCompletionMessageParam[];
  toolDefinitions: OpenAI.ChatCompletionTool[];
  toolExecutor: ToolExecutor;
  onStream: (chunk: StreamChunk) => void;
  statusWhileWorking: StreamChunk["status"];
  logPrefix?: string;
}): Promise<{ finished: boolean }> {
  const {
    client,
    messages,
    toolDefinitions,
    toolExecutor,
    onStream,
    statusWhileWorking,
    logPrefix = "",
  } = opts;

  const response = await callLLMWithRetry(
    client,
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

  // Stream text content if present
  if (assistantMessage.content) {
    onStream({ type: "text", content: assistantMessage.content });
  }

  // Process tool calls if present
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

  // Determine if we should stop
  const noToolCalls = !toolCalls || toolCalls.length === 0;
  const finished =
    noToolCalls || (choice.finish_reason === "stop" && noToolCalls);

  return { finished };
}

/**
 * Runs a mini agent loop: repeatedly calls the LLM and executes tool calls
 * until the model stops producing tool calls or we hit the step cap.
 */
export async function runMiniAgentLoop(opts: {
  client: OpenAI;
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
