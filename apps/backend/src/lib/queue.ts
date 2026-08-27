import {
  REDIS_QUEUE_NAME,
  WORKER_JOB_TYPES,
  deploymentStatusKey,
} from "@repo/common/data";
import { getPubSubClient, getQueueClient } from "./redis";
import { prisma } from "@repo/database/client";
import { Response } from "express";
import type { WorkerQueueItem, DeploymentStatus } from "@repo/common/types";

export async function sendAndAwait(
  id: string,
  res: Response,
  projectId: string,
): Promise<void> {
  const pubSubClient = getPubSubClient();
  const queueClient = getQueueClient();

  await pubSubClient.subscribe(id, async (message) => {
    let data: {
      status: DeploymentStatus;
      deployedUrl?: string;
      error?: string;
    };
    try {
      data = JSON.parse(message);
    } catch {
      if (!res.headersSent) {
        res.status(500).json({ message: "Invalid completion message" });
      }
      return;
    }

    if (data.status === "COMPLETED" && data.deployedUrl) {
      await prisma.project.update({
        where: { id: projectId },
        data: { status: "DEPLOYED", deployedUrl: data.deployedUrl },
      });
      if (!res.headersSent) {
        res.json({
          message: "Deploy completed",
          projectId,
          deployId: id,
          deployedUrl: data.deployedUrl,
        });
      }
    } else {
      await prisma.project.update({
        where: { id: projectId },
        data: { status: "ACTIVE" },
      });
      if (!res.headersSent) {
        res.status(500).json({
          message: "Deployment failed",
          error: data.error,
        });
      }
    }
  });

  const item: WorkerQueueItem = {
    type: WORKER_JOB_TYPES.DEPLOY,
    payload: { projectId, deployId: id },
  };
  await queueClient.lPush(REDIS_QUEUE_NAME, JSON.stringify(item));
}

export async function setDeploymentStatus(
  deployId: string,
  status: DeploymentStatus,
  extra: { deployedUrl?: string; error?: string } = {},
): Promise<void> {
  await getQueueClient().set(
    deploymentStatusKey(deployId),
    JSON.stringify({
      status,
      ...extra,
      updatedAt: new Date().toISOString(),
    }),
  );
}

export async function getDeploymentStatus(deployId: string): Promise<{
  status: DeploymentStatus;
  deployedUrl?: string;
  error?: string;
  updatedAt: string;
} | null> {
  const raw = await getQueueClient().get(deploymentStatusKey(deployId));
  if (!raw) return null;
  return JSON.parse(raw);
}
