import { Sandbox } from "e2b";
import type { SandboxEntry, OrchestratorConfig } from "../types/index.js";
import { ProjectStorage } from "../storage/s3.js";

const VITE_PORT = 5173;
const VSCODE_PORT = 3000;

export class SandboxManager {
  private activeSandboxes: Map<string, SandboxEntry> = new Map();
  private storage: ProjectStorage;
  private config: OrchestratorConfig;
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config: OrchestratorConfig, storage: ProjectStorage) {
    this.config = config;
    this.storage = storage;
  }

  async getOrCreateSandbox(projectId: string): Promise<SandboxEntry> {
    const existing = this.activeSandboxes.get(projectId);
    if (existing) {
      try {
        // Check if sandbox is still alive by running a simple command
        await existing.sandbox.commands.run("echo alive", { timeoutMs: 5000 });
        return existing;
      } catch {
        // Sandbox is dead, remove it and create new
        this.activeSandboxes.delete(projectId);
      }
    }

    const sandbox = await Sandbox.create(this.config.sandboxTemplate, {
      apiKey: this.config.e2bApiKey,
      timeoutMs: this.config.sandboxTimeoutMs,
    });

    // Restore project files from S3 (if they exist)
    const restored = await this.storage.restoreProject(sandbox, projectId);

    if (!restored) {
      // New project - the template already has a base React+Vite setup
      // No extra setup needed since the E2B template includes everything
      console.log(`New project ${projectId}, using template defaults`);
    }

    // Run the template's start script (installs deps, starts Vite + OpenVSCode Server)
    await sandbox.commands.run("bash /home/user/start.sh", {
      background: true,
    });

    // Wait for services to come up
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const previewHost = sandbox.getHost(VITE_PORT);
    const vscodeHost = sandbox.getHost(VSCODE_PORT);

    const entry: SandboxEntry = {
      sandbox,
      projectId,
      previewUrl: `https://${previewHost}`,
      vscodeUrl: `https://${vscodeHost}`,
      createdAt: new Date(),
      lastHeartbeat: new Date(),
    };

    this.activeSandboxes.set(projectId, entry);
    return entry;
  }

  async heartbeat(projectId: string): Promise<boolean> {
    const entry = this.activeSandboxes.get(projectId);
    if (!entry) return false;

    entry.lastHeartbeat = new Date();

    try {
      await entry.sandbox.setTimeout(this.config.sandboxTimeoutMs);
      return true;
    } catch {
      // Sandbox may have already died
      this.activeSandboxes.delete(projectId);
      return false;
    }
  }

  async persistAndScheduleShutdown(projectId: string): Promise<void> {
    const entry = this.activeSandboxes.get(projectId);
    if (!entry) return;

    try {
      await this.storage.persistProject(entry.sandbox, projectId);
      console.log(`Persisted project ${projectId} to S3`);
    } catch (err) {
      console.error(`Failed to persist project ${projectId}:`, err);
    }

    // Set a short timeout - sandbox will die soon
    try {
      await entry.sandbox.setTimeout(5 * 60 * 1000); // 5 minutes
    } catch {
      // Already dead
    }
  }

  async shutdownSandbox(projectId: string): Promise<void> {
    const entry = this.activeSandboxes.get(projectId);
    if (!entry) return;

    try {
      // Persist files to S3 before killing
      await this.storage.persistProject(entry.sandbox, projectId);
      console.log(`Persisted project ${projectId} before shutdown`);
    } catch (err) {
      console.error(`Failed to persist project ${projectId} on shutdown:`, err);
    }

    try {
      await entry.sandbox.kill();
    } catch {
      // Already dead
    }

    this.activeSandboxes.delete(projectId);
    console.log(`Sandbox for project ${projectId} shut down`);
  }

  getSandbox(projectId: string): SandboxEntry | undefined {
    return this.activeSandboxes.get(projectId);
  }

  startHealthCheckLoop(): void {
    this.healthCheckInterval = setInterval(async () => {
      const now = Date.now();

      for (const [projectId, entry] of this.activeSandboxes) {
        const timeSinceHeartbeat = now - entry.lastHeartbeat.getTime();

        if (timeSinceHeartbeat > this.config.heartbeatTimeoutMs) {
          console.log(
            `Sandbox for project ${projectId} timed out ` +
              `(${Math.round(timeSinceHeartbeat / 1000)}s since last heartbeat)`,
          );
          await this.shutdownSandbox(projectId);
        }
      }
    }, 60_000); // Check every minute
  }

  stopHealthCheckLoop(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  async shutdownAll(): Promise<void> {
    this.stopHealthCheckLoop();

    const shutdowns = Array.from(this.activeSandboxes.keys()).map((projectId) =>
      this.shutdownSandbox(projectId),
    );

    await Promise.allSettled(shutdowns);
  }
}
