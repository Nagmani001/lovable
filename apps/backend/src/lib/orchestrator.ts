import { Orchestrator } from "@repo/orchestrator/orchestrator";
import type { OrchestratorConfig } from "@repo/orchestrator/types";
import { buildObjectStoreConfigFromEnv } from "@repo/storage";

let orchestrator: Orchestrator | null = null;

export function initOrchestrator(): Orchestrator {
  if (orchestrator) return orchestrator;

  const config: OrchestratorConfig = {
    e2bApiKey: process.env.E2B_API_KEY || "",
    openRouterApiKey: process.env.OPENROUTER_API_KEY || "",
    objectStore: buildObjectStoreConfigFromEnv(),
    sandboxTemplate: process.env.E2B_TEMPLATE || "base",
    sandboxTimeoutMs: 60 * 60 * 1000, // 60 minutes
    heartbeatTimeoutMs: 2 * 60 * 1000, // 5 minutes without heartbeat → shutdown
    projectBasePath: "/home/user/project",
  };

  orchestrator = new Orchestrator(config);
  orchestrator.start();

  return orchestrator;
}

export function getOrchestrator(): Orchestrator {
  if (!orchestrator) {
    throw new Error(
      "Orchestrator not initialized. Call initOrchestrator() first.",
    );
  }
  return orchestrator;
}

export async function shutdownOrchestrator(): Promise<void> {
  if (orchestrator) {
    await orchestrator.shutdown();
    orchestrator = null;
  }
}
