import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import type { StructuredToolInterface } from "@langchain/core/tools";
import type { BaseMessage, AIMessage } from "@langchain/core/messages";

export interface FailoverModelOptions {
  apiKeys: string[];
  model: string;
  maxOutputTokens: number;
  maxRetries: number;
}

/**
 * Returns true when an error is a provider rate-limit / quota-exhausted error
 * (HTTP 429 or Gemini "resource exhausted"). Only these trigger key rotation;
 * every other error is rethrown immediately.
 */
function isRateLimitError(err: unknown): boolean {
  const e = err as { status?: number; code?: number; message?: string };
  if (e?.status === 429 || e?.code === 429) return true;
  const msg = (e?.message || String(err)).toLowerCase();
  return (
    msg.includes("429") ||
    msg.includes("too many requests") ||
    msg.includes("resource has been exhausted") ||
    msg.includes("resource_exhausted") ||
    msg.includes("quota") ||
    msg.includes("rate limit")
  );
}

/**
 * Dump every field that could tell us what kind of error we actually got.
 * Goal: confirm we ONLY ever see rate-limit (429) errors; anything else
 * shows up here with full detail so we can classify it.
 */
function describeError(err: unknown): Record<string, unknown> {
  const e = err as Record<string, unknown> & {
    response?: { status?: number; data?: unknown };
    cause?: unknown;
  };
  return {
    name: e?.name,
    message: e?.message,
    status: e?.status,
    code: e?.code,
    errorCode: (e as { error?: { code?: unknown } })?.error?.code,
    type: e?.constructor?.name,
    httpStatus: e?.response?.status,
    responseData: e?.response?.data,
    cause:
      e?.cause instanceof Error
        ? { name: e.cause.name, message: e.cause.message }
        : e?.cause,
    isRateLimit: isRateLimitError(err),
  };
}

/**
 * Round-robin Gemini model over multiple API keys.
 *
 * On a rate-limit error it advances to the next key and retries the SAME
 * request. The index is sticky — once it moves to a working key it stays
 * there for all subsequent calls. When every key is rate-limited the last
 * error is thrown.
 */
export function buildFailoverModel(opts: FailoverModelOptions) {
  const keys = opts.apiKeys.map((k) => k.trim()).filter(Boolean);
  if (keys.length === 0) {
    throw new Error(
      "No API keys provided. Set OPENROUTER_API_KEY in the backend .env " +
        "(comma-separate multiple keys for round-robin failover).",
    );
  }

  let currentIdx = 0;
  const built = new Map<number, ChatGoogleGenerativeAI>();

  const modelForIdx = (idx: number): ChatGoogleGenerativeAI => {
    let m = built.get(idx);
    if (!m) {
      m = new ChatGoogleGenerativeAI({
        apiKey: keys[idx],
        model: opts.model,
        maxOutputTokens: opts.maxOutputTokens,
        maxRetries: opts.maxRetries,
        streaming: false,
      });
      built.set(idx, m);
    }
    return m;
  };

  return {
    // Mirrors BaseChatModel.bindTools so the graph can stay unchanged.
    bindTools(tools: StructuredToolInterface[]) {
      const boundCache = new Map<
        number,
        ReturnType<ChatGoogleGenerativeAI["bindTools"]>
      >();
      const boundForIdx = (idx: number) => {
        let b = boundCache.get(idx);
        if (!b) {
          b = modelForIdx(idx).bindTools(tools);
          boundCache.set(idx, b);
        }
        return b;
      };

      return {
        async invoke(messages: BaseMessage[]): Promise<AIMessage> {
          let lastErr: unknown;
          // Try every key starting from the current one.
          for (let attempt = 0; attempt < keys.length; attempt++) {
            const idx = (currentIdx + attempt) % keys.length;
            try {
              const res = (await boundForIdx(idx).invoke(
                messages,
              )) as AIMessage;
              // Stick to the key that worked.
              currentIdx = idx;
              return res;
            } catch (err) {
              lastErr = err;
              if (isRateLimitError(err)) continue;
              // Not a rate-limit error — real failure. Log and rethrow.
              console.error(
                `[failover] LLM error (non-rate-limit) key #${idx + 1}:`,
                JSON.stringify(describeError(err)),
              );
              console.error("[failover] raw error:", err);
              throw err;
            }
          }
          console.error(
            `[failover] LLM error: all ${keys.length} keys rate-limited ` +
              `(quota exhausted)`,
          );
          throw lastErr;
        },
      };
    },
  };
}

export type FailoverModel = ReturnType<typeof buildFailoverModel>;
