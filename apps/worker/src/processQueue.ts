import type { WorkerQueueItem } from "@repo/common/types";
import { WORKER_JOB_TYPES } from "@repo/common/data";
import { prisma } from "@repo/database/client";
import { persistProject } from "./workers/persistConversation";
import { deploy } from "./workers/deploy";
import { generateProjectTitle } from "./workers/generateTitle";
import { generateThumbnail } from "./workers/generateThumbnail";

export async function processQueueItem(item: WorkerQueueItem): Promise<string> {
  switch (item.type) {
    case WORKER_JOB_TYPES.DEPLOY: {
      const { projectId } = item.payload;
      try {
        await prisma.project.update({
          where: { id: projectId },
          data: { deployIngStatus: "PROCESSING" },
        });
        const url = await deploy(item.payload);
        await prisma.project.update({
          where: { id: projectId },
          data: {
            deployedUrl: url,
            status: "DEPLOYED",
            deployIngStatus: "DEPLOYED",
            lastBuiltAt: new Date(),
          },
        });
        return url;
      } catch (err) {
        await prisma.project.update({
          where: { id: projectId },
          data: { deployIngStatus: "FAILED" },
        });
        throw err;
      }
    }
    case WORKER_JOB_TYPES.PERSIST_PROJECT:
      return persistProject(item.payload);
    case WORKER_JOB_TYPES.GENERATE_TITLE:
      return generateProjectTitle(item.payload);
    case WORKER_JOB_TYPES.GENERATE_THUMBNAIL:
      return generateThumbnail(item.payload);
    default:
      throw new Error(
        `Unknown worker job type: ${JSON.stringify((item as WorkerQueueItem).type)}`,
      );
  }
}
