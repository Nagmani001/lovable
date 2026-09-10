import { prisma } from "@repo/database/client";
import { Router, Request, Response } from "express";
import { getOrchestrator } from "../lib/orchestrator";
import { getParam } from "../lib/utils";
import { createProjectSchema, updateProjectSchema } from "@repo/common/zod";
import { getQueueClient } from "../lib/redis";
import { REDIS_QUEUE_NAME, WORKER_JOB_TYPES } from "@repo/common/data";
import type { WorkerQueueItem } from "@repo/common/types";
import { logger } from "../lib/logger";

export const projectRouter: Router = Router();

// create a new project
projectRouter.post("/create", async (req: Request, res: Response) => {
  try {
    const parsed = createProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ message: "Invalid request", errors: parsed.error.issues });
      return;
    }

    const { prompt } = parsed.data;
    const userId = req.userId!;

    const project = await prisma.project.create({
      data: {
        initialPrompt: prompt,
        userId,
      },
    });

    const orchestrator = getOrchestrator();
    const sandbox = await orchestrator.createSandbox(project.id);

    // The title is generated asynchronously by the worker, which also derives
    // the deployPrefix and registers the host rule in the url map.
    const item: WorkerQueueItem = {
      type: WORKER_JOB_TYPES.GENERATE_TITLE,
      payload: { projectId: project.id, initialPrompt: prompt },
    };
    await getQueueClient().lPush(REDIS_QUEUE_NAME, JSON.stringify(item));

    res.json({
      projectId: project.id,
      previewUrl: sandbox.previewUrl,
      vscodeUrl: sandbox.vscodeUrl,
      sandboxId: sandbox.sandboxId,
      prompt,
    });
  } catch (err) {
    logger.error({ err }, "failed to create project");
    res.status(500).json({ message: "Failed to create project" });
  }
});

// list all the projects  , should have cursor pagination
projectRouter.get("/list", async (req: Request, res: Response) => {
  try {
    const projects = await prisma.project.findMany({
      where: {
        userId: req.userId!,
        isDeleted: false,
        NOT: { status: "DELETED" },
      },
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        deployPrefix: true,
        initialPrompt: true,
        status: true,
        deployedUrl: true,
        thumbnailKey: true,
        isPinned: true,
        lastSavedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({ projects });
  } catch (err) {
    logger.error({ err }, "failed to list projects");
    res.status(500).json({ message: "Failed to list projects" });
  }
});

// get details of a specific project
projectRouter.get("/:projectId", async (req: Request, res: Response) => {
  try {
    const projectId = getParam(req, "projectId");

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: req.userId!,
        isDeleted: false,
        NOT: { status: "DELETED" },
      },
    });

    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    res.json({ project });
  } catch (err) {
    logger.error({ err }, "failed to get project");
    res.status(500).json({ message: "Failed to get project" });
  }
});

// update a project (rename or pin/unpin)
projectRouter.patch("/:projectId", async (req: Request, res: Response) => {
  try {
    const projectId = getParam(req, "projectId");

    const parsed = updateProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ message: "Invalid request", errors: parsed.error.issues });
      return;
    }

    const existing = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: req.userId!,
        isDeleted: false,
        NOT: { status: "DELETED" },
      },
    });
    if (!existing) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    const data: { title?: string; isPinned?: boolean } = {};
    if (parsed.data.title !== undefined) data.title = parsed.data.title;
    if (parsed.data.isPinned !== undefined) {
      data.isPinned = parsed.data.isPinned;
    }

    const project = await prisma.project.update({
      where: { id: projectId },
      data,
      select: {
        id: true,
        title: true,
        isPinned: true,
      },
    });

    res.json({ project });
  } catch (err) {
    logger.error({ err }, "failed to update project");
    res.status(500).json({ message: "Failed to update project" });
  }
});

// delete a project
projectRouter.delete("/:projectId", async (req: Request, res: Response) => {
  try {
    const projectId = getParam(req, "projectId");

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: req.userId! },
    });
    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    await prisma.project.update({
      where: { id: projectId },
      data: { isDeleted: true, status: "DELETED" },
    });

    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "delete project error");
    res.status(500).json({ message: "Failed to delete project" });
  }
});
