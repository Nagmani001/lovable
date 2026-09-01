import { Router, Response, Request } from "express";
import { getParam } from "../lib/utils";
import { prisma } from "@repo/database/client";
import { getQueueClient } from "../lib/redis";
import { getOrchestrator } from "../lib/orchestrator";
import { REDIS_QUEUE_NAME, WORKER_JOB_TYPES } from "@repo/common/data";
import type { WorkerQueueItem } from "@repo/common/types";

export const deployRouter: Router = Router();

deployRouter.post("/:projectId", async (req: Request, res: Response) => {
  try {
    const projectId = getParam(req, "projectId");

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: req.userId! },
    });
    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    // A deployment is already running — tell the client to keep polling.
    if (
      project.deployIngStatus === "QUEUED" ||
      project.deployIngStatus === "PROCESSING"
    ) {
      res.json({
        message: "Deployment already in progress",
        projectId,
        status: project.deployIngStatus === "QUEUED" ? "QUEUED" : "PROCESSING",
        deployedUrl: project.deployedUrl ?? undefined,
      });
      return;
    }

    // If there have been no new messages since the last build, the project is
    // already up to date — nothing to deploy.
    const lastBuiltAt = project.lastBuiltAt;
    const newConversations = await prisma.conversationHistory.count({
      where: {
        projectId,
        ...(lastBuiltAt ? { createdAT: { gt: lastBuiltAt } } : {}),
      },
    });

    if (lastBuiltAt && newConversations === 0) {
      res.json({
        message: "Project is already up to date",
        projectId,
        status: "DEPLOYED",
        deployedUrl: project.deployedUrl ?? undefined,
      });
      return;
    }

    const deployId = crypto.randomUUID();

    await prisma.project.update({
      where: { id: projectId },
      data: { deployIngStatus: "QUEUED" },
    });

    const sandboxId = getOrchestrator().getSandboxId(projectId);

    const item: WorkerQueueItem = {
      type: WORKER_JOB_TYPES.DEPLOY,
      payload: { projectId, deployId, sandboxId },
    };
    await getQueueClient().lPush(REDIS_QUEUE_NAME, JSON.stringify(item));

    res.json({
      message: "Deployment queued",
      projectId,
      deployId,
      status: "QUEUED",
    });
  } catch (err) {
    console.error("Deploy error:", err);
    if (!res.headersSent) {
      res.status(500).json({ message: "Deployment failed" });
    }
  }
});

deployRouter.get(
  "/:projectId/:deployId",
  async (req: Request, res: Response) => {
    try {
      const projectId = getParam(req, "projectId");
      const deployId = getParam(req, "deployId");

      const project = await prisma.project.findFirst({
        where: { id: projectId, userId: req.userId! },
      });
      if (!project) {
        res.status(404).json({ message: "Project not found" });
        return;
      }

      res.json({
        projectId,
        deployId,
        status: project.deployIngStatus,
        deployedUrl: project.deployedUrl ?? undefined,
      });
    } catch (err) {
      console.error("Deploy status error:", err);
      res.status(500).json({ message: "Failed to fetch deployment status" });
    }
  },
);
