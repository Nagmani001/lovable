"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import { useRouter } from "next/navigation";
import { connectToProject, getProjectHistory } from "@/lib/api";
import { useChat } from "@/hooks/use-chat";
import { useHeartbeat } from "@/hooks/use-heartbeat";
import { ChatPanel } from "@/components/workspace/chat-panel";
import { WorkspacePanel } from "@/components/workspace/workspace-panel";
import type { UploadedImageKeys } from "@/lib/chat-image";

export default function ProjectWorkspacePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const router = useRouter();
  const { projectId } = use(params);
  const project = projectId[0] as string;
  const prompt = decodeURIComponent(projectId[1]!) as string;

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [vscodeUrl, setVscodeUrl] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [hasHistory, setHasHistory] = useState(false);
  const [showProcessingScreen, setShowProcessingScreen] = useState(false);
  const [initialImage, setInitialImage] = useState<UploadedImageKeys | null>(
    null,
  );

  const { messages, sendMessage, isStreaming, agentStatus, loadHistory } =
    useChat(project);

  useHeartbeat(previewUrl ? project : null);

  // Read image keys passed from project creation (/projects)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const imageKey = params.get("imageKey");
    const thumbnailKey = params.get("thumbnailKey");
    if (imageKey && thumbnailKey) {
      setInitialImage({ imageKey, thumbnailKey });
    }
  }, []);

  // Show the processing screen while the first message builds
  useEffect(() => {
    if (hasHistory) {
      setShowProcessingScreen(false);
      return;
    }

    if (isStreaming && messages.length > 0) {
      setShowProcessingScreen(true);
    }

    if (!isStreaming && messages.length > 0) {
      setShowProcessingScreen(false);
    }
  }, [isStreaming, messages.length, hasHistory]);

  useEffect(() => {
    async function connect() {
      try {
        setIsConnecting(true);
        setConnectionError(null);

        const sandbox = await connectToProject(project);
        setPreviewUrl(sandbox.previewUrl);
        setVscodeUrl(sandbox.vscodeUrl);

        const { history } = await getProjectHistory(project);
        const visible = history.filter(
          (h: any) => !h.hidden && h.type === "TEXT_MESSAGE",
        );

        if (visible.length > 0) {
          loadHistory(visible);
          setHasHistory(true);
        }
      } catch (err) {
        console.error("Failed to connect:", err);
        setConnectionError(
          "Failed to connect to sandbox. Please try refreshing.",
        );
      } finally {
        setIsConnecting(false);
      }
    }

    connect();
  }, [project, loadHistory]);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] min-h-0 bg-background">
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="w-[420px] min-w-[320px] max-w-[600px] border-r border-border flex flex-col min-h-0">
          <ChatPanel
            projectId={project}
            messages={messages}
            onSendMessage={sendMessage}
            isStreaming={isStreaming}
            isConnecting={isConnecting}
            initialMessage={isConnecting || hasHistory ? undefined : prompt}
            initialImage={isConnecting || hasHistory ? null : initialImage}
            agentStatus={agentStatus}
          />
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          {connectionError ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <p className="text-destructive max-w-md">{connectionError}</p>
              <button
                onClick={() => router.refresh()}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
              >
                Retry
              </button>
            </div>
          ) : (
            <WorkspacePanel
              previewUrl={previewUrl}
              vscodeUrl={vscodeUrl}
              showProcessingScreen={showProcessingScreen}
              isConnecting={isConnecting}
              processingPrompt={prompt}
              agentStatus={agentStatus}
            />
          )}
        </div>
      </div>
    </div>
  );
}
