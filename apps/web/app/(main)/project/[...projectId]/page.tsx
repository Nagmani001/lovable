"use client";

import { useEffect, useRef, useState } from "react";
import { use } from "react";
import { useParams, useRouter } from "next/navigation";
import { connectToProject, getProjectHistory } from "@/lib/api";
import { useChat } from "@/hooks/use-chat";
import { useHeartbeat } from "@/hooks/use-heartbeat";
import { ChatPanel } from "@/components/workspace/chat-panel";
import { WorkspacePanel } from "@/components/workspace/workspace-panel";
import { WorkspaceHeader } from "@/components/workspace/workspace-header";

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
  const autoSentRef = useRef(false);

  const {
    messages,
    sendMessage,
    isStreaming,
    activeToolCalls,
    agentStatus,
    loadHistory,
  } = useChat(project);

  useHeartbeat(previewUrl ? project : null);

  useEffect(() => {
    async function connect() {
      try {
        setIsConnecting(true);
        setConnectionError(null);

        const sandbox = await connectToProject(project);
        setPreviewUrl(sandbox.previewUrl);
        setVscodeUrl(sandbox.vscodeUrl);

        const { history } = await getProjectHistory(project);
        console.log("history", history);
        const visible = history.filter(
          (h: any) => !h.hidden && h.type === "TEXT_MESSAGE",
        );

        console.log("visible", visible);

        if (visible.length > 0) {
          loadHistory(visible);
        }

        if (history.length === 0 && !autoSentRef.current) {
          autoSentRef.current = true;
          sendMessage(prompt);
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

  if (isConnecting) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="text-muted-foreground">
            Starting your development environment...
          </p>
        </div>
      </div>
    );
  }

  if (connectionError) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center space-y-4 max-w-md">
          <p className="text-destructive">{connectionError}</p>
          <button
            onClick={() => router.refresh()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <WorkspaceHeader
        projectId={project}
        agentStatus={agentStatus}
        activeToolCalls={activeToolCalls}
      />

      <div className="flex flex-1 overflow-hidden">
        <div className="w-[420px] min-w-[320px] max-w-[600px] border-r border-border flex flex-col">
          <ChatPanel
            messages={messages}
            onSendMessage={sendMessage}
            isStreaming={isStreaming}
            agentStatus={agentStatus}
          />
        </div>

        <div className="flex-1 flex flex-col">
          <WorkspacePanel previewUrl={previewUrl} vscodeUrl={vscodeUrl} />
        </div>
      </div>
    </div>
  );
}
