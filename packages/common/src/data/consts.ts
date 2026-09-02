export const REDIS_QUEUE_NAME = "publish_to_queue";

export const DEPLOYMENT_STATUS_KEY_PREFIX = "deployment:status";

export function deploymentStatusKey(deployId: string): string {
  return `${DEPLOYMENT_STATUS_KEY_PREFIX}:${deployId}`;
}

export const WORKER_JOB_TYPES = {
  DEPLOY: "deploy",
  PERSIST_PROJECT: "persist-project",
  GENERATE_TITLE: "generate-title",
  GENERATE_THUMBNAIL: "generate-thumbnail",
} as const;

export const APP_DOMAIN = "app.lovable.nagmani.site";
