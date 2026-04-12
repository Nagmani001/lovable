import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Sandbox } from "e2b";
import type { StreamChunk } from "@repo/common/types";
import { getSharedSandbox } from "../helpers/sandbox.js";
import { ToolExecutor } from "../helpers/executor-shim.js";

const noop = (_chunk: StreamChunk): void => {};

const BASE = "/home/user/project";
const TEST_DIR = `__tool-tests__/lov-copy-${Date.now()}`;

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

describe("lov-copy", () => {
  it("copies a file to a new location, leaving the original intact", async () => {
    const srcPath = `${TEST_DIR}/copy-src.txt`;
    const destPath = `${TEST_DIR}/copy-dest.txt`;
    const content = "copy me";

    await executor.execute("lov-write", { file_path: srcPath, content }, noop);

    const result = await executor.execute(
      "lov-copy",
      { source_file_path: srcPath, destination_file_path: destPath },
      noop,
    );

    expect(result).toContain("→");

    const srcActual = await sandbox.files.read(`${BASE}/${srcPath}`);
    const destActual = await sandbox.files.read(`${BASE}/${destPath}`);
    expect(srcActual).toBe(content);
    expect(destActual).toBe(content);
  });
});
