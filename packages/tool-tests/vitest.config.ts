import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./src/vitest.setup.ts"],
    testTimeout: 60_000,
    hookTimeout: 120_000,
    reporters: ["verbose"],
    env: {
      NODE_ENV: "test",
    },
  },
});
