import type { GenerateTitleJobPayload } from "@repo/common/types";
import { prisma } from "@repo/database/client";
import { registerHostRule } from "../lib/url-map";
import { generateTitle } from "../lib/generate-title";

const MAX_DEPLOY_PREFIX_LENGTH = 63;

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_DEPLOY_PREFIX_LENGTH)
    .replace(/-+$/g, "");
}

function isUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: string }).code === "P2002"
  );
}

export async function generateProjectTitle(
  job: GenerateTitleJobPayload,
): Promise<string> {
  const { projectId, initialPrompt } = job;

  const title = await generateTitle(initialPrompt);
  const basePrefix = slugify(title) || `project-${projectId.slice(0, 8)}`;

  let deployPrefix = basePrefix;
  let attempt = 1;
  while (true) {
    try {
      await prisma.project.update({
        where: { id: projectId },
        data: { title, deployPrefix },
      });
      break;
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        deployPrefix = `${basePrefix}-${attempt}`;
        attempt += 1;
        continue;
      }
      throw err;
    }
  }

  const host = await registerHostRule(deployPrefix);
  console.log(
    `[title] project ${projectId} titled "${title}" -> ${host} (${deployPrefix})`,
  );
  return host;
}
