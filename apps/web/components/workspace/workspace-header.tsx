"use client";

import { ArrowLeft, Rocket, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { deployProject } from "@/lib/api";
import type { ToolCallInfo } from "@/hooks/use-chat";

interface WorkspaceHeaderProps {
  projectId: string;
  agentStatus: string;
  activeToolCalls: ToolCallInfo[];
}

export function WorkspaceHeader({
  projectId,
  agentStatus,
  activeToolCalls,
}: WorkspaceHeaderProps) {
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployedUrl, setDeployedUrl] = useState<string | null>(null);

  const handleDeploy = async () => {
    try {
      setIsDeploying(true);
      const result = await deployProject(projectId);
      setDeployedUrl(result.deployedUrl);
    } catch (err) {
      console.error("Deploy failed:", err);
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <header className="h-12 border-b border-border bg-background flex items-center justify-between px-4">
      <div className="flex items-center gap-3">
        <Link
          href="/projects"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>

        <span className="text-sm font-medium">Project</span>

        {/* Agent activity indicator */}
        {agentStatus !== "idle" && agentStatus !== "done" && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>
              {agentStatus === "thinking" && "Thinking..."}
              {agentStatus === "writing" && "Writing code..."}
            </span>
          </div>
        )}

        {/* Active tool calls */}
        {activeToolCalls.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {activeToolCalls.map((tc) => (
              <span
                key={tc.name}
                className="bg-muted px-1.5 py-0.5 rounded text-[10px]"
              >
                {tc.name}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {deployedUrl && (
          <a
            href={deployedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline"
          >
            {deployedUrl}
          </a>
        )}

        <button
          onClick={handleDeploy}
          disabled={isDeploying}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {isDeploying ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Rocket className="h-3.5 w-3.5" />
          )}
          Deploy
        </button>
      </div>
    </header>
  );
}
