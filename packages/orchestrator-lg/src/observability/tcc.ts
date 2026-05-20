// The Context Company tracing for LangChain/LangGraph.
//
// Side-effect module: importing it once installs a global TCC callback
// handler so every LangChain/LangGraph run in the process is traced.
// Per TCC docs, this MUST run BEFORE any LangChain module is imported,
// so this file is the very first import in the orchestrator-lg entry
// point (src/index.ts).
//
// The API key is loaded from TCC_API_KEY by the SDK. Set it in the
// backend's .env (or your secrets manager) — see hand-off in the PR.

import {
  TCCCallbackHandler,
  setGlobalHandler,
} from "@contextcompany/langchain";

// SDK throws if TCC_API_KEY is unset, so guard at boot to keep the backend
// runnable before the env var is provisioned. Once the user adds the key,
// tracing kicks in on next process start.
if (process.env.TCC_API_KEY) {
  setGlobalHandler(new TCCCallbackHandler());
  console.log("[tcc] global LangChain handler registered");
} else {
  console.warn(
    "[tcc] TCC_API_KEY not set — LangChain tracing disabled. " +
      "Add TCC_API_KEY to apps/backend/.env to enable.",
  );
}
