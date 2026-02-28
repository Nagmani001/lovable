import { prisma } from "@repo/database/client";
import { Router, Request, Response } from "express";
import { getOrchestrator } from "../lib/orchestrator";
import { getParam } from "../lib/utils";
import { createProjectSchema } from "@repo/common/zod";

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

    const { prompt, model } = parsed.data;
    const userId = req.userId!;

    const project = await prisma.project.create({
      data: {
        title: prompt.substring(0, 100),
        initialPrompt: prompt,
        model: model || "claude",
        userId,
      },
    });

    const orchestrator = getOrchestrator();
    const sandbox = await orchestrator.createSandbox(project.id);

    // this does not start the request to llm , logic for that is present in /project/:projectId routing

    res.json({
      projectId: project.id,
      previewUrl: sandbox.previewUrl,
      vscodeUrl: sandbox.vscodeUrl,
      sandboxId: sandbox.sandboxId,
      prompt,
    });
  } catch (err) {
    console.error("Failed to create project:", err);
    res.status(500).json({ message: "Failed to create project" });
  }
});

// list all the projects  , should have cursor pagination
projectRouter.get("/list", async (req: Request, res: Response) => {
  try {
    const projects = await prisma.project.findMany({
      where: {
        userId: req.userId!,
        NOT: { status: "DELETED" },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        initialPrompt: true,
        status: true,
        deployedUrl: true,
        lastSavedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({ projects });
  } catch (err) {
    console.error("Failed to list projects:", err);
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
      },
    });

    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    res.json({ project });
  } catch (err) {
    console.error("Failed to get project:", err);
    res.status(500).json({ message: "Failed to get project" });
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
      data: { status: "DELETED" },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ message: "Failed to delete project" });
  }
});
