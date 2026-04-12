import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Sandbox } from "e2b";
import type { StreamChunk } from "@repo/common/types";
import { getSharedSandbox } from "../helpers/sandbox.js";
import { ToolExecutor } from "../helpers/executor-shim.js";

const noop = (_chunk: StreamChunk): void => {};

const BASE = "/home/user/project";
const TEST_DIR = `__tool-tests__/network-${Date.now()}`;

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

describe("lov-fetch-website", () => {
  it("fetches a public webpage and returns its content", async () => {
    const result = await executor.execute(
      "lov-fetch-website",
      { url: "https://example.com" },
      noop,
    );

    expect(result).toContain("Example Domain");
  });

  it("returns content for a small JSON endpoint", async () => {
    const result = await executor.execute(
      "lov-fetch-website",
      { url: "https://httpbin.org/json" },
      noop,
    );

    expect(result).toContain("slideshow");
  });
});

describe("lov-download-to-repo", () => {
  it("downloads a file from a URL into the project directory", async () => {
    const targetPath = `${TEST_DIR}/downloaded.json`;

    const result = await executor.execute(
      "lov-download-to-repo",
      {
        source_url: "https://httpbin.org/json",
        target_path: targetPath,
      },
      noop,
    );

    expect(result).toContain("→");

    const content = await sandbox.files.read(`${BASE}/${targetPath}`);
    expect(content.length).toBeGreaterThan(0);
    expect(() => JSON.parse(content)).not.toThrow();
  });
});

describe("lov-read-console-logs", () => {
  it("returns 'No console logs available' when no logs are stored", async () => {
    const freshExecutor = new ToolExecutor(sandbox, BASE);
    const result = await freshExecutor.execute(
      "lov-read-console-logs",
      { search: "" },
      noop,
    );

    expect(result).toBe("No console logs available");
  });

  it("returns stored logs when no search query is provided", async () => {
    executor.storeConsoleLogs([
      "[error] TypeError: x is not a function",
      "[log] App started",
    ]);

    const result = await executor.execute(
      "lov-read-console-logs",
      { search: "" },
      noop,
    );

    expect(result).toContain("TypeError");
    expect(result).toContain("App started");
  });

  it("filters logs by search query", async () => {
    executor.storeConsoleLogs([
      "[error] TypeError: x is not a function",
      "[log] App started",
    ]);

    const result = await executor.execute(
      "lov-read-console-logs",
      { search: "TypeError" },
      noop,
    );

    expect(result).toContain("TypeError");
    expect(result).not.toContain("App started");
  });

  it("returns 'No matching console logs found' when search has no matches", async () => {
    executor.storeConsoleLogs(["[log] App started"]);

    const result = await executor.execute(
      "lov-read-console-logs",
      { search: "TOTALLY_NOT_IN_LOGS" },
      noop,
    );

    expect(result).toBe("No matching console logs found");
  });
});

describe("lov-read-network-requests", () => {
  it("returns 'No network requests available' when none are stored", async () => {
    const freshExecutor = new ToolExecutor(sandbox, BASE);
    const result = await freshExecutor.execute(
      "lov-read-network-requests",
      { search: "" },
      noop,
    );

    expect(result).toBe("No network requests available");
  });

  it("returns all stored network requests when no search is given", async () => {
    executor.storeNetworkRequests([
      "GET /api/users 200",
      "POST /api/posts 201",
      "GET /api/missing 404",
    ]);

    const result = await executor.execute(
      "lov-read-network-requests",
      { search: "" },
      noop,
    );

    expect(result).toContain("GET /api/users");
    expect(result).toContain("POST /api/posts");
    expect(result).toContain("404");
  });

  it("filters network requests by search query", async () => {
    executor.storeNetworkRequests([
      "GET /api/users 200",
      "POST /api/posts 201",
    ]);

    const result = await executor.execute(
      "lov-read-network-requests",
      { search: "POST" },
      noop,
    );

    expect(result).toContain("POST /api/posts");
    expect(result).not.toContain("GET /api/users");
  });
});
