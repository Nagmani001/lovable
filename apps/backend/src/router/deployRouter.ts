import { Router, Response, Request } from "express";
import { getParam } from "../lib/utils";
import { prisma } from "@repo/database/client";
import { sendAndAwait, getDeploymentStatus } from "../lib/queue";

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

    const deployId = crypto.randomUUID();

    await sendAndAwait(deployId, res, projectId);
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

      const status = await getDeploymentStatus(deployId);
      if (!status) {
        res.status(404).json({ message: "Deployment not found" });
        return;
      }

      res.json({ projectId, deployId, ...status });
    } catch (err) {
      console.error("Deploy status error:", err);
      res.status(500).json({ message: "Failed to fetch deployment status" });
    }
  },
);
