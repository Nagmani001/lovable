import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Sandbox } from "e2b";
import type { StreamChunk } from "@repo/common/types";
import { getSharedSandbox } from "../helpers/sandbox.js";
import { ToolExecutor } from "../helpers/executor-shim.js";

const noop = (_chunk: StreamChunk): void => {};

const BASE = "/home/user/project";
const TEST_DIR = `__tool-tests__/lov-line-replace-${Date.now()}`;

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

describe("lov-line-replace", () => {
  it("replaces a specific single-line range in a file", async () => {
    const filePath = `${TEST_DIR}/line-replace.ts`;
    const original = [
      "const a = 1;",
      "const b = 2;  // replace this",
      "const c = 3;",
    ].join("\n");

    await executor.execute(
      "lov-write",
      { file_path: filePath, content: original },
      noop,
    );

    const result = await executor.execute(
      "lov-line-replace",
      {
        file_path: filePath,
        search: "const b = 2;  // replace this",
        first_replaced_line: 2,
        last_replaced_line: 2,
        replace: "const b = 999; // replaced!",
      },
      noop,
    );

    expect(result).toContain("replaced");

    const updated = await sandbox.files.read(`${BASE}/${filePath}`);
    expect(updated).toContain("const b = 999; // replaced!");
    expect(updated).not.toContain("const b = 2;");
    expect(updated).toContain("const a = 1;");
    expect(updated).toContain("const c = 3;");
  });

  it("replaces a multi-line JSX block with another multi-line block", async () => {
    const filePath = `${TEST_DIR}/multi-line-jsx-replace.tsx`;
    const original = [
      "const App = () => (",
      "  <ul>",
      "    <li>",
      "      <button",
      "        onClick={() => deleteTask(task.id)}",
      '        className="bg-destructive rounded hover:bg-destructive/90 transition-all duration-200"',
      "      >",
      "        Delete",
      "      </button>",
      "    </li>",
      "  </ul>",
      ");",
    ].join("\n");

    await executor.execute(
      "lov-write",
      { file_path: filePath, content: original },
      noop,
    );

    // Search spans lines 4-9 (the full button element, multi-line)
    const result = await executor.execute(
      "lov-line-replace",
      {
        file_path: filePath,
        search: [
          "      <button",
          "        onClick={() => deleteTask(task.id)}",
          '        className="bg-destructive rounded hover:bg-destructive/90 transition-all duration-200"',
          "      >",
          "        Delete",
          "      </button>",
        ].join("\n"),
        first_replaced_line: 4,
        last_replaced_line: 9,
        replace: [
          "      <button",
          "        onClick={() => deleteTask(task.id)}",
          '        className="bg-destructive rounded-lg px-4 py-2 transition duration-150 ease-in-out hover:bg-destructive-focus focus:outline-none"',
          "      >",
          "        Delete",
          "      </button>",
        ].join("\n"),
      },
      noop,
    );

    expect(result).toContain("replaced");

    const updated = await sandbox.files.read(`${BASE}/${filePath}`);

    expect(updated).toContain("rounded-lg px-4 py-2 transition duration-150");
    expect(updated).not.toContain("hover:bg-destructive/90");

    expect(updated).toContain("const App = () => (");
    expect(updated).toContain("  <ul>");
    expect(updated).toContain("    <li>");
    expect(updated).toContain("    </li>");
    expect(updated).toContain("  </ul>");
    expect(updated).toContain(");");

    // There should be exactly one <button in the file
    const buttonCount = (updated.match(/<button/g) ?? []).length;
    expect(buttonCount).toBe(1);
  });

  it("uses hint line range when search is an inline (single-line) alias of a multi-line file block", async () => {
    const filePath = `${TEST_DIR}/inline-search-multiline-hint.tsx`;
    const original = [
      "const App = () => (",
      "  <ul>",
      "    <li>",
      '      <button onClick={() => deleteTask(id)} className="bg-destructive rounded hover:bg-destructive/90 transition-all duration-200">Delete</button>',
      "    </li>",
      "  </ul>",
      ");",
    ].join("\n");

    await executor.execute(
      "lov-write",
      { file_path: filePath, content: original },
      noop,
    );

    const result = await executor.execute(
      "lov-line-replace",
      {
        file_path: filePath,
        search:
          '<button onClick={() => deleteTask(id)} className="bg-destructive rounded hover:bg-destructive/90 transition-all duration-200">Delete</button>',
        first_replaced_line: 4,
        last_replaced_line: 4,
        replace: [
          "      <button",
          "        onClick={() => deleteTask(id)}",
          '        className="bg-destructive rounded-lg px-4 py-2"',
          "      >",
          "        Delete",
          "      </button>",
        ].join("\n"),
      },
      noop,
    );

    expect(result).toContain("replaced");

    const updated = await sandbox.files.read(`${BASE}/${filePath}`);

    expect(updated).toContain("rounded-lg px-4 py-2");
    expect(updated).not.toContain("hover:bg-destructive/90");
    expect(updated).toContain("const App = () => (");
    expect(updated).toContain("  <ul>");
    expect(updated).toContain("    <li>");
    expect(updated).toContain("    </li>");
    expect(updated).toContain("  </ul>");
    expect(updated).toContain(");");

    const buttonCount = (updated.match(/<button/g) ?? []).length;
    expect(buttonCount).toBe(1);
  });

  it("replaces a block where hint range is larger than search line count (hint must win)", async () => {
    const filePath = `${TEST_DIR}/hint-larger-than-search.tsx`;
    const original = [
      "function greet() {",
      '  const name = "world";',
      '  console.log("hello", name);',
      '  console.log("extra line A");',
      '  console.log("extra line B");',
      "  return name;",
      "}",
    ].join("\n");

    await executor.execute(
      "lov-write",
      { file_path: filePath, content: original },
      noop,
    );

    const result = await executor.execute(
      "lov-line-replace",
      {
        file_path: filePath,
        search: '  const name = "world";\n  console.log("hello", name);',
        first_replaced_line: 2,
        last_replaced_line: 6,
        replace: '  return "hello world";',
      },
      noop,
    );

    expect(result).toContain("replaced");

    const updated = await sandbox.files.read(`${BASE}/${filePath}`);

    expect(updated).toContain('return "hello world"');
    expect(updated).not.toContain("extra line A");
    expect(updated).not.toContain("extra line B");
    expect(updated).toContain("function greet() {");
    expect(updated).toContain("}");
  });

  it("handles ellipsis search across multiple lines", async () => {
    const filePath = `${TEST_DIR}/ellipsis-replace.ts`;
    const original = [
      "function hello() {",
      "  const greeting = 'hello';",
      "  console.log(greeting);",
      "  return greeting;",
      "}",
    ].join("\n");

    await executor.execute(
      "lov-write",
      { file_path: filePath, content: original },
      noop,
    );

    const result = await executor.execute(
      "lov-line-replace",
      {
        file_path: filePath,
        search: "function hello() {\n...\n}",
        first_replaced_line: 1,
        last_replaced_line: 5,
        replace: "function hello() {\n  return 'world';\n}",
      },
      noop,
    );

    expect(result).toContain("Lines 1-5 replaced");

    const updated = await sandbox.files.read(`${BASE}/${filePath}`);
    expect(updated).toContain("return 'world'");
    expect(updated).not.toContain("greeting");
  });
});
