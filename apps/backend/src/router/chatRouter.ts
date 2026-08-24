import { Router, Request, Response } from "express";
import { randomUUID } from "crypto";
import type { ChatCompletionMessageParam } from "@repo/orchestrator/types";
import { getParam } from "../lib/utils";
import { prisma } from "@repo/database/client";
import { chatMessageSchema } from "@repo/common/zod";
import { StreamChunk } from "@repo/common/types";
import { getOrchestrator } from "../lib/orchestrator";
import { getObjectStore } from "../lib/storage";

export const chatRouter: Router = Router();

function contentTypeToExt(contentType: string): string {
  switch (contentType) {
    case "image/png":
      return "png";
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "png";
  }
}

function extToContentType(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    default:
      return "application/octet-stream";
  }
}

chatRouter.post("/:projectId/upload", async (req: Request, res: Response) => {
  try {
    const projectId = getParam(req, "projectId");
    const contentType = req.body?.contentType as string | undefined;

    if (!contentType || !contentType.startsWith("image/")) {
      res.status(400).json({ message: "Only image uploads are allowed" });
      return;
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: req.userId },
    });
    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    const store = getObjectStore();
    const ext = contentTypeToExt(contentType);
    const id = randomUUID();
    const imageKey = `attachments/${projectId}/${id}.${ext}`;
    const thumbnailKey = `attachments/${projectId}/${id}-thumb.jpg`;

    const [imageUploadUrl, thumbnailUploadUrl] = await Promise.all([
      store.getSignedPutUrl(imageKey, { contentType }),
      store.getSignedPutUrl(thumbnailKey, { contentType: "image/jpeg" }),
    ]);

    res.json({ imageKey, imageUploadUrl, thumbnailKey, thumbnailUploadUrl });
  } catch (err) {
    console.error("Upload URL error:", err);
    res.status(500).json({ message: "Failed to create upload URL" });
  }
});

chatRouter.post("/:projectId", async (req: Request, res: Response) => {
  try {
    const parsed = chatMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid message" });
      return;
    }

    const { message = "", imageKey, thumbnailKey } = parsed.data;
    const projectId = getParam(req, "projectId");

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: req.userId },
    });

    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

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
        imageKey: imageKey ?? null,
        thumbnailKey: thumbnailKey ?? null,
      },
    });

    const history = await prisma.conversationHistory.findMany({
      where: { projectId },
      orderBy: { createdAT: "asc" },
    });

    const store = getObjectStore();
    const llmMessages = await Promise.all(
      history
        .filter((h) => h.type === "TEXT_MESSAGE" && !h.hidden)
        .map(async (h): Promise<ChatCompletionMessageParam> => {
          if (h.from === "USER" && h.imageKey) {
            const signedUrl = await store.getSignedGetUrl(h.imageKey, {
              expiresInSeconds: 15 * 60,
            });
            const parts: Array<
              | { type: "text"; text: string }
              | { type: "image_url"; image_url: { url: string } }
            > = [];
            if (h.contents) {
              parts.push({ type: "text", text: h.contents });
            }
            parts.push({
              type: "image_url",
              image_url: { url: signedUrl },
            });
            return { role: "user", content: parts };
          }
          return {
            role:
              h.from === "USER" ? ("user" as const) : ("assistant" as const),
            content: h.contents,
          };
        }),
    );

    const onStream = (chunk: StreamChunk) => {
      res.write(`event: ${chunk.type}\n`);
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    };

    const orchestrator = getOrchestrator();
    const updatedMessages = await orchestrator.handleUserMessage({
      projectId,
      message,
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

chatRouter.get("/:projectId/image", async (req: Request, res: Response) => {
  try {
    const projectId = getParam(req, "projectId");
    const key = req.query.key as string | undefined;

    if (!key) {
      res.status(400).json({ message: "Missing image key" });
      return;
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: req.userId },
    });
    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    if (!key.startsWith(`attachments/${projectId}/`)) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    const store = getObjectStore();
    const data = await store.get(key);
    if (!data) {
      res.status(404).json({ message: "Image not found" });
      return;
    }

    res.setHeader("Content-Type", extToContentType(key));
    res.setHeader("Cache-Control", "private, max-age=86400");
    res.end(data);
  } catch (err) {
    console.error("Image proxy error:", err);
    res.status(500).json({ message: "Failed to load image" });
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
        imageKey: true,
        thumbnailKey: true,
        createdAT: true,
      },
    });

    res.json({ history });
  } catch (err) {
    console.error("History error:", err);
    res.status(500).json({ message: "Failed to get history" });
  }
});
