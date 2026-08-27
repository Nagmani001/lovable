export const WORKER_JOB_TYPES = {
  DEPLOY: "deploy",
} as const;

export type WorkerJobType =
  (typeof WORKER_JOB_TYPES)[keyof typeof WORKER_JOB_TYPES];

export interface DeployJobPayload {
  projectId: string;
  deployId: string;
}

export interface WorkerQueueItem<T extends WorkerJobType = WorkerJobType> {
  type: T;
  payload: T extends "deploy" ? DeployJobPayload : never;
}
