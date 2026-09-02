import { toast } from "@repo/ui/lib/toast";
import { getBackendUrl } from "./util";
import axios from "axios";

export async function createProject(prompt: string) {
  try {
    const res = await axios.post(
      `${getBackendUrl()}/api/v1/project/create`,
      {
        prompt,
      },
      {
        withCredentials: true,
      },
    );

    return res.data;
  } catch (err) {
    toast.error("failed to create project , please sign in first");
    throw new Error("Failed to create project");
  }
}

export async function listProjects() {
  try {
    const res = await axios.get(`${getBackendUrl()}/api/v1/project/list`, {
      withCredentials: true,
    });
    return res.data;
  } catch (err) {
    throw new Error("Failed to list projects");
  }
}

export async function getProject(projectId: string) {
  try {
    const res = await axios.get(
      `${getBackendUrl()}/api/v1/project/${projectId}`,
      {
        withCredentials: true,
      },
    );
    return res.data;
  } catch (err) {
    throw new Error("Failed to get project");
  }
}

export async function deleteProject(projectId: string) {
  try {
    const res = await axios.delete(
      `${getBackendUrl()}/api/v1/project/${projectId}`,
      {
        withCredentials: true,
      },
    );
    return res.data;
  } catch (err) {
    throw new Error("Failed to delete project");
  }
}

export async function connectToProject(projectId: string) {
  try {
    const res = await axios.post(
      `${getBackendUrl()}/api/v1/sandbox/${projectId}/connect`,
      {},
      {
        withCredentials: true,
      },
    );
    return res.data;
  } catch (err) {
    throw new Error("Failed to connect to project");
  }
}

export async function sendHeartbeat(projectId: string) {
  try {
    await axios.post(
      `${getBackendUrl()}/api/v1/sandbox/${projectId}/heartbeat`,
      {},
      {
        withCredentials: true,
      },
    );
  } catch (err) {}
}

export async function persistProject(projectId: string) {
  // Use sendBeacon for reliable delivery on tab close
  navigator.sendBeacon(
    `${getBackendUrl()}/api/v1/sandbox/${projectId}/persist`,
  );
}

export async function getProjectHistory(projectId: string) {
  try {
    const res = await axios.get(
      `${getBackendUrl()}/api/v1/chat/${projectId}/history`,
      {
        withCredentials: true,
      },
    );
    return res.data;
  } catch (err) {
    throw new Error("Failed to get history");
  }
}

export async function prettifyPrompt(
  projectId: string,
  message: string,
): Promise<string> {
  const res = await axios.post(
    `${getBackendUrl()}/api/v1/prettify/${projectId}`,
    { message },
    { withCredentials: true },
  );
  return res.data.prettifiedPrompt as string;
}

export async function prettifyPromptHome(message: string): Promise<string> {
  const res = await axios.post(
    `${getBackendUrl()}/api/v1/prettify`,
    { message },
    { withCredentials: true },
  );
  return res.data.prettifiedPrompt as string;
}

export interface ImageUploadUrls {
  imageKey: string;
  imageUploadUrl: string;
  thumbnailKey: string;
  thumbnailUploadUrl: string;
}

export async function requestImageUpload(
  projectId: string,
  contentType: string,
): Promise<ImageUploadUrls> {
  const res = await axios.post(
    `${getBackendUrl()}/api/v1/chat/${projectId}/upload`,
    { contentType },
    { withCredentials: true },
  );
  return res.data;
}

export async function uploadImageToSignedUrl(
  uploadUrl: string,
  blob: Blob,
  contentType: string,
): Promise<void> {
  await axios.put(uploadUrl, blob, {
    headers: { "Content-Type": contentType },
  });
}

export async function* streamChat(
  projectId: string,
  message: string,
  imageKey?: string,
  thumbnailKey?: string,
): AsyncGenerator<{ type: string; data: Record<string, unknown> }> {
  const res = await fetch(`${getBackendUrl()}/api/v1/chat/${projectId}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, imageKey, thumbnailKey }),
  });

  if (!res.ok) {
    throw new Error("Chat request failed");
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Parse SSE events from buffer
    const events = buffer.split("\n\n");
    buffer = events.pop() || ""; // Keep incomplete event in buffer

    for (const eventStr of events) {
      if (!eventStr.trim()) continue;

      const lines = eventStr.split("\n");
      let eventType = "message";
      let data = "";

      for (const line of lines) {
        if (line.startsWith("event: ")) {
          eventType = line.slice(7);
        } else if (line.startsWith("data: ")) {
          data = line.slice(6);
        }
      }

      if (data) {
        try {
          yield { type: eventType, data: JSON.parse(data) };
        } catch {
          // Skip malformed JSON
        }
      }
    }
  }
}

export async function deployProject(projectId: string) {
  try {
    const res = await axios.post(
      `${getBackendUrl()}/api/v1/deploy/${projectId}`,
      {},
      {
        withCredentials: true,
      },
    );
    return res.data;
  } catch (err) {
    throw new Error("Deployment failed");
  }
}

export async function getDeployStatus(
  projectId: string,
  deployId: string,
): Promise<{
  status: string;
  deployedUrl?: string;
}> {
  const res = await axios.get(
    `${getBackendUrl()}/api/v1/deploy/${projectId}/${deployId}`,
    {
      withCredentials: true,
    },
  );
  return res.data;
}

export async function checkDeployStatus(projectId: string): Promise<{
  inProgress: boolean;
  needsRedeploy: boolean;
  deployedUrl?: string;
}> {
  const res = await axios.get(
    `${getBackendUrl()}/api/v1/deploy/${projectId}/check`,
    {
      withCredentials: true,
    },
  );
  return res.data;
}

export async function pollDeployStatus(
  projectId: string,
  deployId: string,
  intervalMs = 2_000,
): Promise<{ status: string; deployedUrl?: string }> {
  for (;;) {
    const status = await getDeployStatus(projectId, deployId);
    if (status.status === "DEPLOYED" || status.status === "FAILED") {
      return status;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
