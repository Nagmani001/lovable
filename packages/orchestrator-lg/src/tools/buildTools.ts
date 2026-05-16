import { tool } from "@langchain/core/tools";
import { z, type ZodTypeAny } from "zod";
import type { StreamChunk } from "@repo/common/types";
import { ToolExecutor } from "@repo/orchestrator/tools";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface RawProp {
  type: "string" | "number" | "boolean";
  description?: string;
  example?: unknown;
}

interface RawToolDef {
  description: string;
  parameters: {
    properties: Record<string, RawProp>;
    required: string[];
    type: "object";
  };
}

function propToZod(prop: RawProp): ZodTypeAny {
  switch (prop.type) {
    case "string":
      return z.string();
    case "number":
      return z.number();
    case "boolean":
      return z.boolean();
    default:
      return z.unknown();
  }
}

function buildSchema(def: RawToolDef): ZodTypeAny {
  const required = new Set(def.parameters.required ?? []);
  const shape: Record<string, ZodTypeAny> = {};
  for (const [name, prop] of Object.entries(def.parameters.properties)) {
    let s = propToZod(prop);
    if (prop.description) s = s.describe(prop.description);
    if (!required.has(name)) s = s.optional();
    shape[name] = s;
  }
  return z.object(shape);
}

export function loadRawToolDefs(): Record<string, RawToolDef> {
  const toolsPath = resolve(
    __dirname,
    "../../../orchestrator/src/prompt/agent_tools.json",
  );
  const raw = readFileSync(toolsPath, "utf-8");
  return JSON.parse(raw) as Record<string, RawToolDef>;
}

export function loadSystemPrompt(): string {
  const promptPath = resolve(
    __dirname,
    "../../../orchestrator/src/prompt/agent_prompt.txt",
  );
  return readFileSync(promptPath, "utf-8");
}

export function buildLangChainTools(
  executor: ToolExecutor,
  onStream: (chunk: StreamChunk) => void,
) {
  const defs = loadRawToolDefs();
  return Object.entries(defs).map(([name, def]) => {
    const schema = buildSchema(def);
    return tool(
      async (args: unknown): Promise<string> => {
        return executor.execute(
          name,
          args as Record<string, unknown>,
          onStream,
        );
      },
      {
        name,
        description: def.description,
        schema,
      },
    );
  });
}
