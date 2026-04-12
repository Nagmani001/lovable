import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Sandbox } from "e2b";
import type { StreamChunk } from "@repo/common/types";
import { getSharedSandbox } from "../helpers/sandbox.js";
import { ToolExecutor } from "../helpers/executor-shim.js";

const noop = (_chunk: StreamChunk): void => {};

const BASE = "/home/user/project";
const TEST_DIR = `__tool-tests__/lov-rename-${Date.now()}`;

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

describe("lov-rename", () => {
  it("moves a file to a new path", async () => {
    const origPath = `${TEST_DIR}/rename-src.txt`;
    const newPath = `${TEST_DIR}/rename-dest.txt`;
    const content = "rename me";

    await executor.execute("lov-write", { file_path: origPath, content }, noop);

    const result = await executor.execute(
      "lov-rename",
      { original_file_path: origPath, new_file_path: newPath },
      noop,
    );

    expect(result).toContain("→");

    const actual = await sandbox.files.read(`${BASE}/${newPath}`);
    expect(actual).toBe(content);

    await expect(sandbox.files.read(`${BASE}/${origPath}`)).rejects.toThrow();
  });
});
