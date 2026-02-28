// ═══════════════════════════════════════
// Stream chunks: Backend → Frontend (SSE)
// ═══════════════════════════════════════

export interface TextStreamChunk {
  type: "text";
  content: string;
}

export interface FileChangeEvent {
  type: "file_change";
  action: "write" | "update" | "delete" | "rename";
  path: string;
  from?: string;
}

export interface ToolCallEvent {
  type: "tool_call";
  name: string;
  status: "started" | "completed" | "failed";
  args?: Record<string, unknown>;
  result?: string;
}

export interface TerminalOutput {
  type: "terminal";
  content: string;
}

export interface AgentStatusEvent {
  type: "status";
  status: "thinking" | "writing" | "done" | "error";
  message?: string;
}

export interface SandboxReadyEvent {
  type: "sandbox_ready";
  previewUrl: string;
  vscodeUrl: string;
  projectId: string;
}

export interface ErrorEvent {
  type: "error";
  message: string;
}

export type StreamChunk =
  | TextStreamChunk
  | FileChangeEvent
  | ToolCallEvent
  | TerminalOutput
  | AgentStatusEvent
  | SandboxReadyEvent
  | ErrorEvent;

// ═══════════════════════════════════════
// Sandbox info returned to frontend
// ═══════════════════════════════════════

export interface SandboxInfo {
  sandboxId: string;
  projectId: string;
  previewUrl: string;
  vscodeUrl: string;
  createdAt: string;
}

// ═══════════════════════════════════════
// Project API responses
// ═══════════════════════════════════════

export interface CreateProjectResponse {
  projectId: string;
  previewUrl: string;
  vscodeUrl: string;
}

export interface ProjectDetails {
  id: string;
  title: string;
  initialPrompt: string;
  status: string;
  deployedUrl: string | null;
  lastSavedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ═══════════════════════════════════════
// Conversation history
// ═══════════════════════════════════════

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  type: "text" | "tool_call";
  toolCall?: string;
  createdAt: string;
}
