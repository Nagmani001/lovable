import "dotenv/config";
import { describe, it, expect, beforeAll } from "vitest";
import type { Sandbox } from "e2b";
import type { StreamChunk } from "@repo/common/types";
import { getSharedSandbox } from "../helpers/sandbox.js";
import { ToolExecutor } from "../helpers/executor-shim.js";

const noop = (_chunk: StreamChunk): void => {};

const BASE = "/home/user/project";

let sandbox: Sandbox;
let executor: ToolExecutor;

beforeAll(async () => {
  sandbox = await getSharedSandbox();
  executor = new ToolExecutor(sandbox, BASE);
});

describe("lov-add-dependency", () => {
  it(
    "installs a package and it appears in the sandbox package.json",
    async () => {
      const result = await executor.execute(
        "lov-add-dependency",
        { package: "is-odd" },
        noop,
      );

      expect(result).not.toContain("npm ERR!");

      const pkgJson = await sandbox.files.read(`${BASE}/package.json`);
      const pkg = JSON.parse(pkgJson) as Record<string, unknown>;
      const deps = (pkg["dependencies"] ?? {}) as Record<string, string>;
      const devDeps = (pkg["devDependencies"] ?? {}) as Record<string, string>;

      const hasPackage = "is-odd" in deps || "is-odd" in devDeps;
      expect(hasPackage).toBe(true);
    },
    { timeout: 90_000 },
  );
});

describe("lov-remove-dependency", () => {
  it(
    "removes a previously installed package from package.json",
    async () => {
      await executor.execute("lov-add-dependency", { package: "is-odd" }, noop);

      const result = await executor.execute(
        "lov-remove-dependency",
        { package: "is-odd" },
        noop,
      );

      expect(result).not.toContain("npm ERR!");

      const pkgJson = await sandbox.files.read(`${BASE}/package.json`);
      const pkg = JSON.parse(pkgJson) as Record<string, unknown>;
      const deps = (pkg["dependencies"] ?? {}) as Record<string, string>;
      const devDeps = (pkg["devDependencies"] ?? {}) as Record<string, string>;

      expect("is-odd" in deps || "is-odd" in devDeps).toBe(false);
    },
    { timeout: 90_000 },
  );
});
