import {
  ConversationMessageInput,
  WORKER_JOB_TYPES,
  WorkerQueueItem,
} from "@repo/common/types";
import { server } from "..";
import { Request } from "express";
import { getQueueClient } from "./redis";
import { REDIS_QUEUE_NAME } from "@repo/common/data";

export function shutdown(code = 0) {
  console.log("Shutting down gracefully...");
  server.close(() => {
    process.exit(code);
  });
  setTimeout(() => {
    process.exit(code);
  }, 5000);
}

export function getParam(req: Request, name: string): string {
  const val = req.params[name];
  if (typeof val === "string") return val;
  throw new Error(`Missing param: ${name}`);
}

export const enqueueConversation = async (
  projectId: string,
  messages: ConversationMessageInput[],
) => {
  const item: WorkerQueueItem = {
    type: WORKER_JOB_TYPES.PERSIST_PROJECT,
    payload: { projectId, messages },
  };
  await getQueueClient().lPush(REDIS_QUEUE_NAME, JSON.stringify(item));
};

export const enqueueThumbnail = async (payload: {
  projectId: string;
  userId: string;
  sandboxId: string;
}) => {
  const item: WorkerQueueItem = {
    type: WORKER_JOB_TYPES.GENERATE_THUMBNAIL,
    payload,
  };
  await getQueueClient().lPush(REDIS_QUEUE_NAME, JSON.stringify(item));
};
