import { Orchestrator } from "@repo/orchestrator/orchestrator";
import type { OrchestratorConfig } from "@repo/orchestrator/types";
import type { ObjectStoreConfig } from "@repo/storage/types";

let orchestrator: Orchestrator | null = null;

export function initOrchestrator(): Orchestrator {
  if (orchestrator) return orchestrator;

  const config: OrchestratorConfig = {
    e2bApiKey: process.env.E2B_API_KEY || "",
    openRouterApiKey: process.env.OPENROUTER_API_KEY || "",
    objectStore: buildObjectStoreConfig(),
    sandboxTemplate: process.env.E2B_TEMPLATE || "base",
    sandboxTimeoutMs: 60 * 60 * 1000, // 60 minutes
    heartbeatTimeoutMs: 2 * 60 * 1000, // 5 minutes without heartbeat → shutdown
    projectBasePath: "/home/user/project",
  };

  orchestrator = new Orchestrator(config);
  orchestrator.start();

  return orchestrator;
}

function buildObjectStoreConfig(): ObjectStoreConfig {
  const provider = process.env.OBJECT_STORE_PROVIDER || "s3";

  if (provider === "gcs") {
    return {
      provider: "gcs",
      bucket: process.env.GCS_BUCKET || "",
      projectId: process.env.GCS_PROJECT_ID || "",
      serviceAccountKeyJson: process.env.GCS_SERVICE_ACCOUNT_KEY,
      serviceAccountKeyPath: process.env.GCS_SERVICE_ACCOUNT_KEY_PATH,
      cdnDomain: process.env.GCS_CDN_DOMAIN,
    };
  }

  return {
    provider: "s3",
    bucket: process.env.S3_BUCKET || "lovable-projects",
    region: process.env.AWS_REGION || "us-east-1",
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    cdnDomain: process.env.S3_CDN_DOMAIN,
  };
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
