import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // setupFiles runs in the same worker process as the tests,
    // so the sharedSandbox singleton is truly shared across all test files.
    // (globalSetup runs in a separate process and can't share module state)
    setupFiles: ["./src/vitest.setup.ts"],

    // Individual tool operations can be slow (npm install, curl, etc.)
    testTimeout: 60_000,

    // Sandbox startup + teardown can take 60-90s
    hookTimeout: 120_000,

    // Show each test name + result for clear playground-style output
    reporters: ["verbose"],

    // Load .env so E2B_API_KEY is available during the test run
    env: {
      NODE_ENV: "test",
    },
  },
});
