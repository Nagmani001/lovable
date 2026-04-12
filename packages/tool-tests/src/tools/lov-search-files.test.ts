import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Sandbox } from "e2b";
import type { StreamChunk } from "@repo/common/types";
import { getSharedSandbox } from "../helpers/sandbox.js";
import { ToolExecutor } from "../helpers/executor-shim.js";

const noop = (_chunk: StreamChunk): void => {};

const BASE = "/home/user/project";
const TEST_DIR = `__tool-tests__/lov-search-files-${Date.now()}`;

let sandbox: Sandbox;
let executor: ToolExecutor;

beforeAll(async () => {
  sandbox = await getSharedSandbox();
  executor = new ToolExecutor(sandbox, BASE);
  await sandbox.commands.run(`mkdir -p "${BASE}/${TEST_DIR}"`);

  // Seed two files with known content for searching
  await executor.execute(
    "lov-write",
    {
      file_path: `${TEST_DIR}/search-a.ts`,
      content: "export const SEARCH_NEEDLE = 'found it';",
    },
    noop,
  );
  await executor.execute(
    "lov-write",
    {
      file_path: `${TEST_DIR}/search-b.tsx`,
      content: "// no match here",
    },
    noop,
  );
});

afterAll(async () => {
  await sandbox.commands.run(`rm -rf "${BASE}/${TEST_DIR}"`);
});

describe("lov-search-files", () => {
  it("finds a string in the project files", async () => {
    const result = await executor.execute(
      "lov-search-files",
      {
        query: "SEARCH_NEEDLE",
        include_pattern: "**/*.ts",
      },
      noop,
    );

    expect(result).toContain("search-a.ts");
    expect(result).toContain("SEARCH_NEEDLE");
  });

  it("returns no results when the query does not match", async () => {
    const result = await executor.execute(
      "lov-search-files",
      {
        query: "TOTALLY_UNIQUE_XYZ_999",
        include_pattern: "**/*.ts",
      },
      noop,
    );

    expect(result).toBe("No results found");
  });
});
