// TCC tracing — must initialize before any LangChain import below.
import "./observability/tcc.js";

import type { StreamChunk } from "@repo/common/types";
import type {
  OrchestratorConfig,
  ChatCompletionMessageParam,
} from "@repo/orchestrator/types";
import { SandboxManager } from "@repo/orchestrator/sandbox";
import { ProjectStorage } from "@repo/orchestrator/storage";
import { ProjectDeployer } from "@repo/orchestrator/deploy";
import { ContextManager } from "@repo/orchestrator/context";
import { classifyIntent } from "@repo/orchestrator/intent";
import { runAgentLoopLG } from "./agent/runLoop.js";

export class OrchestratorLG {
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
    console.log("OrchestratorLG started");
  }

  async shutdown(): Promise<void> {
    await this.sandboxManager.shutdownAll();
    console.log("OrchestratorLG shut down");
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
    userId?: string;
  }): Promise<ChatCompletionMessageParam[] | undefined> {
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

    try {
      const updatedMessages = await runAgentLoopLG({
        apiKeys: this.config.openRouterApiKey
          .split(/[,\n]/)
          .map((k) => k.trim())
          .filter(Boolean),
        messages: llmMessages,
        sandbox: entry.sandbox,
        projectBasePath: this.config.projectBasePath,
        onStream: params.onStream,
        consoleLogs: params.consoleLogs,
        networkRequests: params.networkRequests,
        contextManager,
        projectId: params.projectId,
        userId: params.userId,
      });

      if (!updatedMessages) return params.conversationHistory;
      const newMessages = updatedMessages.slice(
        params.conversationHistory.length,
      );
      return [...params.conversationHistory, ...newMessages];
    } catch (err) {
      console.log("error occured here in index.ts", err);
      return params.conversationHistory;
    }
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
} from "@repo/orchestrator/types";
