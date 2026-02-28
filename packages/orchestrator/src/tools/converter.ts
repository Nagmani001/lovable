import type { ToolDefinition } from "../types/index.js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface RawToolDef {
  description: string;
  parameters: {
    properties: Record<string, unknown>;
    required: string[];
    type: string;
  };
}

/**
 * Loads agent_tools.json and converts it to the OpenAI function-calling format.
 */
export function loadToolDefinitions(): ToolDefinition[] {
  const toolsPath = resolve(__dirname, "../prompt/agent_tools.json");

  const raw = readFileSync(toolsPath, "utf-8");
  console.log(raw);

  try {
    const toolsJson = JSON.parse(raw) as Record<string, RawToolDef>;

    return Object.entries(toolsJson).map(([name, tool]) => ({
      type: "function" as const,
      function: {
        name,
        description: tool.description,
        parameters: {
          type: "object" as const,
          properties: tool.parameters.properties,
          required: tool.parameters.required,
        },
      },
    }));
  } catch (err) {
    console.log("failed here ");
    console.log(err);
  }
}

/**
 * Loads the system prompt from agent_prompt.txt
 */
export function loadSystemPrompt(): string {
  const promptPath = resolve(__dirname, "../prompt/agent_prompt.txt");
  return readFileSync(promptPath, "utf-8");
}
