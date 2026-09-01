import {
  callLLMWithRetry,
  createLlmClientRotation,
} from "@repo/orchestrator/llm-utils";

const TITLE_MODEL = "gemini-3-flash-preview";

const TITLE_SYSTEM_PROMPT = `You generate short, descriptive titles for AI-generated app projects. A user describes an app they want to build. Respond with a concise title of 3-6 words that captures the essence of the app.

Rules:
- Plain words only: letters, numbers, spaces and hyphens. No quotes, punctuation, or markdown.
- No preamble, no explanations, no numbering.
- Respond with ONLY the title.`;

export async function generateTitle(initialPrompt: string): Promise<string> {
  const rotation = createLlmClientRotation(
    process.env.OPENROUTER_API_KEY || "",
  );
  const response = await callLLMWithRetry(
    rotation,
    [
      { role: "system", content: TITLE_SYSTEM_PROMPT },
      { role: "user", content: initialPrompt },
    ],
    [],
    "[title] ",
    TITLE_MODEL,
  );

  const title = response.choices[0]?.message?.content?.trim();
  if (!title) {
    throw new Error("Failed to generate title from LLM");
  }
  return title;
}
