import {
  Orchestrator,
  type OrchestratorConfig,
} from "@repo/orchestrator/orchestrator";

import { OrchestratorLG } from "@repo/orchestrator-lg/orchestrator";

let orchestrator: OrchestratorLG | null = null;

export function initOrchestrator(): OrchestratorLG {
  if (orchestrator) return orchestrator;

  const config: OrchestratorConfig = {
    e2bApiKey: process.env.E2B_API_KEY || "",
    openRouterApiKey: process.env.OPENROUTER_API_KEY || "",
    s3Bucket: process.env.S3_BUCKET || "lovable-projects",
    s3Region: process.env.AWS_REGION || "us-east-1",
    awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    sandboxTemplate: process.env.E2B_TEMPLATE || "base",
    sandboxTimeoutMs: 60 * 60 * 1000, // 60 minutes
    heartbeatTimeoutMs: 2 * 60 * 1000, // 5 minutes without heartbeat → shutdown
    projectBasePath: "/home/user/project",
  };

  orchestrator = new OrchestratorLG(config);
  orchestrator.start();

  return orchestrator;
}

export function getOrchestrator(): OrchestratorLG {
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
