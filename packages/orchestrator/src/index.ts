import type { StreamChunk } from "@repo/common/types";
import type {
  OrchestratorConfig,
  ChatCompletionMessageParam,
} from "./types/index.js";
import { SandboxManager } from "./sandbox/manager.js";
import { ProjectStorage } from "./storage/s3.js";
import { ProjectDeployer } from "./deploy/deployer.js";
import { runAgentLoop } from "./agent/loop.js";

export class Orchestrator {
  private sandboxManager: SandboxManager;
  private storage: ProjectStorage;
  private deployer: ProjectDeployer;
  private config: OrchestratorConfig;

  constructor(config: OrchestratorConfig) {
    this.config = config;

    this.storage = new ProjectStorage({
      region: config.s3Region,
      bucket: config.s3Bucket,
      accessKeyId: config.awsAccessKeyId,
      secretAccessKey: config.awsSecretAccessKey,
    });

    this.sandboxManager = new SandboxManager(config, this.storage);

    this.deployer = new ProjectDeployer({
      region: config.s3Region,
      bucket: config.s3Bucket,
      accessKeyId: config.awsAccessKeyId,
      secretAccessKey: config.awsSecretAccessKey,
    });
  }

  /**
   * Initialize the orchestrator - start health check loop.
   */
  start(): void {
    this.sandboxManager.startHealthCheckLoop();
    console.log("Orchestrator started");
  }

  /**
   * Shutdown all sandboxes and stop the health check loop.
   */
  async shutdown(): Promise<void> {
    await this.sandboxManager.shutdownAll();
    console.log("Orchestrator shut down");
  }

  /**
   * Create or resume a sandbox for a project.
   * Returns sandbox info including preview and VS Code URLs.
   */
  async createSandbox(projectId: string): Promise<{
    previewUrl: string;
    vscodeUrl: string;
    sandboxId: string;
  }> {
    const entry = await this.sandboxManager.getOrCreateSandbox(projectId);
    return {
      previewUrl: entry.previewUrl,
      vscodeUrl: entry.vscodeUrl,
      sandboxId: entry.sandbox.sandboxId,
    };
  }

  /**
   * Handle a user message - runs the AI agent loop.
   * Streams results back via the onStream callback.
   */
  async handleUserMessage(params: {
    projectId: string;
    message: string;
    model?: string;
    conversationHistory: ChatCompletionMessageParam[];
    onStream: (chunk: StreamChunk) => void;
    consoleLogs?: string[];
    networkRequests?: string[];
  }): Promise<ChatCompletionMessageParam[]> {
    const entry = this.sandboxManager.getSandbox(params.projectId);
    if (!entry) {
      params.onStream({
        type: "error",
        message:
          "No active sandbox found for this project. Please refresh to reconnect.",
      });
      return params.conversationHistory;
    }

    // Add the new user message to history
    const messages: ChatCompletionMessageParam[] = [
      ...params.conversationHistory,
      { role: "user", content: params.message },
    ];

    // Run the agent loop
    const updatedMessages = await runAgentLoop({
      openRouterApiKey: this.config.openRouterApiKey,
      model: params.model || this.config.defaultModel,
      messages,
      sandbox: entry.sandbox,
      projectBasePath: this.config.projectBasePath,
      onStream: params.onStream,
      consoleLogs: params.consoleLogs,
      networkRequests: params.networkRequests,
    });

    return updatedMessages;
  }

  /**
   * Extend sandbox lifetime via heartbeat.
   */
  async heartbeat(projectId: string): Promise<boolean> {
    return this.sandboxManager.heartbeat(projectId);
  }

  /**
   * Persist project and schedule sandbox for shutdown.
   */
  async persistProject(projectId: string): Promise<void> {
    await this.sandboxManager.persistAndScheduleShutdown(projectId);
  }

  /**
   * Build and deploy a project.
   */
  async deployProject(projectId: string): Promise<string> {
    const entry = this.sandboxManager.getSandbox(projectId);
    if (!entry) {
      throw new Error("No active sandbox for deployment");
    }

    return this.deployer.deploy(
      entry.sandbox,
      projectId,
      this.config.projectBasePath,
    );
  }

  /**
   * Get the sandbox manager for direct access.
   */
  getSandboxManager(): SandboxManager {
    return this.sandboxManager;
  }
}

// Re-export types and classes
export type {
  OrchestratorConfig,
  ChatCompletionMessageParam,
} from "./types/index.js";
export { SandboxManager } from "./sandbox/manager.js";
export { ProjectStorage } from "./storage/s3.js";
export { ProjectDeployer } from "./deploy/deployer.js";
