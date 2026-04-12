import "dotenv/config";
import { beforeAll, afterAll } from "vitest";
import { getSharedSandbox, killSharedSandbox } from "./helpers/sandbox.js";

beforeAll(async () => {
  await getSharedSandbox();
}, 120_000);

afterAll(async () => {
  await killSharedSandbox();
}, 60_000);
