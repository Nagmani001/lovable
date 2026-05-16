import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import type { ChatCompletionMessageParam } from "@repo/orchestrator/types";

// Convert OpenAI-format chat history into LangChain BaseMessages.
// We accept both string content and OpenAI's content-part arrays for user msgs.
export function toLangChainMessages(
  history: ChatCompletionMessageParam[],
): BaseMessage[] {
  const out: BaseMessage[] = [];
  for (const msg of history) {
    if (msg.role === "system") {
      out.push(new SystemMessage({ content: stringify(msg.content) }));
    } else if (msg.role === "user") {
      out.push(new HumanMessage({ content: stringify(msg.content) }));
    } else if (msg.role === "assistant") {
      const tcs = (msg as { tool_calls?: unknown }).tool_calls as
        | Array<{
            id: string;
            function: { name: string; arguments: string };
          }>
        | undefined;
      out.push(
        new AIMessage({
          content: stringify(msg.content),
          tool_calls: tcs?.map((tc) => ({
            id: tc.id,
            name: tc.function.name,
            args: safeParse(tc.function.arguments),
          })),
        }),
      );
    } else if (msg.role === "tool") {
      out.push(
        new ToolMessage({
          content: stringify(msg.content),
          tool_call_id: (msg as { tool_call_id: string }).tool_call_id,
        }),
      );
    }
  }
  return out;
}

// Convert LangChain BaseMessages back to OpenAI chat-completion format so the
// caller (which persists history in OpenAI shape) stays unchanged.
export function fromLangChainMessages(
  msgs: BaseMessage[],
): ChatCompletionMessageParam[] {
  const out: ChatCompletionMessageParam[] = [];
  for (const m of msgs) {
    const t = m.getType();
    const content =
      typeof m.content === "string" ? m.content : stringify(m.content);
    if (t === "system") {
      out.push({ role: "system", content });
    } else if (t === "human") {
      out.push({ role: "user", content });
    } else if (t === "ai") {
      const ai = m as AIMessage;
      const toolCalls = ai.tool_calls ?? [];
      out.push({
        role: "assistant",
        content: content || null,
        ...(toolCalls.length > 0 && {
          tool_calls: toolCalls.map((tc, i) => ({
            id: tc.id ?? `call_${i}`,
            type: "function" as const,
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.args ?? {}),
            },
          })),
        }),
      });
    } else if (t === "tool") {
      const tm = m as ToolMessage;
      out.push({
        role: "tool",
        tool_call_id: tm.tool_call_id,
        content,
      });
    }
  }
  return out;
}

function stringify(c: unknown): string {
  if (typeof c === "string") return c;
  if (c == null) return "";
  return JSON.stringify(c);
}

function safeParse(s: string): Record<string, unknown> {
  try {
    return JSON.parse(s) as Record<string, unknown>;
  } catch {
    return {};
  }
}
