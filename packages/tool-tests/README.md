# @repo/tool-tests

A playground and test suite for exercising every `ToolExecutor` tool against a **real local e2b sandbox**.

## Setup

```bash
# 1. Copy env template and fill in your E2B_API_KEY
cp .env.example .env

# 2. Install dependencies (from repo root)
pnpm install
```

## Running Tests

```bash
# Run all tool tests once (creates sandbox, runs tests, kills sandbox)
pnpm test

# Watch mode (re-runs affected tests on file changes)
pnpm test:watch
```

The test run will:

1. **Create** a real e2b sandbox from the configured template
2. **Start** Vite + OpenVSCode Server inside it
3. **Run** all test suites in parallel
4. **Kill** the sandbox on completion (or Ctrl+C)

## Interactive Playground

If you want a live sandbox to experiment with manually:

```bash
pnpm playground
```

This starts a sandbox, prints the preview + VS Code URLs, and keeps it alive until `Ctrl+C`.

## Test Suites

| File                         | Tools Tested                                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------------------------- |
| `src/tools/file-ops.test.ts` | `lov-write`, `lov-view`, `lov-delete`, `lov-rename`, `lov-copy`, `lov-line-replace`, `lov-search-files` |
| `src/tools/network.test.ts`  | `lov-fetch-website`, `lov-download-to-repo`, `lov-read-console-logs`, `lov-read-network-requests`       |
| `src/tools/deps.test.ts`     | `lov-add-dependency`, `lov-remove-dependency`                                                           |
| `src/tools/preview.test.ts`  | Vite preview URL (5173) + VS Code URL (3000) smoke tests                                                |

## Environment Variables

| Variable            | Default                | Description                                      |
| ------------------- | ---------------------- | ------------------------------------------------ |
| `E2B_API_KEY`       | _(required)_           | Your E2B API key from [e2b.dev](https://e2b.dev) |
| `SANDBOX_TEMPLATE`  | `lovable-template-dev` | Template to use (`lovable-template` for prod)    |
| `PROJECT_BASE_PATH` | `/home/user/project`   | Base path inside the sandbox                     |
