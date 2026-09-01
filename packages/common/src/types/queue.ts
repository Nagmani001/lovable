export const WORKER_JOB_TYPES = {
  DEPLOY: "deploy",
  PERSIST_PROJECT: "persist-project",
  GENERATE_TITLE: "generate-title",
} as const;

export type WorkerJobType =
  (typeof WORKER_JOB_TYPES)[keyof typeof WORKER_JOB_TYPES];

export interface DeployJobPayload {
  projectId: string;
  deployId: string;
  sandboxId?: string;
}

export interface ConversationMessageInput {
  contents: string;
  from: "USER" | "ASSISTANT";
  type: "TEXT_MESSAGE";
  hidden: boolean;
  imageKey?: string | null;
  thumbnailKey?: string | null;
}

export interface PersistProjectJobPayload {
  projectId: string;
  messages: ConversationMessageInput[];
}

export interface GenerateTitleJobPayload {
  projectId: string;
  initialPrompt: string;
}

export interface WorkerJobPayloads {
  deploy: DeployJobPayload;
  "persist-project": PersistProjectJobPayload;
  "generate-title": GenerateTitleJobPayload;
}

export type WorkerQueueItem<T extends WorkerJobType = WorkerJobType> =
  T extends WorkerJobType ? { type: T; payload: WorkerJobPayloads[T] } : never;
