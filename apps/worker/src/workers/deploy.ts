import { Sandbox } from "e2b";
import type { DeployJobPayload } from "@repo/common/types";
import { getObjectStore } from "../lib/object-store";
import { contentTypeFor } from "../lib/content-type";
import { prisma } from "@repo/database/client";
import {
  getE2bApiKey,
  getAppDomain,
  getProjectBasePath,
  getArtifactsPrefix,
  getBuildTimeoutMs,
  getUploadTimeoutMs,
} from "../lib/config";

export async function deploy(job: DeployJobPayload): Promise<string> {
  const { projectId, deployId, sandboxId } = job;
  console.log(`[deploy] starting ${projectId} (deployId: ${deployId})`);

  if (!sandboxId) {
    throw new Error(`No active sandbox found for project ${projectId}`);
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });
  const deployPrefix = project?.deployPrefix ?? projectId;

  const sandbox = await Sandbox.connect(sandboxId, {
    apiKey: getE2bApiKey(),
  });

  const projectBasePath = getProjectBasePath();
  const artifactsPrefix = getArtifactsPrefix();

  console.log(`[deploy] building ${projectId} in sandbox`);
  const buildResult = await sandbox.commands.run(
    `cd ${projectBasePath} && npm run build -- --base=./`,
    { timeoutMs: getBuildTimeoutMs() },
  );
  if (buildResult.exitCode !== 0) {
    throw new Error(
      `Build failed:\n${buildResult.stderr || buildResult.stdout}`,
    );
  }

  const listResult = await sandbox.commands.run(
    `cd ${projectBasePath} && find dist -type f`,
    { timeoutMs: getBuildTimeoutMs() },
  );
  const files = (listResult.stdout ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (files.length === 0) {
    throw new Error(`Build produced no files for project ${projectId}`);
  }

  const store = getObjectStore();
  const scriptLines = ["#!/usr/bin/env bash", "set -e"];
  for (const file of files) {
    const relPath = file.replace(/^dist\//, "");
    const contentType = contentTypeFor(relPath);
    const key = `${artifactsPrefix}/${deployPrefix}/${relPath}`;
    const uploadUrl = await store.getSignedPutUrl(key, { contentType });
    const localPath = `${projectBasePath}/${file}`;
    scriptLines.push(
      `curl -sS -X PUT -H "Content-Type: ${contentType}" ` +
        `--upload-file '${localPath}' '${uploadUrl}'`,
    );
  }
  const uploadScript = scriptLines.join("\n");

  console.log(`[deploy] uploading ${files.length} artifacts for ${projectId}`);
  await sandbox.files.write("/tmp/upload.sh", uploadScript);
  const uploadResult = await sandbox.commands.run("bash /tmp/upload.sh", {
    timeoutMs: getUploadTimeoutMs(),
  });
  if (uploadResult.exitCode !== 0) {
    throw new Error(
      `Artifact upload failed:\n${uploadResult.stderr || uploadResult.stdout}`,
    );
  }

  console.log(
    `[deploy] done ${projectId} -> ${artifactsPrefix}/${deployPrefix}/`,
  );
  return `https://${deployPrefix}.${getAppDomain()}`;
}
