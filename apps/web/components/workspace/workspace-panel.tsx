"use client";

import { useState } from "react";
import { Monitor, Code, ExternalLink, RefreshCw } from "lucide-react";
import { WorkspaceProcessingScreen } from "./workspace-processing-screen";

interface WorkspacePanelProps {
  previewUrl: string | null;
  vscodeUrl: string | null;
  showProcessingScreen?: boolean;
  processingPrompt?: string;
  agentStatus?: string;
}

export function WorkspacePanel({
  previewUrl,
  vscodeUrl,
  showProcessingScreen = false,
  processingPrompt = "",
  agentStatus = "idle",
}: WorkspacePanelProps) {
  const [activeTab, setActiveTab] = useState<"preview" | "code">("preview");
  const [previewKey, setPreviewKey] = useState(0);
  const previewReady = Boolean(previewUrl) && !showProcessingScreen;

  const refreshPreview = () => {
    if (!previewReady) return;
    setPreviewKey((k) => k + 1);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex items-center justify-between border-b border-border bg-muted/30 px-2">
        <div className="flex">
          <button
            onClick={() => setActiveTab("preview")}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "preview"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Monitor className="h-3.5 w-3.5" />
            Preview
          </button>
          <button
            onClick={() => setActiveTab("code")}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "code"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Code className="h-3.5 w-3.5" />
            Code
          </button>
        </div>

        <div className="flex items-center gap-1">
          {activeTab === "preview" && previewReady && (
            <button
              onClick={refreshPreview}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Refresh preview"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          )}
          <a
            href={
              activeTab === "preview"
                ? previewReady
                  ? previewUrl || "#"
                  : "#"
                : vscodeUrl || "#"
            }
            target="_blank"
            rel="noopener noreferrer"
            className={`p-1.5 rounded-md transition-colors ${
              activeTab === "preview" && !previewReady
                ? "pointer-events-none text-muted-foreground/40"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
            title="Open in new tab"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {/* Iframe panels - both stay mounted so state is preserved */}
      <div className="relative flex-1 bg-background">
        {showProcessingScreen ? (
          <div
            className={`absolute inset-0 ${
              activeTab === "preview" ? "block" : "hidden"
            }`}
          >
            <WorkspaceProcessingScreen
              prompt={processingPrompt}
              agentStatus={agentStatus}
            />
          </div>
        ) : previewUrl ? (
          <iframe
            key={previewKey}
            src={previewUrl}
            className={`absolute inset-0 w-full h-full border-0 ${
              activeTab === "preview" ? "block" : "hidden"
            }`}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            title="App Preview"
          />
        ) : (
          <div
            className={`absolute inset-0 flex items-center justify-center text-muted-foreground ${
              activeTab === "preview" ? "flex" : "hidden"
            }`}
          >
            Waiting for sandbox to start...
          </div>
        )}

        {vscodeUrl ? (
          <iframe
            src={vscodeUrl}
            className={`absolute inset-0 w-full h-full border-0 ${
              activeTab === "code" ? "block" : "hidden"
            }`}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads allow-modals"
            title="VS Code Editor"
          />
        ) : (
          <div
            className={`absolute inset-0 flex items-center justify-center text-muted-foreground ${
              activeTab === "code" ? "flex" : "hidden"
            }`}
          >
            Waiting for VS Code to start...
          </div>
        )}
      </div>
    </div>
  );
}
