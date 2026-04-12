import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Sandbox } from "e2b";
import type { StreamChunk } from "@repo/common/types";
import { getSharedSandbox } from "../helpers/sandbox.js";
import { ToolExecutor } from "../helpers/executor-shim.js";

const noop = (_chunk: StreamChunk): void => {};

const BASE = "/home/user/project";
const TEST_DIR = `__tool-tests__/lov-write-${Date.now()}`;

let sandbox: Sandbox;
let executor: ToolExecutor;

beforeAll(async () => {
  sandbox = await getSharedSandbox();
  executor = new ToolExecutor(sandbox, BASE);
  await sandbox.commands.run(`mkdir -p "${BASE}/${TEST_DIR}"`);
});

afterAll(async () => {
  await sandbox.commands.run(`rm -rf "${BASE}/${TEST_DIR}"`);
});

describe("lov-write", () => {
  it("creates a new file with the given content", async () => {
    const filePath = `${TEST_DIR}/write-test.txt`;
    const content = "Hello from lov-write!";

    const result = await executor.execute(
      "lov-write",
      { file_path: filePath, content },
      noop,
    );

    expect(result).toBe(`File written: ${filePath}`);

    const actual = await sandbox.files.read(`${BASE}/${filePath}`);
    expect(actual).toBe(content);
  });

  it("overwrites an existing file", async () => {
    const filePath = `${TEST_DIR}/overwrite-test.txt`;

    await executor.execute(
      "lov-write",
      { file_path: filePath, content: "original" },
      noop,
    );
    await executor.execute(
      "lov-write",
      { file_path: filePath, content: "overwritten" },
      noop,
    );

    const actual = await sandbox.files.read(`${BASE}/${filePath}`);
    expect(actual).toBe("overwritten");
  });

  it("creates parent directories if they do not exist", async () => {
    const filePath = `${TEST_DIR}/deep/nested/dir/file.ts`;
    const content = "export const x = 1;";

    await executor.execute("lov-write", { file_path: filePath, content }, noop);
    const actual = await sandbox.files.read(`${BASE}/${filePath}`);
    expect(actual).toBe(content);
  });
});
