export const REDIS_QUEUE_NAME = "publish_to_queue";

export const DEPLOYMENT_STATUS_KEY_PREFIX = "deployment:status";

export function deploymentStatusKey(deployId: string): string {
  return `${DEPLOYMENT_STATUS_KEY_PREFIX}:${deployId}`;
}

export const WORKER_JOB_TYPES = {
  DEPLOY: "deploy",
} as const;

export const APP_DOMAIN = "lovable.app";
