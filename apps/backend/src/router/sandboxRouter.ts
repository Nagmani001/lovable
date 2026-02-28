import { Router, Request, Response } from "express";
import { getParam } from "../lib/utils";
import { prisma } from "@repo/database/client";
import { getOrchestrator } from "../lib/orchestrator";

export const sandboxRouter: Router = Router();

sandboxRouter.post(
  "/:projectId/connect",
  async (req: Request, res: Response) => {
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

      const orchestrator = getOrchestrator();
      const sandbox = await orchestrator.createSandbox(project.id);

      res.json({
        projectId: project.id,
        previewUrl: sandbox.previewUrl,
        vscodeUrl: sandbox.vscodeUrl,
        sandboxId: sandbox.sandboxId,
      });
    } catch (err) {
      console.error("Failed to connect to project:", err);
      res.status(500).json({ message: "Failed to connect to project" });
    }
  },
);

sandboxRouter.post(
  "/:projectId/heartbeat",
  async (req: Request, res: Response) => {
    try {
      const projectId = getParam(req, "projectId");
      const orchestrator = getOrchestrator();
      const alive = await orchestrator.heartbeat(projectId);
      res.json({ ok: alive });
    } catch {
      res.json({ ok: false });
    }
  },
);

sandboxRouter.post(
  "/:projectId/persist",
  async (req: Request, res: Response) => {
    try {
      const projectId = getParam(req, "projectId");
      const orchestrator = getOrchestrator();
      await orchestrator.persistProject(projectId);

      await prisma.project.update({
        where: { id: projectId },
        data: { lastSavedAt: new Date() },
      });

      res.json({ ok: true });
    } catch (err) {
      console.error("Persist error:", err);
      res.json({ ok: false });
    }
  },
);
