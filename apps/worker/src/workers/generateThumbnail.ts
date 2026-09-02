import { Sandbox } from "e2b";
import type { GenerateThumbnailJobPayload } from "@repo/common/types";
import { getObjectStore } from "../lib/object-store";
import { getE2bApiKey } from "../lib/config";
import { prisma } from "@repo/database/client";

const THUMBNAIL_PNG_PATH = "/tmp/thumbnail.png";
const SCREENSHOT_TIMEOUT_MS = 180_000;

export async function generateThumbnail(
  job: GenerateThumbnailJobPayload,
): Promise<string> {
  const { projectId, sandboxId } = job;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });
  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  if (project.thumbnailKey) {
    return `thumbnail already exists for ${projectId}`;
  }

  const store = getObjectStore();
  const thumbnailKey = `thumbnails/${projectId}.png`;
  const uploadUrl = await store.getSignedPutUrl(thumbnailKey, {
    contentType: "image/png",
  });

  const sandbox = await Sandbox.connect(sandboxId, {
    apiKey: getE2bApiKey(),
  });

  const script = `#!/usr/bin/env bash
set -e

# Ensure a headless chromium is available for screenshots.
if ! command -v chromium-browser >/dev/null 2>&1 && ! command -v chromium >/dev/null 2>&1 && ! command -v google-chrome >/dev/null 2>&1; then
  echo "Installing chromium..."
  (sudo apt-get update -qq && sudo apt-get install -y -qq chromium-browser) || \\
  (apt-get update -qq && apt-get install -y -qq chromium-browser) || \\
  echo "chromium install failed; trying existing binaries"
fi

BROWSER=$(command -v chromium-browser || command -v chromium || command -v google-chrome)
if [ -z "$BROWSER" ]; then
  echo "No chromium binary found" >&2
  exit 2
fi

"$BROWSER" --headless --no-sandbox --disable-gpu --hide-scrollbars \\
  --window-size=1440,900 --virtual-time-budget=10000 \\
  --screenshot='${THUMBNAIL_PNG_PATH}' http://localhost:5173

curl -sS -X PUT -H "Content-Type: image/png" \\
  --upload-file '${THUMBNAIL_PNG_PATH}' '${uploadUrl}'
echo "thumbnail uploaded"
`;

  console.log(`[thumbnail] capturing screenshot for ${projectId} in sandbox`);
  await sandbox.files.write("/tmp/thumbnail.sh", script);
  const result = await sandbox.commands.run("bash /tmp/thumbnail.sh", {
    timeoutMs: SCREENSHOT_TIMEOUT_MS,
  });
  if (result.exitCode !== 0) {
    throw new Error(
      `Thumbnail capture failed:\n${result.stderr || result.stdout}`,
    );
  }

  await prisma.project.update({
    where: { id: projectId },
    data: { thumbnailKey },
  });

  console.log(`[thumbnail] done ${projectId} -> ${thumbnailKey}`);
  return thumbnailKey;
}
