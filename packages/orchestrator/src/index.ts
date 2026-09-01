import type { StreamChunk } from "@repo/common/types";
import type {
  OrchestratorConfig,
  ChatCompletionMessageParam,
} from "./types/index.js";
import { SandboxManager } from "./sandbox/manager.js";
import { ProjectArtifactManager } from "./storage/project-artifact-manager.js";
import { LlmManager } from "./llm/llm-manager.js";

export class Orchestrator {
  private sandboxManager: SandboxManager;
  private projectArtifacts: ProjectArtifactManager;
  private llmManager: LlmManager;
  private config: OrchestratorConfig;

  constructor(config: OrchestratorConfig) {
    this.config = config;

    this.projectArtifacts = new ProjectArtifactManager(config.objectStore);

    this.sandboxManager = new SandboxManager(config, this.projectArtifacts);
    this.llmManager = new LlmManager({
      openRouterApiKey: config.openRouterApiKey,
      projectBasePath: config.projectBasePath,
    });
  }

  start(): void {
    this.sandboxManager.startHealthCheckLoop();
    console.log("Orchestrator started");
  }

  async shutdown(): Promise<void> {
    await this.sandboxManager.shutdownAll();
    console.log("Orchestrator shut down");
  }

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

  async handleUserMessage(params: {
    projectId: string;
    message: string;
    conversationHistory: ChatCompletionMessageParam[];
    onStream: (chunk: StreamChunk) => void;
    onComplete?: (
      messages: ChatCompletionMessageParam[],
    ) => void | Promise<void>;
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

    return this.llmManager.handleUserMessage({
      projectId: params.projectId,
      message: params.message,
      conversationHistory: params.conversationHistory,
      sandbox: entry.sandbox,
      onStream: params.onStream,
      onComplete: params.onComplete,
      consoleLogs: params.consoleLogs,
      networkRequests: params.networkRequests,
    });
  }

  async prettifyPrompt(params: {
    message: string;
    conversationHistory: ChatCompletionMessageParam[];
  }): Promise<string> {
    return this.llmManager.prettifyPrompt({
      conversationHistory: params.conversationHistory,
      message: params.message,
    });
  }

  async heartbeat(projectId: string): Promise<boolean> {
    return this.sandboxManager.heartbeat(projectId);
  }

  async persistProject(projectId: string): Promise<void> {
    await this.sandboxManager.persistAndScheduleShutdown(projectId);
  }

  getSandboxId(projectId: string): string | undefined {
    return this.sandboxManager.getSandbox(projectId)?.sandbox.sandboxId;
  }

  async deployProject(projectId: string): Promise<string> {
    const entry = this.sandboxManager.getSandbox(projectId);
    if (!entry) {
      throw new Error("No active sandbox for deployment");
    }

    return this.projectArtifacts.deployProject(
      entry.sandbox,
      projectId,
      this.config.projectBasePath,
    );
  }

  getSandboxManager(): SandboxManager {
    return this.sandboxManager;
  }
}
