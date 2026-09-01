import { Router, Request, Response } from "express";
import type { ChatCompletionMessageParam } from "@repo/orchestrator/types";
import { getParam } from "../lib/utils";
import { prisma } from "@repo/database/client";
import { getOrchestrator } from "../lib/orchestrator";
import { getObjectStore } from "../lib/storage";

export const preetifyChatRouter: Router = Router();

type HistoryRecord = Awaited<
  ReturnType<typeof prisma.conversationHistory.findMany>
>[number];

async function buildLlmMessages(
  history: HistoryRecord[],
  store: ReturnType<typeof getObjectStore>,
): Promise<ChatCompletionMessageParam[]> {
  return Promise.all(
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
          role: h.from === "USER" ? ("user" as const) : ("assistant" as const),
          content: h.contents,
        };
      }),
  );
}

preetifyChatRouter.post("/", async (req: Request, res: Response) => {
  try {
    const { message = "" } = req.body as { message?: string };

    if (!message.trim()) {
      res.status(400).json({ message: "Message is required" });
      return;
    }

    const orchestrator = getOrchestrator();
    const prettifiedPrompt = await orchestrator.prettifyPrompt({
      message,
      conversationHistory: [],
    });

    res.json({ prettifiedPrompt });
  } catch (err) {
    console.error("Prettify error:", err);
    res.status(500).json({ message: "Failed to prettify prompt" });
  }
});

preetifyChatRouter.post("/:projectId", async (req: Request, res: Response) => {
  try {
    const { message = "" } = req.body as { message?: string };
    const projectId = getParam(req, "projectId");

    if (!message.trim()) {
      res.status(400).json({ message: "Message is required" });
      return;
    }

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
    });

    const store = getObjectStore();
    const llmMessages = await buildLlmMessages(history, store);

    const orchestrator = getOrchestrator();
    const prettifiedPrompt = await orchestrator.prettifyPrompt({
      message,
      conversationHistory: llmMessages,
    });

    res.json({ prettifiedPrompt });
  } catch (err) {
    console.error("Prettify error:", err);
    res.status(500).json({ message: "Failed to prettify prompt" });
  }
});
