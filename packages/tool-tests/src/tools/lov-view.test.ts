import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Sandbox } from "e2b";
import type { StreamChunk } from "@repo/common/types";
import { getSharedSandbox } from "../helpers/sandbox.js";
import { ToolExecutor } from "../helpers/executor-shim.js";

const noop = (_chunk: StreamChunk): void => {};

const BASE = "/home/user/project";
const TEST_DIR = `__tool-tests__/lov-view-${Date.now()}`;
const FILE_PATH = `${TEST_DIR}/view-test.txt`;
const LINES = ["line one", "line two", "line three", "line four", "line five"];

let sandbox: Sandbox;
let executor: ToolExecutor;

beforeAll(async () => {
  sandbox = await getSharedSandbox();
  executor = new ToolExecutor(sandbox, BASE);
  await sandbox.commands.run(`mkdir -p "${BASE}/${TEST_DIR}"`);
  await executor.execute(
    "lov-write",
    { file_path: FILE_PATH, content: LINES.join("\n") },
    noop,
  );
});

afterAll(async () => {
  await sandbox.commands.run(`rm -rf "${BASE}/${TEST_DIR}"`);
});

describe("lov-view", () => {
  it("returns file content with line numbers", async () => {
    const result = await executor.execute(
      "lov-view",
      { file_path: FILE_PATH },
      noop,
    );

    expect(result).toContain("1: line one");
    expect(result).toContain("5: line five");
  });

  it("respects the lines parameter to return a specific range", async () => {
    const result = await executor.execute(
      "lov-view",
      { file_path: FILE_PATH, lines: "2-3" },
      noop,
    );

    expect(result).toContain("2: line two");
    expect(result).toContain("3: line three");
    expect(result).not.toContain("1: line one");
    expect(result).not.toContain("4: line four");
  });

  it("returns only line 1 when lines='1' is given", async () => {
    const result = await executor.execute(
      "lov-view",
      { file_path: FILE_PATH, lines: "1" },
      noop,
    );

    expect(result).toContain("1: line one");
    expect(result).not.toContain("2: line two");
  });
});
