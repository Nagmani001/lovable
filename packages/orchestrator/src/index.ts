import type { StreamChunk } from "@repo/common/types";
import type {
  OrchestratorConfig,
  ChatCompletionMessageParam,
} from "./types/index.js";
import { SandboxManager } from "./sandbox/manager.js";
import { ProjectStorage } from "./storage/s3.js";
import { ProjectDeployer } from "./deploy/deployer.js";
import { runAgentLoop } from "./agent/loop.js";
import { ContextManager } from "./context/context-manager.js";
import { classifyIntent } from "./context/intent-classifier.js";

export class Orchestrator {
  private sandboxManager: SandboxManager;
  private storage: ProjectStorage;
  private deployer: ProjectDeployer;
  private config: OrchestratorConfig;
  private contextManagers: Map<string, ContextManager> = new Map();

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

    let contextManager = this.contextManagers.get(params.projectId);
    if (!contextManager) {
      contextManager = ContextManager.createFromBaseline();
      this.contextManagers.set(params.projectId, contextManager);
    }

    // NOTE: The router saves the current user message to DB *before* calling
    // handleUserMessage, so conversationHistory always has ≥1 entry. We detect
    // the first turn by the absence of any assistant message in history.
    const isFirstTurn = !params.conversationHistory.some(
      (m) => m.role === "assistant",
    );
    const usefulContext = isFirstTurn
      ? contextManager.generateInitializationContext()
      : contextManager.generateContext(
          classifyIntent(params.message),
          params.message,
        );

    const lastUserIdx = params.conversationHistory.reduce(
      (acc, msg, idx) => (msg.role === "user" ? idx : acc),
      -1,
    );

    const llmMessages: ChatCompletionMessageParam[] =
      params.conversationHistory.map((msg, idx) => {
        if (idx === lastUserIdx && typeof msg.content === "string") {
          return { ...msg, content: `${usefulContext}\n\n${msg.content}` };
        }
        return msg;
      });

    const updatedMessages = await runAgentLoop({
      openRouterApiKey: this.config.openRouterApiKey,
      messages: llmMessages,
      sandbox: entry.sandbox,
      projectBasePath: this.config.projectBasePath,
      onStream: params.onStream,
      consoleLogs: params.consoleLogs,
      networkRequests: params.networkRequests,
      contextManager,
    });

    const newMessages = updatedMessages.slice(
      params.conversationHistory.length,
    );
    return [...params.conversationHistory, ...newMessages];
  }

  async heartbeat(projectId: string): Promise<boolean> {
    return this.sandboxManager.heartbeat(projectId);
  }

  async persistProject(projectId: string): Promise<void> {
    await this.sandboxManager.persistAndScheduleShutdown(projectId);
  }

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

  getSandboxManager(): SandboxManager {
    return this.sandboxManager;
  }
}

export type {
  OrchestratorConfig,
  ChatCompletionMessageParam,
} from "./types/index.js";
export { SandboxManager } from "./sandbox/manager.js";
export { ProjectStorage } from "./storage/s3.js";
export { ProjectDeployer } from "./deploy/deployer.js";
