import { Router, Response, Request } from "express";
import { getParam } from "../lib/utils";
import { prisma } from "@repo/database/client";
import { getOrchestrator } from "../lib/orchestrator";

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

    const orchestrator = getOrchestrator();
    const deployedUrl = await orchestrator.deployProject(projectId);

    await prisma.project.update({
      where: { id: projectId },
      data: { deployedUrl, status: "DEPLOYED" },
    });

    res.json({ deployedUrl });
  } catch (err) {
    console.error("Deploy error:", err);
    res.status(500).json({ message: "Deployment failed" });
  }
});
