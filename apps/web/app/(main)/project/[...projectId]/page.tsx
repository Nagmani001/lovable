"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import { useRouter } from "next/navigation";
import {
  Group,
  Panel,
  Separator,
  useDefaultLayout,
} from "react-resizable-panels";
import type { LayoutStorage } from "react-resizable-panels";
import { connectToProject, getProjectHistory } from "@/lib/api";
import { useChat, ChatImageAttachment } from "@/hooks/use-chat";
import { useHeartbeat } from "@/hooks/use-heartbeat";
import { useMediaQuery } from "@/hooks/use-media-query";
import { ChatPanel } from "@/components/workspace/chat-panel";
import { WorkspacePanel } from "@/components/workspace/workspace-panel";
import { ProjectSidebar } from "@/components/workspace/project-sidebar";
import type { UploadedImageKeys } from "@/lib/chat-image";
import { useAtom } from "jotai";
import { isAgentBusyAtom, isDeployingAtom } from "@/atom";

const arenaStorage: LayoutStorage =
  typeof window === "undefined"
    ? { getItem: () => null, setItem: () => {} }
    : window.localStorage;

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

  const [isDeploying, setIsDeploying] = useAtom(isDeployingAtom);
  const [, setAgentBusy] = useAtom(isAgentBusyAtom);

  // Responsive arena layout: side-by-side on desktop, stacked on mobile.
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const desktopLayout = useDefaultLayout({
    id: "arena-desktop",
    storage: arenaStorage,
    onlySaveAfterUserInteractions: true,
  });
  const mobileLayout = useDefaultLayout({
    id: "arena-mobile",
    storage: arenaStorage,
    onlySaveAfterUserInteractions: true,
  });

  // The deploy button is only enabled once the agent is idle.
  useEffect(() => {
    setAgentBusy(isStreaming || isConnecting);
  }, [isStreaming, isConnecting, setAgentBusy]);

  useEffect(() => {
    return () => {
      setAgentBusy(false);
      setIsDeploying(false);
    };
  }, [setAgentBusy, setIsDeploying]);

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

  // Prompting is blocked while a deployment is running.
  const handleSendMessage = (
    content: string,
    attachment?: ChatImageAttachment,
  ) => {
    if (isDeploying) return;
    sendMessage(content, attachment);
  };

  const chatPanel = (
    <ChatPanel
      projectId={project}
      messages={messages}
      onSendMessage={handleSendMessage}
      isStreaming={isStreaming}
      isConnecting={isConnecting}
      isDeploying={isDeploying}
      initialMessage={isConnecting || hasHistory ? undefined : prompt}
      initialImage={isConnecting || hasHistory ? null : initialImage}
      agentStatus={agentStatus}
    />
  );

  const workspacePanel = connectionError ? (
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
  );

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] min-h-0 bg-background">
      {isDesktop ? (
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <div className="h-full flex-shrink-0">
            <ProjectSidebar activeProjectId={project} />
          </div>
          <div className="flex-1 min-w-0 min-h-0">
            <Group
              id="arena-desktop"
              orientation="horizontal"
              className="h-full w-full"
              defaultLayout={desktopLayout.defaultLayout}
              onLayoutChanged={desktopLayout.onLayoutChanged}
            >
              <Panel
                id="chat"
                defaultSize={420}
                minSize={320}
                maxSize="50%"
                className="border-r border-border flex flex-col min-h-0"
              >
                {chatPanel}
              </Panel>
              <Separator
                id="chat-separator"
                className="w-1.5 bg-border/40 transition-colors hover:bg-primary/30 data-[separator=active]:bg-primary/50 data-[separator=focus]:bg-primary/40"
                title="Drag to resize · double-click to reset"
              />
              <Panel id="workspace" className="flex flex-col min-h-0">
                {workspacePanel}
              </Panel>
            </Group>
          </div>
        </div>
      ) : (
        <Group
          id="arena-mobile"
          orientation="vertical"
          className="flex-1 min-h-0"
          defaultLayout={mobileLayout.defaultLayout}
          onLayoutChanged={mobileLayout.onLayoutChanged}
        >
          <Panel
            id="chat-mobile"
            defaultSize="45%"
            minSize="30%"
            maxSize="60%"
            className="border-b border-border flex flex-col min-h-0"
          >
            {chatPanel}
          </Panel>
          <Separator
            id="chat-separator-mobile"
            className="h-1.5 bg-border/40 transition-colors hover:bg-primary/30 data-[separator=active]:bg-primary/50 data-[separator=focus]:bg-primary/40"
            title="Drag to resize · double-click to reset"
          />
          <Panel id="workspace-mobile" className="flex flex-col min-h-0">
            {workspacePanel}
          </Panel>
        </Group>
      )}
    </div>
  );
}
