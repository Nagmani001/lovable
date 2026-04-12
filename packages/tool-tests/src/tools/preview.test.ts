import "dotenv/config";
import { describe, it, expect, beforeAll } from "vitest";
import type { Sandbox } from "e2b";
import { getSharedSandbox } from "../helpers/sandbox.js";

let sandbox: Sandbox;

beforeAll(async () => {
  sandbox = await getSharedSandbox();
});

describe("Vite Preview URL (port 5173)", () => {
  it("returns a successful HTTP response", async () => {
    const url = `https://${sandbox.getHost(5173)}`;
    const res = await fetch(url);
    expect(res.status).toBe(200);
  });

  it("serves HTML content at the root", async () => {
    const url = `https://${sandbox.getHost(5173)}`;
    const res = await fetch(url);
    const text = await res.text();
    expect(text.toLowerCase()).toContain("<!doctype html");
  });
});

describe("OpenVSCode Server (port 3000)", () => {
  it("returns a successful HTTP response", async () => {
    const url = `https://${sandbox.getHost(3000)}`;
    const res = await fetch(url, { redirect: "manual" });
    expect([200, 301, 302, 303, 307, 308]).toContain(res.status);
  });
});
