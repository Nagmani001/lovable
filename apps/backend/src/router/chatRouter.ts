import { Router, Request, Response } from "express";
import { getParam, resolveModelId } from "../lib/utils";
import { prisma } from "@repo/database/client";
import { chatMessageSchema } from "@repo/common/zod";
import { StreamChunk } from "@repo/common/types";
import { getOrchestrator } from "../lib/orchestrator";

export const chatRouter: Router = Router();

chatRouter.post("/:projectId", async (req: Request, res: Response) => {
  try {
    const parsed = chatMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid message" });
      return;
    }

    const { message } = parsed.data;
    const projectId = getParam(req, "projectId");

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: req.userId },
    });

    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    const modelId = resolveModelId(project.model);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    await prisma.conversationHistory.create({
      data: {
        projectId,
        contents: message,
        hidden: false,
        from: "USER",
        type: "TEXT_MESSAGE",
      },
    });

    const history = await prisma.conversationHistory.findMany({
      where: { projectId },
      orderBy: { createdAT: "asc" },
    });

    const llmMessages = history
      .filter((h) => h.type === "TEXT_MESSAGE" && !h.hidden)
      .map((h) => ({
        role: h.from === "USER" ? ("user" as const) : ("assistant" as const),
        content: h.contents,
      }));

    const onStream = (chunk: StreamChunk) => {
      res.write(`event: ${chunk.type}\n`);
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    };

    const orchestrator = getOrchestrator();
    const updatedMessages = await orchestrator.handleUserMessage({
      projectId,
      message,
      model: modelId,
      conversationHistory: llmMessages,
      onStream,
    });

    const lastAssistantMsg = updatedMessages
      .filter((m) => m.role === "assistant")
      .pop();

    if (lastAssistantMsg) {
      const textContent =
        typeof lastAssistantMsg.content === "string"
          ? lastAssistantMsg.content
          : "";

      if (textContent) {
        await prisma.conversationHistory.create({
          data: {
            projectId,
            contents: textContent,
            hidden: false,
            from: "ASSISTANT",
            type: "TEXT_MESSAGE",
          },
        });
      }
    }

    res.write(`event: done\ndata: {}\n\n`);
    res.end();
  } catch (err) {
    console.error("Chat error:", err);

    if (res.headersSent) {
      res.write(
        `event: error\ndata: ${JSON.stringify({ type: "error", message: "Internal error" })}\n\n`,
      );
      res.end();
    } else {
      res.status(500).json({ message: "Chat failed" });
    }
  }
});

chatRouter.get("/:projectId/history", async (req: Request, res: Response) => {
  try {
    const projectId = getParam(req, "projectId");

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: req.userId },
    });
    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    const history = await prisma.conversationHistory.findMany({
      where: { projectId },
      orderBy: { createdAT: "asc" },
      select: {
        id: true,
        contents: true,
        from: true,
        type: true,
        hidden: true,
        createdAT: true,
      },
    });

    res.json({ history });
  } catch (err) {
    console.error("History error:", err);
    res.status(500).json({ message: "Failed to get history" });
  }
});
