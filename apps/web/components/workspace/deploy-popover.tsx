"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Globe,
  Loader2,
  Lock,
  Rocket,
  X,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/popover";
import { cn } from "@repo/ui/lib/utils";
import {
  getProject,
  deployProject,
  pollDeployStatus,
  checkDeployStatus,
} from "@/lib/api";
import { getDeployUrl } from "@/lib/util";

type Phase =
  | "checking"
  | "confirm"
  | "deploying"
  | "deployed"
  | "uptodate"
  | "failed";

interface DeployPopoverProps {
  projectId: string;
  disabled?: boolean;
  onDeployStateChange?: (deploying: boolean) => void;
  onDeployed?: (url: string) => void;
  buttonClassName?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function DeployPopover({
  projectId,
  disabled,
  onDeployStateChange,
  onDeployed,
  buttonClassName,
}: DeployPopoverProps) {
  const [open, setOpen] = useState(false);
  const [prefix, setPrefix] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("checking");
  const [deployedUrl, setDeployedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    (async () => {
      try {
        const { project } = await getProject(projectId);
        if (active) {
          setPrefix(project?.deployPrefix ?? projectId);
        }
      } catch {
        if (active) setPrefix(projectId);
      }
    })();
    return () => {
      active = false;
    };
  }, [open, projectId]);

  const setDeployed = useCallback(
    (url: string | null) => {
      setDeployedUrl(url);
      if (url) onDeployed?.(url);
    },
    [onDeployed],
  );

  // Wait for a deployment that is already running to finish.
  const awaitDeployIdle = useCallback(async () => {
    for (;;) {
      const status = await checkDeployStatus(projectId);
      if (!status.inProgress) return status;
      await sleep(2000);
    }
  }, [projectId]);

  const applyCheckResult = useCallback(
    (status: { needsRedeploy: boolean; deployedUrl?: string }) => {
      setDeployed(status.deployedUrl ?? null);
      if (status.needsRedeploy) {
        setPhase("confirm");
      } else {
        setPhase("uptodate");
      }
    },
    [setDeployed],
  );

  const startDeploying = useCallback(async () => {
    setPhase("deploying");
    setError(null);
    onDeployStateChange?.(true);
    try {
      const result = await deployProject(projectId);

      // Nothing to build — the project is already up to date.
      if (result.status === "DEPLOYED") {
        setDeployed(result.deployedUrl ?? null);
        setPhase("uptodate");
        return;
      }

      if (result.status === "QUEUED" && result.deployId) {
        const final = await pollDeployStatus(projectId, result.deployId);
        if (final.status === "DEPLOYED") {
          setDeployed(final.deployedUrl ?? null);
          setPhase("deployed");
        } else {
          setError("Deployment failed. Please try again.");
          setPhase("failed");
        }
        return;
      }

      // Already queued/processing without a new deploy id — wait for it.
      const idle = await awaitDeployIdle();
      applyCheckResult(idle);
    } catch {
      setError("Deployment failed. Please try again.");
      setPhase("failed");
    } finally {
      onDeployStateChange?.(false);
    }
  }, [
    projectId,
    applyCheckResult,
    awaitDeployIdle,
    setDeployed,
    onDeployStateChange,
  ]);

  const runCheck = useCallback(async () => {
    setPhase("checking");
    setError(null);
    try {
      const status = await checkDeployStatus(projectId);
      if (status.inProgress) {
        onDeployStateChange?.(true);
        const idle = await awaitDeployIdle();
        onDeployStateChange?.(false);
        applyCheckResult(idle);
        return;
      }
      applyCheckResult(status);
    } catch {
      setError("Could not check deployment status.");
      setPhase("failed");
    }
  }, [projectId, awaitDeployIdle, applyCheckResult, onDeployStateChange]);

  // Kick off the status check every time the popover opens.
  useEffect(() => {
    if (open) {
      runCheck();
    }
  }, [open, runCheck]);

  const fullDomain = prefix ? getDeployUrl(prefix) : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          disabled={disabled}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors",
            buttonClassName,
          )}
        >
          {phase === "deploying" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Rocket className="h-3.5 w-3.5" />
          )}
          Deploy
        </button>
      </PopoverTrigger>

      <PopoverContent
        side="bottom"
        align="end"
        sideOffset={8}
        className="w-[340px] rounded-xl p-4 shadow-lg"
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Deploy your project
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Your site will be published to the domain below.
            </p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-2.5">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground">Prefix</span>
            <span className="text-sm font-medium font-mono text-foreground ml-auto">
              {prefix ?? projectId}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary shrink-0" />
            <span className="text-xs text-muted-foreground">Domain</span>
            <span className="text-sm font-medium font-mono text-primary ml-auto break-all text-right">
              {fullDomain ?? "…"}
            </span>
          </div>
        </div>

        <div className="mt-3">
          {phase === "checking" && (
            <div className="flex items-center justify-center gap-2 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Checking deployment status...
              </span>
            </div>
          )}

          {phase === "deploying" && (
            <div className="flex items-center justify-center gap-2 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm text-foreground">
                Deploying your project...
              </span>
            </div>
          )}

          {phase === "confirm" && (
            <div className="space-y-2">
              {deployedUrl && (
                <a
                  href={deployedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm border border-border text-foreground rounded-md hover:bg-muted transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  View current deployment
                </a>
              )}
              <button
                onClick={startDeploying}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                <Rocket className="h-3.5 w-3.5" />
                {deployedUrl ? "Redeploy" : "Deploy"}
              </button>
            </div>
          )}

          {phase === "deployed" && (
            <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3">
              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  Your project is live!
                </p>
                {deployedUrl ? (
                  <a
                    href={deployedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline break-all flex items-center gap-1 mt-1"
                  >
                    {deployedUrl}
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">
                    No URL available.
                  </p>
                )}
              </div>
            </div>
          )}

          {phase === "uptodate" && (
            <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3">
              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  You are all set!
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Your latest changes are already deployed.
                </p>
                {deployedUrl ? (
                  <a
                    href={deployedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline break-all flex items-center gap-1 mt-1"
                  >
                    {deployedUrl}
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                ) : null}
              </div>
            </div>
          )}

          {phase === "failed" && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-destructive">
                  Deployment failed
                </p>
                {error && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {error}
                  </p>
                )}
                <button
                  onClick={startDeploying}
                  className="mt-2 text-xs text-primary hover:underline"
                >
                  Try again
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-3">
          <button
            disabled
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm border border-border text-muted-foreground rounded-md opacity-60 cursor-not-allowed"
          >
            <Lock className="h-3.5 w-3.5" />
            Add custom domain
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70 ml-auto">
              Soon
            </span>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
