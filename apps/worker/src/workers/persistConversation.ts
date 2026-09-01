import { prisma } from "@repo/database/client";
import type { PersistProjectJobPayload } from "@repo/common/types";

export async function persistProject(
  job: PersistProjectJobPayload,
): Promise<string> {
  const { projectId, messages } = job;

  if (messages.length > 0) {
    await prisma.conversationHistory.createMany({
      data: messages.map((m) => ({
        projectId,
        contents: m.contents,
        from: m.from,
        type: m.type,
        hidden: m.hidden,
        imageKey: m.imageKey ?? null,
        thumbnailKey: m.thumbnailKey ?? null,
      })),
    });
  }

  return `persisted ${messages.length} conversation messages for ${projectId}`;
}
