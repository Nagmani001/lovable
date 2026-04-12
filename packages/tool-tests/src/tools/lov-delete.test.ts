import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Sandbox } from "e2b";
import type { StreamChunk } from "@repo/common/types";
import { getSharedSandbox } from "../helpers/sandbox.js";
import { ToolExecutor } from "../helpers/executor-shim.js";

const noop = (_chunk: StreamChunk): void => {};

const BASE = "/home/user/project";
const TEST_DIR = `__tool-tests__/lov-delete-${Date.now()}`;

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

describe("lov-delete", () => {
  it("deletes an existing file", async () => {
    const filePath = `${TEST_DIR}/delete-me.txt`;

    await executor.execute(
      "lov-write",
      { file_path: filePath, content: "bye" },
      noop,
    );

    const result = await executor.execute(
      "lov-delete",
      { file_path: filePath },
      noop,
    );
    expect(result).toBe(`File deleted: ${filePath}`);

    await expect(sandbox.files.read(`${BASE}/${filePath}`)).rejects.toThrow();
  });
});
