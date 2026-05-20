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

const TCC_API_KEY = "tcc_prod_RDm7B3yE9Mv4y2c1va7Ase";

setGlobalHandler(new TCCCallbackHandler({ apiKey: TCC_API_KEY }));

console.log("[tcc] global LangChain handler registered");
