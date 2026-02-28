import type { Sandbox } from "e2b";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";

export type { ChatCompletionMessageParam, ChatCompletionTool };

export interface SandboxEntry {
  sandbox: Sandbox;
  projectId: string;
  previewUrl: string;
  vscodeUrl: string;
  createdAt: Date;
  lastHeartbeat: Date;
}

export interface OrchestratorConfig {
  e2bApiKey: string;
  openRouterApiKey: string;
  defaultModel: string;
  s3Bucket: string;
  s3Region: string;
  awsAccessKeyId: string;
  awsSecretAccessKey: string;
  sandboxTemplate: string;
  sandboxTimeoutMs: number;
  heartbeatTimeoutMs: number;
  projectBasePath: string;
}

export interface HandleMessageParams {
  projectId: string;
  sandboxId: string;
  message: string;
  conversationHistory: ChatCompletionMessageParam[];
  onStream: (chunk: import("@repo/common/types").StreamChunk) => void;
}

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required: string[];
    };
  };
}
