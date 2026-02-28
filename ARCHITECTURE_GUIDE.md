# Lovable Clone - Complete Architecture & Implementation Guide

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [How It All Works End-to-End](#2-how-it-all-works-end-to-end)
3. [The Orchestrator (Brain)](#3-the-orchestrator)
4. [Tool Calls Explained](#4-tool-calls-explained)
5. [E2B Sandbox Management](#5-e2b-sandbox-management)
6. [S3 Backup & Restore](#6-s3-backup--restore)
7. [Sandbox Lifecycle & Heartbeat](#7-sandbox-lifecycle--heartbeat)
8. [Frontend ↔ Backend Communication (SSE vs WebSocket vs HTTP)](#8-frontend--backend-communication)
9. [VS Code in the Browser](#9-vs-code-in-the-browser)
10. [Deployment](#10-deployment)
11. [Implementation Plan (Step by Step)](#11-implementation-plan)

---

## 1. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│  Frontend (Next.js)                                                  │
│                                                                      │
│  ┌──────────────┐  ┌─────────────────────────────────────────────┐  │
│  │  Chat Panel   │  │  Workspace (Tabbed)                         │  │
│  │              │  │  [Preview] [Code]                            │  │
│  │  POST /chat  │  │                                              │  │
│  │  ← SSE stream│  │  Preview iframe ──► sandbox:5173 (Vite)     │  │
│  │              │  │  Code iframe ────► sandbox:3000 (VS Code)   │  │
│  └──────┬───────┘  └─────────────────────────────────────────────┘  │
│         │                                                            │
└─────────┼────────────────────────────────────────────────────────────┘
          │ HTTP POST + SSE stream
          ▼
┌──────────────────┐
│  Primary Backend  │
│    (Express)      │──── POST /heartbeat (keep sandbox alive)
│                   │──── POST /persist   (save to S3 on tab close)
└────────┬─────────┘
         │
┌────────▼───────────┐
│   Orchestrator      │
│  (AI Agent Loop)    │
│                     │
│  system prompt ◄── agent_prompt.txt
│  tools       ◄── agent_tools.json
└───┬────────┬───────┘
    │        │
┌───▼─────┐ ┌▼────────────┐
│ E2B     │ │  Object      │
│ Sandbox │ │  Store (S3)  │
│ (Worker)│ │              │
│         │ └──────────────┘
│ :5173 Vite dev server
│ :3000 VS Code (OpenVSCode Server)
└─────────┘
```

### Components and Their Roles

| Component                | Role                                                               | Technology                               |
| ------------------------ | ------------------------------------------------------------------ | ---------------------------------------- |
| **Frontend**             | Chat UI, preview iframe, VS Code iframe, project management        | Next.js 16, React 19, SSE                |
| **Primary Backend**      | Auth, project CRUD, SSE streaming, heartbeat                       | Express 5, better-auth, Prisma           |
| **Orchestrator**         | AI agent loop - takes user prompts, calls LLM, executes tool calls | TypeScript service, Anthropic/OpenAI SDK |
| **E2B Sandbox (Worker)** | Isolated Linux VM running Vite dev server + VS Code server         | E2B SDK                                  |
| **Object Store (S3)**    | Persistent storage for project files between sessions              | AWS S3 / MinIO                           |
| **Load Balancer**        | Routes traffic, health checks                                      | Nginx / AWS ALB                          |

---

## 2. How It All Works End-to-End

Here's the complete flow when a user types "Build me a todo app":

### Step 1: User Creates a Project

```
Frontend → POST /api/v1/project → Backend
                                     │
                                     ├── Creates Project record in DB
                                     ├── Creates E2B sandbox
                                     ├── Restores files from S3 (if existing project)
                                     ├── Starts Vite dev server in sandbox
                                     └── Returns { projectId, sandboxId, previewUrl }
```

### Step 2: User Sends a Prompt

```
Frontend → WebSocket message: { type: "chat", content: "Build me a todo app" }
         │
         ▼
Backend receives message
         │
         ├── Saves message to ConversationHistory (from: USER, type: TEXT_MESSAGE)
         │
         ▼
Backend forwards to Orchestrator
         │
         ▼
Orchestrator builds the LLM request:
  - System prompt (agent_prompt.txt)
  - Tool definitions (agent_tools.json converted to LLM tool format)
  - Conversation history
  - Current file context
         │
         ▼
Orchestrator calls LLM (Claude/GPT)
```

### Step 3: The Agent Loop (This is the core magic)

```
┌─────────────────────────────────────────────────────┐
│                   AGENT LOOP                         │
│                                                      │
│  1. Send messages + tools to LLM                     │
│  2. LLM responds with either:                        │
│     a) Text → Stream to frontend, save to DB         │
│     b) Tool calls → Execute them, loop back to 1     │
│  3. Repeat until LLM gives final text response       │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Step 4: Tool Execution (e.g., LLM wants to write a file)

```
LLM Response: {
  tool_calls: [{
    name: "lov-write",
    arguments: {
      file_path: "src/components/TodoList.tsx",
      content: "import React from 'react';\n..."
    }
  }]
}
         │
         ▼
Orchestrator receives tool call
         │
         ├── Executes: sandbox.files.write("src/components/TodoList.tsx", content)
         ├── Streams file change event to frontend via WebSocket
         ├── Saves to ConversationHistory (type: TOOL_CALL)
         │
         ▼
Tool result sent back to LLM as next message
         │
         ▼
LLM continues (may make more tool calls or give final response)
```

### Step 5: Live Preview Updates

```
E2B Sandbox:
  - Vite dev server is running on a port
  - E2B provides a public URL for that port
  - Frontend embeds this URL in an iframe
  - When files change → Vite HMR automatically updates the preview
```

---

## 3. The Orchestrator

The orchestrator is the **brain** of the system. It sits between the user and the E2B sandbox, using an LLM to decide what actions to take.

### Core Architecture

```typescript
// apps/orchestrator/src/index.ts

// The orchestrator is NOT a standalone HTTP server.
// It's a library/service that the primary backend calls.
// Think of it as an "agent runner" that the backend invokes.

export class Orchestrator {
  private llmClient: AnthropicClient | OpenAIClient;
  private sandboxManager: SandboxManager;
  private s3Client: S3Client;

  // Called when user sends a message
  async handleUserMessage(params: {
    projectId: string;
    sandboxId: string;
    message: string;
    conversationHistory: ConversationMessage[];
    onStream: (chunk: StreamChunk) => void; // WebSocket streamer
  }): Promise<void> {
    // 1. Build the messages array for the LLM
    // 2. Run the agent loop
    // 3. Stream results back via onStream callback
  }
}
```

### The Agent Loop in Detail

```typescript
async runAgentLoop(params: {
  messages: LLMMessage[];
  tools: ToolDefinition[];
  sandbox: E2BSandbox;
  onStream: (chunk: StreamChunk) => void;
}): Promise<LLMMessage[]> {

  let messages = [...params.messages];
  let continueLoop = true;

  while (continueLoop) {
    // 1. Call the LLM with streaming
    const response = await this.llmClient.chat({
      model: "claude-sonnet-4-20250514",
      system: this.systemPrompt,   // agent_prompt.txt
      messages: messages,
      tools: this.toolDefinitions, // agent_tools.json → converted
      stream: true,
    });

    // 2. Process the streamed response
    let assistantMessage = { role: "assistant", content: [] };
    let hasToolCalls = false;

    for await (const event of response) {
      if (event.type === "content_block_delta") {
        if (event.delta.type === "text_delta") {
          // Stream text to frontend in real-time
          params.onStream({
            type: "text",
            content: event.delta.text
          });
        }
      }

      if (event.type === "content_block_stop") {
        if (event.content_block.type === "tool_use") {
          hasToolCalls = true;
        }
      }
    }

    // 3. Collect the full response
    assistantMessage = response.finalMessage;
    messages.push(assistantMessage);

    // 4. If there are tool calls, execute them
    if (hasToolCalls) {
      const toolResults = [];

      for (const toolCall of assistantMessage.content.filter(c => c.type === "tool_use")) {
        // Execute the tool against the E2B sandbox
        const result = await this.executeTool(
          toolCall.name,
          toolCall.input,
          params.sandbox,
          params.onStream
        );

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolCall.id,
          content: result,
        });
      }

      // 5. Add tool results and loop back
      messages.push({ role: "user", content: toolResults });

    } else {
      // No tool calls = LLM is done, exit the loop
      continueLoop = false;
    }
  }

  return messages;
}
```

### How agent_prompt.txt and agent_tools.json Are Used

**agent_prompt.txt** → Becomes the `system` parameter in the LLM API call. It tells the AI:

- What it is (Lovable, an AI web editor)
- What tech stack to use (React, Vite, Tailwind, TypeScript)
- Design guidelines, workflow rules, etc.

**agent_tools.json** → Gets converted to the LLM's tool format. Each tool in the JSON becomes a callable function the AI can invoke:

```typescript
// Converting agent_tools.json to Anthropic tool format:
function convertTools(agentTools: Record<string, ToolDef>): AnthropicTool[] {
  return Object.entries(agentTools).map(([name, tool]) => ({
    name: name,
    description: tool.description,
    input_schema: {
      type: "object",
      properties: tool.parameters.properties,
      required: tool.parameters.required,
    },
  }));
}

// Result: The LLM sees tools like "lov-write", "lov-view", "lov-search-files", etc.
// When it wants to write a file, it returns a tool_call with name "lov-write"
// and arguments { file_path: "...", content: "..." }
```

---

## 4. Tool Calls Explained

### What Is a Tool Call?

A tool call is when the LLM says "I need to perform an action." Instead of returning plain text, it returns a structured request:

```json
{
  "type": "tool_use",
  "id": "toolu_abc123",
  "name": "lov-write",
  "input": {
    "file_path": "src/App.tsx",
    "content": "import React from 'react';\n\nfunction App() {\n  return <div>Hello</div>;\n}\n\nexport default App;"
  }
}
```

### How Tool Calls Bridge to the E2B Sandbox

The orchestrator has a **tool executor** that maps each tool name to an E2B sandbox operation:

```typescript
// apps/orchestrator/src/tools/executor.ts

export class ToolExecutor {
  constructor(private sandbox: E2BSandbox) {}

  async execute(
    toolName: string,
    args: Record<string, any>,
    onStream: (chunk: StreamChunk) => void,
  ): Promise<string> {
    switch (toolName) {
      // ═══════════════════════════════════════
      // FILE OPERATIONS → E2B Filesystem API
      // ═══════════════════════════════════════

      case "lov-write": {
        const { file_path, content } = args;
        // Write file to E2B sandbox filesystem
        await this.sandbox.files.write(file_path, content);
        // Notify frontend about the file change
        onStream({
          type: "file_change",
          action: "write",
          path: file_path,
        });
        return `File written: ${file_path}`;
      }

      case "lov-view": {
        const { file_path, lines } = args;
        // Read file from E2B sandbox
        const content = await this.sandbox.files.read(file_path);
        // Optionally slice lines
        if (lines) {
          return sliceLines(content, lines);
        }
        return content;
      }

      case "lov-delete": {
        const { file_path } = args;
        await this.sandbox.files.remove(file_path);
        onStream({
          type: "file_change",
          action: "delete",
          path: file_path,
        });
        return `File deleted: ${file_path}`;
      }

      case "lov-rename": {
        const { original_file_path, new_file_path } = args;
        const content = await this.sandbox.files.read(original_file_path);
        await this.sandbox.files.write(new_file_path, content);
        await this.sandbox.files.remove(original_file_path);
        onStream({
          type: "file_change",
          action: "rename",
          from: original_file_path,
          to: new_file_path,
        });
        return `File renamed: ${original_file_path} → ${new_file_path}`;
      }

      case "lov-line-replace": {
        const {
          file_path,
          search,
          first_replaced_line,
          last_replaced_line,
          replace,
        } = args;
        const content = await this.sandbox.files.read(file_path);
        const lines = content.split("\n");
        // Replace the specified line range
        lines.splice(
          first_replaced_line - 1,
          last_replaced_line - first_replaced_line + 1,
          ...replace.split("\n"),
        );
        const newContent = lines.join("\n");
        await this.sandbox.files.write(file_path, newContent);
        onStream({
          type: "file_change",
          action: "update",
          path: file_path,
        });
        return `Lines ${first_replaced_line}-${last_replaced_line} replaced in ${file_path}`;
      }

      case "lov-search-files": {
        const { query, include_pattern, exclude_pattern, case_sensitive } =
          args;
        // Use E2B process to run ripgrep or grep in the sandbox
        const result = await this.sandbox.commands.run(
          `grep -r${case_sensitive ? "" : "i"} "${query}" --include="${include_pattern}" ${exclude_pattern ? `--exclude="${exclude_pattern}"` : ""} .`,
        );
        return result.stdout || "No results found";
      }

      // ═══════════════════════════════════════
      // DEPENDENCY MANAGEMENT → E2B Process API
      // ═══════════════════════════════════════

      case "lov-add-dependency": {
        const { package: pkg } = args;
        const result = await this.sandbox.commands.run(`npm install ${pkg}`);
        onStream({
          type: "terminal",
          content: result.stdout,
        });
        return result.stdout;
      }

      case "lov-remove-dependency": {
        const { package: pkg } = args;
        const result = await this.sandbox.commands.run(`npm uninstall ${pkg}`);
        return result.stdout;
      }

      // ═══════════════════════════════════════
      // COPY & DOWNLOAD
      // ═══════════════════════════════════════

      case "lov-copy": {
        const { source_file_path, destination_file_path } = args;
        const content = await this.sandbox.files.read(source_file_path);
        await this.sandbox.files.write(destination_file_path, content);
        return `Copied ${source_file_path} → ${destination_file_path}`;
      }

      case "lov-download-to-repo": {
        const { source_url, target_path } = args;
        // Download file using curl/wget inside the sandbox
        await this.sandbox.commands.run(
          `curl -o ${target_path} "${source_url}"`,
        );
        return `Downloaded ${source_url} → ${target_path}`;
      }

      // ═══════════════════════════════════════
      // CONSOLE & NETWORK (Requires browser integration)
      // ═══════════════════════════════════════

      case "lov-read-console-logs": {
        // These come from the frontend's iframe
        // The frontend captures console.log from the preview
        // and sends them back via WebSocket
        // For now, return stored logs
        return this.getStoredConsoleLogs(args.search);
      }

      case "lov-read-network-requests": {
        return this.getStoredNetworkRequests(args.search);
      }

      // ═══════════════════════════════════════
      // WEB SEARCH & FETCH (External APIs)
      // ═══════════════════════════════════════

      case "websearch--web_search": {
        // Use a search API (Brave, Serper, Tavily, etc.)
        return await this.webSearch(args.query, args.numResults);
      }

      case "lov-fetch-website": {
        // Fetch and convert website to markdown
        return await this.fetchWebsite(args.url, args.formats);
      }

      default:
        return `Unknown tool: ${toolName}`;
    }
  }
}
```

### The Complete Tool Call Flow

```
LLM says: "I'll create the TodoList component"
    │
    ▼ tool_call: lov-write { file_path: "src/components/TodoList.tsx", content: "..." }
    │
    ▼ Orchestrator receives tool call
    │
    ▼ ToolExecutor.execute("lov-write", {...})
    │
    ▼ sandbox.files.write("src/components/TodoList.tsx", content)
    │   ┌──────────────────────────────────────┐
    │   │ E2B Sandbox (Linux microVM)          │
    │   │                                      │
    │   │  /home/user/project/                 │
    │   │    src/                               │
    │   │      components/                      │
    │   │        TodoList.tsx  ← FILE WRITTEN  │
    │   │    package.json                       │
    │   │    vite.config.ts                     │
    │   │                                      │
    │   │  Vite Dev Server (port 5173)         │
    │   │    → Detects file change             │
    │   │    → HMR update pushed to browser    │
    │   │                                      │
    │   └──────────────────────────────────────┘
    │
    ▼ onStream({ type: "file_change", action: "write", path: "..." })
    │
    ▼ WebSocket → Frontend receives file change notification
    │
    ▼ Frontend updates file tree sidebar
    │
    ▼ iframe (preview) auto-updates via Vite HMR
    │
    ▼ Tool result "File written: src/components/TodoList.tsx" sent back to LLM
    │
    ▼ LLM continues with next action...
```

---

## 5. E2B Sandbox Management

### What Is E2B?

E2B provides **cloud-based sandboxed environments** (lightweight Linux microVMs). Each sandbox is:

- An isolated Linux environment
- Has a filesystem, can run processes
- Can expose ports (like Vite dev server on 5173)
- Has a public URL for accessing exposed ports
- Lives for a configurable timeout (default 5 minutes, max 24 hours)

### Sandbox Lifecycle

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   CREATE     │────►│   RESTORE    │────►│    ACTIVE    │────►│   PERSIST    │
│   Sandbox    │     │  from S3     │     │  (Working)   │     │   to S3      │
└─────────────┘     └──────────────┘     └──────┬───────┘     └──────┬───────┘
                                                │                     │
                                                │ timeout/            │
                                                │ no heartbeat        ▼
                                                │              ┌──────────────┐
                                                └─────────────►│   SHUTDOWN   │
                                                               │   Sandbox    │
                                                               └──────────────┘
```

### SandboxManager Implementation

```typescript
// apps/orchestrator/src/sandbox/manager.ts

import { Sandbox } from "@e2b/code-interpreter";
// OR for general sandboxes:
// import { Sandbox } from "e2b";

export class SandboxManager {
  // Map of projectId → active sandbox info
  private activeSandboxes: Map<string, SandboxInfo> = new Map();

  constructor(
    private s3Client: S3Client,
    private e2bApiKey: string,
  ) {}

  // ───────────────────────────────────────
  // CREATE OR RESUME A SANDBOX
  // ───────────────────────────────────────
  async getOrCreateSandbox(projectId: string): Promise<SandboxInfo> {
    // Check if sandbox is already active
    const existing = this.activeSandboxes.get(projectId);
    if (existing && (await this.isSandboxAlive(existing))) {
      return existing;
    }

    // Create a new E2B sandbox from a custom template
    // The template has Node.js, npm, Vite pre-installed
    const sandbox = await Sandbox.create({
      template: "lovable-react-template", // Your custom E2B template
      apiKey: this.e2bApiKey,
      timeoutMs: 15 * 60 * 1000, // 15 minutes initial timeout
    });

    // Restore project files from S3 (if they exist)
    await this.restoreFromS3(sandbox, projectId);

    // Install dependencies
    await sandbox.commands.run("cd /home/user/project && npm install");

    // Start Vite dev server in background
    const devServer = await sandbox.commands.run(
      "cd /home/user/project && npm run dev -- --host 0.0.0.0",
      { background: true },
    );

    // Get the public preview URL
    const previewUrl = sandbox.getHost(5173); // Returns public URL

    const sandboxInfo: SandboxInfo = {
      sandbox,
      projectId,
      previewUrl: `https://${previewUrl}`,
      createdAt: new Date(),
      lastHeartbeat: new Date(),
    };

    this.activeSandboxes.set(projectId, sandboxInfo);
    return sandboxInfo;
  }

  // ───────────────────────────────────────
  // KEEP-ALIVE (extend timeout on heartbeat)
  // ───────────────────────────────────────
  async heartbeat(projectId: string): Promise<void> {
    const info = this.activeSandboxes.get(projectId);
    if (!info) return;

    info.lastHeartbeat = new Date();

    // Extend the sandbox timeout by another 15 minutes
    await info.sandbox.setTimeout(15 * 60 * 1000);
  }

  // ───────────────────────────────────────
  // SHUTDOWN & PERSIST
  // ───────────────────────────────────────
  async shutdownSandbox(projectId: string): Promise<void> {
    const info = this.activeSandboxes.get(projectId);
    if (!info) return;

    // 1. Persist files to S3
    await this.persistToS3(info.sandbox, projectId);

    // 2. Kill the sandbox
    await info.sandbox.kill();

    // 3. Remove from active map
    this.activeSandboxes.delete(projectId);
  }

  // ───────────────────────────────────────
  // HEALTH CHECK LOOP
  // ───────────────────────────────────────
  startHealthCheckLoop(): void {
    setInterval(async () => {
      for (const [projectId, info] of this.activeSandboxes) {
        const timeSinceHeartbeat = Date.now() - info.lastHeartbeat.getTime();

        // If no heartbeat for 5 minutes, schedule shutdown
        if (timeSinceHeartbeat > 5 * 60 * 1000) {
          console.log(
            `Sandbox for project ${projectId} timed out, shutting down...`,
          );
          await this.shutdownSandbox(projectId);
        }
      }
    }, 60 * 1000); // Check every minute
  }
}
```

### Custom E2B Template

You need to create a custom E2B template that has everything pre-installed:

```dockerfile
# e2b-template/Dockerfile (used to build the E2B template)
FROM e2b/base:latest

# Install Node.js
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs

# Install common tools
RUN npm install -g npm@latest

# Create project directory with a base React+Vite+Tailwind template
WORKDIR /home/user/project
COPY template/ .
RUN npm install

# The template/ folder contains a basic Vite + React + Tailwind + TypeScript setup
# with shadcn/ui pre-configured
```

Register it with E2B:

```bash
# Install E2B CLI
npm install -g @e2b/cli

# Login
e2b auth login

# Build and push template
cd e2b-template
e2b template build --name "lovable-react-template"
# This gives you a template ID to use in Sandbox.create()
```

---

## 6. S3 Backup & Restore

### Why S3?

E2B sandboxes are **ephemeral** - they die after timeout. Users need their project files to persist between sessions. S3 stores the project files so they can be restored when the user comes back.

### How It Works

```
User opens project → Backend creates sandbox → Restore files from S3
                                                     │
                     ┌───────────────────────────────┘
                     ▼
          S3: projects/{projectId}/
              ├── src/
              │   ├── App.tsx
              │   ├── components/
              │   │   └── TodoList.tsx
              │   └── main.tsx
              ├── package.json
              ├── vite.config.ts
              └── tailwind.config.ts

User closes tab → Heartbeat stops → Sandbox persists to S3 → Sandbox dies
```

### Implementation

```typescript
// apps/orchestrator/src/storage/s3.ts

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

export class ProjectStorage {
  private s3: S3Client;
  private bucket: string;

  constructor(config: {
    region: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
  }) {
    this.s3 = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
    this.bucket = config.bucket;
  }

  // ───────────────────────────────────────
  // PERSIST: Sandbox → S3
  // ───────────────────────────────────────
  async persistProject(sandbox: E2BSandbox, projectId: string): Promise<void> {
    // 1. Create a tar.gz of the project directory inside the sandbox
    await sandbox.commands.run(
      "cd /home/user && tar -czf /tmp/project.tar.gz " +
        "--exclude=node_modules --exclude=.git --exclude=dist " +
        "-C project .",
    );

    // 2. Download the tar.gz from the sandbox
    const tarBuffer = await sandbox.files.read("/tmp/project.tar.gz", {
      format: "bytes",
    });

    // 3. Upload to S3
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: `projects/${projectId}/project.tar.gz`,
        Body: tarBuffer,
        ContentType: "application/gzip",
      }),
    );

    // 4. Also save metadata
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: `projects/${projectId}/metadata.json`,
        Body: JSON.stringify({
          lastSaved: new Date().toISOString(),
          nodeVersion: "20",
        }),
        ContentType: "application/json",
      }),
    );
  }

  // ───────────────────────────────────────
  // RESTORE: S3 → Sandbox
  // ───────────────────────────────────────
  async restoreProject(
    sandbox: E2BSandbox,
    projectId: string,
  ): Promise<boolean> {
    try {
      // 1. Download tar.gz from S3
      const response = await this.s3.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: `projects/${projectId}/project.tar.gz`,
        }),
      );

      if (!response.Body) return false;

      const tarBuffer = await response.Body.transformToByteArray();

      // 2. Upload tar.gz to sandbox
      await sandbox.files.write("/tmp/project.tar.gz", tarBuffer);

      // 3. Extract in sandbox
      await sandbox.commands.run(
        "mkdir -p /home/user/project && " +
          "cd /home/user/project && " +
          "tar -xzf /tmp/project.tar.gz",
      );

      return true;
    } catch (err: any) {
      if (err.name === "NoSuchKey") {
        // New project, no files to restore → use template
        return false;
      }
      throw err;
    }
  }
}
```

### Alternative: File-by-File Sync (More Granular)

Instead of tar.gz, you can sync individual files. This is better for incremental saves:

```typescript
// Persist individual files as they change
async persistFile(projectId: string, filePath: string, content: string): Promise<void> {
  await this.s3.send(new PutObjectCommand({
    Bucket: this.bucket,
    Key: `projects/${projectId}/files/${filePath}`,
    Body: content,
  }));
}

// Restore all files
async restoreAllFiles(sandbox: E2BSandbox, projectId: string): Promise<void> {
  const listResponse = await this.s3.send(new ListObjectsV2Command({
    Bucket: this.bucket,
    Prefix: `projects/${projectId}/files/`,
  }));

  for (const object of listResponse.Contents || []) {
    const filePath = object.Key!.replace(`projects/${projectId}/files/`, "");
    const file = await this.s3.send(new GetObjectCommand({
      Bucket: this.bucket,
      Key: object.Key!,
    }));
    const content = await file.Body!.transformToString();
    await sandbox.files.write(`/home/user/project/${filePath}`, content);
  }
}
```

---

## 7. Sandbox Lifecycle & Heartbeat

### The Problem

E2B sandboxes cost money while running. You need to:

1. Keep them alive while users are actively working
2. Shut them down when users leave
3. Handle browser crashes / unexpected disconnects

### The Heartbeat System

```
┌──────────┐  heartbeat (every 30s)  ┌──────────────────┐
│ Frontend  │ ──────────────────────► │  Primary Backend  │
│           │                         │                   │
│ setInterval(                        │  Forwards to      │
│   () => ws.send({                   │  SandboxManager   │
│     type: "heartbeat",              │    .heartbeat()   │
│     projectId: "..."                │                   │
│   }),                               │  Extends sandbox  │
│   30000                             │  timeout by 15min │
│ )                                   │                   │
└──────────┘                         └──────────────────┘
```

### Frontend Heartbeat

```typescript
// apps/web/hooks/useProjectSession.ts

export function useProjectSession(projectId: string) {
  const ws = useWebSocket();

  useEffect(() => {
    if (!projectId || !ws) return;

    // Send heartbeat every 30 seconds
    const interval = setInterval(() => {
      ws.send(
        JSON.stringify({
          type: "heartbeat",
          projectId,
        }),
      );
    }, 30_000);

    // Also send heartbeat on user activity (mouse, keyboard)
    const onActivity = throttle(() => {
      ws.send(
        JSON.stringify({
          type: "heartbeat",
          projectId,
        }),
      );
    }, 30_000);

    window.addEventListener("mousemove", onActivity);
    window.addEventListener("keydown", onActivity);

    // Cleanup
    return () => {
      clearInterval(interval);
      window.removeEventListener("mousemove", onActivity);
      window.removeEventListener("keydown", onActivity);
    };
  }, [projectId, ws]);

  // Handle page unload - persist before closing
  useEffect(() => {
    const onBeforeUnload = () => {
      // Send a "persist" signal via beacon API (works even on tab close)
      navigator.sendBeacon(
        `/api/v1/project/${projectId}/persist`,
        JSON.stringify({ projectId }),
      );
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [projectId]);
}
```

### Backend Heartbeat Handler

```typescript
// In WebSocket handler
ws.on("message", async (data) => {
  const msg = JSON.parse(data.toString());

  switch (msg.type) {
    case "heartbeat":
      await sandboxManager.heartbeat(msg.projectId);
      break;

    case "chat":
      await orchestrator.handleUserMessage({
        projectId: msg.projectId,
        message: msg.content,
        // ...
      });
      break;
  }
});
```

### When Does the Sandbox Die?

| Scenario                                  | What Happens                                                                                                              |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| User is actively working                  | Heartbeat every 30s → sandbox timeout keeps extending                                                                     |
| User goes idle (tab open, no interaction) | Heartbeat continues from setInterval → sandbox stays alive                                                                |
| User closes tab                           | `beforeunload` sends persist beacon → backend saves to S3 → no more heartbeats → sandbox times out after 5 min            |
| User's browser crashes                    | No beacon, no heartbeats → sandbox times out after 5 min → health check loop saves to S3 before killing                   |
| Network disconnect                        | No heartbeats → same as crash → 5 min timeout → persist & kill                                                            |
| E2B's own timeout                         | If you don't extend timeout, E2B kills it after the initial timeout. Your health check should persist BEFORE this happens |

### Graceful Shutdown Sequence

```typescript
async shutdownSandbox(projectId: string): Promise<void> {
  const info = this.activeSandboxes.get(projectId);
  if (!info) return;

  try {
    // 1. Stop Vite dev server gracefully
    await info.sandbox.commands.run("pkill -f vite || true");

    // 2. Persist ALL project files to S3
    await this.storage.persistProject(info.sandbox, projectId);

    // 3. Update project metadata in database
    await prisma.project.update({
      where: { id: projectId },
      data: { lastSavedAt: new Date() },
    });

  } finally {
    // 4. Kill the sandbox (even if persist fails)
    await info.sandbox.kill();
    this.activeSandboxes.delete(projectId);
  }
}
```

---

## 8. Frontend ↔ Backend Communication (SSE vs WebSocket vs HTTP)

### "Why can't I just POST the prompt and wait for the response?"

You can! But here's what each approach gives you:

### Option 1: Plain HTTP POST (Simplest)

```
Frontend                          Backend
   │                                │
   │  POST /api/v1/chat             │
   │  { prompt: "build todo app" }  │
   │ ──────────────────────────────►│
   │                                │  ← AI thinks for 60-90 seconds
   │                                │  ← Creates 8 files
   │                                │  ← Installs 3 packages
   │                                │  ← User sees NOTHING during this
   │                                │
   │  200 OK                        │
   │  { text: "Done! I created..." }│
   │ ◄──────────────────────────────│
   │                                │
   User stares at spinner ──────────┘
```

**This works.** But the UX is terrible - 90 seconds of spinner with zero feedback. The preview URL is already available (you get it when the sandbox is created), but the user has no idea what the AI is doing.

### Option 2: SSE - Server-Sent Events (Recommended for v1)

This is the sweet spot. You POST the message, and the response comes back as a **stream**:

```
Frontend                          Backend
   │                                │
   │  POST /api/v1/chat             │
   │  { prompt: "build todo app" }  │
   │  Accept: text/event-stream     │
   │ ──────────────────────────────►│
   │                                │
   │  event: text                   │  ← AI starts responding
   │  data: "I'll create a..."     │
   │ ◄─────────────────────────────│
   │                                │
   │  event: tool_call              │  ← User sees what's happening
   │  data: {"name":"lov-write",   │
   │    "path":"src/App.tsx"}       │
   │ ◄─────────────────────────────│
   │                                │
   │  event: text                   │
   │  data: "Now adding styles..."  │
   │ ◄─────────────────────────────│
   │                                │
   │  event: done                   │
   │ ◄─────────────────────────────│
```

**Why this is better:**

- User sees AI text appearing word-by-word (like ChatGPT)
- User sees "Creating App.tsx...", "Installing tailwind...", "Done!"
- Still just HTTP - no WebSocket complexity
- The preview iframe updates live via Vite HMR regardless (it's a separate connection to the sandbox)

**SSE is one-directional** (server → client only). For sending messages, you use regular HTTP POST. That's fine! Chat is naturally request-response.

### Option 3: WebSocket (Full Bidirectional)

Only needed if you want:

- Heartbeat over the same connection (can also do with `setInterval` + `fetch`)
- Console log forwarding from the iframe back to the AI
- Multiple real-time channels on one connection

### Recommended Approach: SSE for Chat + HTTP for Everything Else

```typescript
// ═══════════════════════════════════════
// BACKEND: SSE endpoint
// ═══════════════════════════════════════

// apps/backend/src/router/chatRouter.ts

import { Router } from "express";

const chatRouter = Router();

chatRouter.post("/api/v1/project/:projectId/chat", async (req, res) => {
  const { projectId } = req.params;
  const { message } = req.body;

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  try {
    await orchestrator.handleUserMessage({
      projectId,
      message,
      conversationHistory: await getConversationHistory(projectId),
      onStream: (chunk) => {
        // Send each chunk as an SSE event
        res.write(`event: ${chunk.type}\n`);
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      },
    });

    // Signal completion
    res.write(`event: done\ndata: {}\n\n`);
    res.end();
  } catch (err) {
    res.write(
      `event: error\ndata: ${JSON.stringify({ message: String(err) })}\n\n`,
    );
    res.end();
  }
});

// Heartbeat is just a simple POST
chatRouter.post("/api/v1/project/:projectId/heartbeat", async (req, res) => {
  await sandboxManager.heartbeat(req.params.projectId);
  res.json({ ok: true });
});

// Persist on tab close (called via navigator.sendBeacon)
chatRouter.post("/api/v1/project/:projectId/persist", async (req, res) => {
  await sandboxManager.persistAndScheduleShutdown(req.params.projectId);
  res.json({ ok: true });
});
```

```typescript
// ═══════════════════════════════════════
// FRONTEND: SSE consumer hook
// ═══════════════════════════════════════

// apps/web/hooks/useChat.ts

export function useChat(projectId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  const sendMessage = useCallback(
    async (content: string) => {
      // Add user message to UI immediately
      setMessages((prev) => [...prev, { role: "user", content }]);
      setIsStreaming(true);

      // Start streaming AI response
      let assistantText = "";

      const response = await fetch(`/api/v1/project/${projectId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content }),
      });

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        // Parse SSE format: "event: type\ndata: {...}\n\n"
        const events = parseSSE(text);

        for (const event of events) {
          switch (event.type) {
            case "text":
              assistantText += event.data.content;
              // Update the streaming message in real-time
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === "assistant") {
                  last.content = assistantText;
                } else {
                  updated.push({ role: "assistant", content: assistantText });
                }
                return updated;
              });
              break;

            case "tool_call":
              // Show tool call activity in UI
              // e.g., "Creating src/components/TodoList.tsx..."
              break;

            case "done":
              setIsStreaming(false);
              break;
          }
        }
      }
    },
    [projectId],
  );

  return { messages, sendMessage, isStreaming };
}
```

```typescript
// ═══════════════════════════════════════
// FRONTEND: Heartbeat (plain HTTP, no WebSocket needed)
// ═══════════════════════════════════════

// apps/web/hooks/useHeartbeat.ts

export function useHeartbeat(projectId: string | null) {
  useEffect(() => {
    if (!projectId) return;

    const interval = setInterval(() => {
      fetch(`/api/v1/project/${projectId}/heartbeat`, {
        method: "POST",
      }).catch(() => {
        // Connection lost, maybe show a reconnect banner
      });
    }, 30_000);

    // Persist on tab close
    const onBeforeUnload = () => {
      navigator.sendBeacon(`/api/v1/project/${projectId}/persist`);
    };
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [projectId]);
}
```

### Summary: What Gets the Preview URL?

The preview URL has **nothing to do with streaming**. Here's the actual flow:

```
1. User clicks "Create Project"
   → POST /api/v1/project { prompt: "build a todo app" }
   → Backend creates sandbox
   → Backend returns { projectId, previewUrl, sandboxId }
   → Frontend navigates to /project/:id
   → Frontend loads previewUrl in iframe    ← PREVIEW IS ALREADY LIVE

2. User's prompt is sent to AI
   → POST /api/v1/project/:id/chat (SSE stream)
   → AI starts writing files in sandbox
   → Vite HMR auto-updates the iframe       ← PREVIEW UPDATES AUTOMATICALLY
   → SSE streams text + tool calls to chat   ← CHAT SHOWS PROGRESS

The preview URL is just: https://{sandboxId}-5173.e2b.dev
It's a direct connection from the user's browser to the Vite dev server.
Your backend doesn't proxy the preview at all.
```

---

## 9. VS Code in the Browser

### Overview

You can give users a full VS Code editing experience by running **OpenVSCode Server** (or **code-server**) inside the E2B sandbox. It's just another process exposing a port, like the Vite dev server.

```
┌─────────────────────────────────────────────────────────────────┐
│  User's Browser                                                  │
│                                                                  │
│  ┌─────────────────────┐  ┌──────────────────────────────────┐  │
│  │                     │  │                                  │  │
│  │   Chat Panel        │  │   Tabbed Panel                   │  │
│  │                     │  │   ┌────────┐ ┌─────────┐        │  │
│  │  [User]: Build me   │  │   │Preview │ │ Code    │        │  │
│  │  a todo app         │  │   └────────┘ └─────────┘        │  │
│  │                     │  │                                  │  │
│  │  [AI]: Creating     │  │  ┌────────────────────────────┐ │  │
│  │  components...      │  │  │                            │ │  │
│  │                     │  │  │  iframe src=               │ │  │
│  │                     │  │  │   Preview: sandboxUrl:5173 │ │  │
│  │                     │  │  │   Code: sandboxUrl:3000    │ │  │
│  │                     │  │  │                            │ │  │
│  │  [prompt input]     │  │  │  (VS Code / Live Preview)  │ │  │
│  │                     │  │  │                            │ │  │
│  └─────────────────────┘  │  └────────────────────────────┘ │  │
│                           └──────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### How It Works

The E2B sandbox is a Linux VM. You run two servers inside it:

| Server            | Port | Purpose                   | Public URL                         |
| ----------------- | ---- | ------------------------- | ---------------------------------- |
| Vite dev server   | 5173 | Live preview of the app   | `https://{sandboxId}-5173.e2b.dev` |
| OpenVSCode Server | 3000 | VS Code editor in browser | `https://{sandboxId}-3000.e2b.dev` |

Both are accessible via E2B's port forwarding. The frontend just puts the right URL in the right iframe.

### Setting Up in the E2B Template

```dockerfile
# e2b-template/Dockerfile

FROM e2b/base:latest

# Install Node.js
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs

# Install OpenVSCode Server
RUN curl -fsSL https://github.com/nicedoc/code/releases/download/v1.99.0/openvscode-server-v1.99.0-linux-x64.tar.gz \
    | tar -xz -C /opt && \
    ln -s /opt/openvscode-server-v1.99.0-linux-x64/bin/openvscode-server /usr/local/bin/openvscode-server

# Pre-install useful VS Code extensions
RUN openvscode-server --install-extension esbenp.prettier-vscode && \
    openvscode-server --install-extension bradlc.vscode-tailwindcss && \
    openvscode-server --install-extension dbaeumer.vscode-eslint

# Create project directory with base template
WORKDIR /home/user/project
COPY template/ .
RUN npm install
```

### Starting VS Code in the Sandbox

```typescript
// In SandboxManager.getOrCreateSandbox()

async getOrCreateSandbox(projectId: string): Promise<SandboxInfo> {
  const sandbox = await Sandbox.create({
    template: "lovable-react-template",
    apiKey: this.e2bApiKey,
    timeoutMs: 15 * 60 * 1000,
  });

  // Restore files from S3
  await this.restoreFromS3(sandbox, projectId);

  // Install dependencies
  await sandbox.commands.run("cd /home/user/project && npm install");

  // Start Vite dev server (port 5173)
  await sandbox.commands.run(
    "cd /home/user/project && npm run dev -- --host 0.0.0.0",
    { background: true }
  );

  // Start OpenVSCode Server (port 3000)
  await sandbox.commands.run(
    "openvscode-server --port 3000 --host 0.0.0.0 --without-connection-token " +
    "--default-folder /home/user/project",
    { background: true }
  );

  // Get public URLs for both
  const previewUrl = `https://${sandbox.getHost(5173)}`;
  const vscodeUrl = `https://${sandbox.getHost(3000)}`;

  return {
    sandbox,
    projectId,
    previewUrl,
    vscodeUrl,
    createdAt: new Date(),
    lastHeartbeat: new Date(),
  };
}
```

### Frontend: Tabbed Panel with Preview + Code

```tsx
// apps/web/components/project-workspace.tsx

import { useState } from "react";

interface WorkspaceProps {
  previewUrl: string;
  vscodeUrl: string;
}

export function ProjectWorkspace({ previewUrl, vscodeUrl }: WorkspaceProps) {
  const [activeTab, setActiveTab] = useState<"preview" | "code">("preview");

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex border-b">
        <button
          onClick={() => setActiveTab("preview")}
          className={activeTab === "preview" ? "tab-active" : "tab"}
        >
          Preview
        </button>
        <button
          onClick={() => setActiveTab("code")}
          className={activeTab === "code" ? "tab-active" : "tab"}
        >
          Code
        </button>
      </div>

      {/* Panels - both iframes stay mounted, one is hidden */}
      <div className="flex-1 relative">
        <iframe
          src={previewUrl}
          className={`absolute inset-0 w-full h-full ${
            activeTab === "preview" ? "block" : "hidden"
          }`}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
        <iframe
          src={vscodeUrl}
          className={`absolute inset-0 w-full h-full ${
            activeTab === "code" ? "block" : "hidden"
          }`}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
        />
      </div>
    </div>
  );
}
```

### Important: VS Code Sees AI Changes in Real-Time

This is the beautiful part - since both VS Code and Vite are reading the **same filesystem** inside the sandbox:

```
AI writes file via E2B API
    │
    ▼
Sandbox filesystem updates: /home/user/project/src/App.tsx
    │
    ├──► Vite detects change → HMR → Preview iframe updates
    │
    └──► VS Code detects change → File refreshes in editor
         (VS Code has built-in file watcher)
```

The user sees the code appearing in VS Code and the preview updating simultaneously, while the AI explains what it's doing in the chat panel. No extra work needed to sync anything.

### Alternative: code-server (Coder)

If you prefer Coder's code-server over OpenVSCode Server:

```dockerfile
# Install code-server instead
RUN curl -fsSL https://code-server.dev/install.sh | sh
```

```typescript
// Start code-server
await sandbox.commands.run(
  "code-server --port 3000 --host 0.0.0.0 --auth none " +
    "--disable-telemetry /home/user/project",
  { background: true },
);
```

### Comparison

| Feature       | OpenVSCode Server            | code-server       |
| ------------- | ---------------------------- | ----------------- |
| Maintained by | Gitpod                       | Coder             |
| Based on      | VS Code (official)           | VS Code (fork)    |
| Extensions    | VS Code Marketplace          | Open VSX Registry |
| Auth          | `--without-connection-token` | `--auth none`     |
| Size          | ~200MB                       | ~300MB            |
| License       | MIT                          | MIT               |

Both work well. OpenVSCode Server is closer to official VS Code and has marketplace access. code-server has a more mature deployment story.

### Security Considerations

Since VS Code is running inside an isolated E2B sandbox, users can only access files within that sandbox. However:

- **Use `--without-connection-token` carefully** - the E2B public URL is already scoped to the sandbox, but you may want to add authentication at your proxy/backend level
- **Consider read-only mode** - if you don't want users manually editing while the AI is working, you can start VS Code with `--readonly` flag and toggle it
- **Extension restrictions** - pre-install only the extensions you trust in your template; users shouldn't install arbitrary extensions in a shared environment

---

## 10. Deployment

### Deploying User Projects (The Easy Part)

Since user projects are React + Vite apps, deployment is straightforward:

```typescript
// apps/orchestrator/src/deploy/deployer.ts

export class ProjectDeployer {
  constructor(
    private s3Client: S3Client,
    private cloudfrontDistributionId?: string,
  ) {}

  async deploy(sandbox: E2BSandbox, projectId: string): Promise<string> {
    // 1. Build the project inside the sandbox
    const buildResult = await sandbox.commands.run(
      "cd /home/user/project && npm run build",
    );

    if (buildResult.exitCode !== 0) {
      throw new Error(`Build failed: ${buildResult.stderr}`);
    }

    // 2. The build output is in dist/ (Vite default)
    // Download the dist directory
    const tarResult = await sandbox.commands.run(
      "cd /home/user/project && tar -cf /tmp/dist.tar -C dist .",
    );

    const distTar = await sandbox.files.read("/tmp/dist.tar", {
      format: "bytes",
    });

    // 3. Upload to S3 static hosting bucket
    // (You'd extract the tar and upload each file)
    await this.uploadDistToS3(projectId, distTar);

    // 4. Return the deployed URL
    // Option A: S3 + CloudFront
    // Option B: Vercel API
    // Option C: Netlify API
    return `https://${projectId}.your-domain.com`;
  }

  // Alternative: Use Vercel API for deployment
  async deployToVercel(
    sandbox: E2BSandbox,
    projectId: string,
  ): Promise<string> {
    // 1. Build in sandbox
    await sandbox.commands.run("cd /home/user/project && npm run build");

    // 2. Deploy using Vercel CLI (pre-installed in sandbox)
    const result = await sandbox.commands.run(
      "cd /home/user/project && npx vercel --prod --token $VERCEL_TOKEN --yes",
    );

    // 3. Parse the URL from output
    const deployUrl = result.stdout.trim().split("\n").pop();
    return deployUrl!;
  }
}
```

### Deploying the Platform Itself

```yaml
# docker-compose.production.yml

services:
  backend:
    build:
      context: .
      dockerfile: docker/backend/Dockerfile
    environment:
      - DATABASE_URL=postgresql://...
      - E2B_API_KEY=...
      - AWS_ACCESS_KEY_ID=...
      - AWS_SECRET_ACCESS_KEY=...
      - S3_BUCKET=lovable-projects
      - ANTHROPIC_API_KEY=...
    ports:
      - "3001:3001"
    deploy:
      replicas: 2

  web:
    build:
      context: .
      dockerfile: docker/web/Dockerfile
    ports:
      - "3000:3000"
    deploy:
      replicas: 2

  # No separate orchestrator container needed -
  # it runs as a library within the backend.
  # But if you want horizontal scaling:

  orchestrator-worker:
    build:
      context: .
      dockerfile: docker/orchestrator/Dockerfile
    environment:
      - E2B_API_KEY=...
      - ANTHROPIC_API_KEY=...
      - S3_BUCKET=lovable-projects
      - REDIS_URL=redis://redis:6379
    deploy:
      replicas: 4 # Scale based on concurrent users

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  loadbalancer:
    image: nginx:alpine
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    ports:
      - "80:80"
      - "443:443"
```

---

## 11. Implementation Plan

Here's the recommended order for implementing everything:

### Phase 1: E2B Sandbox Basics (Week 1)

```
Priority: Get a sandbox running with files, a preview URL, and VS Code

1. Install E2B SDK
   - npm install e2b @e2b/code-interpreter

2. Create E2B template
   - Base React + Vite + Tailwind + TypeScript + shadcn template
   - Install OpenVSCode Server (or code-server) in the template
   - Pre-install VS Code extensions (Prettier, Tailwind CSS, ESLint)
   - Register with E2B CLI

3. Implement SandboxManager
   - create/kill sandbox
   - files.read / files.write
   - commands.run
   - Start Vite dev server (port 5173)
   - Start OpenVSCode Server (port 3000)
   - getHost() for both preview URL and VS Code URL

4. Test manually
   - Create sandbox
   - Write a React file
   - See it in the browser via preview URL
   - Open VS Code URL and verify the file appears there too
```

### Phase 2: Orchestrator Agent Loop (Week 2)

```
Priority: Get the AI generating code in the sandbox

1. Set up Anthropic SDK (or OpenAI)
   - npm install @anthropic-ai/sdk

2. Implement the agent loop
   - Load agent_prompt.txt as system prompt
   - Convert agent_tools.json to tool definitions
   - Implement the while loop (call LLM → execute tools → repeat)

3. Implement ToolExecutor
   - Map each tool to E2B sandbox operations
   - Start with: lov-write, lov-view, lov-search-files, lov-delete
   - Add: lov-line-replace, lov-add-dependency

4. Test end-to-end
   - Send "Build a todo app" to orchestrator
   - Watch it create files in sandbox
   - See the result in preview URL
   - Verify files appear in VS Code editor
```

### Phase 3: Real-Time Streaming via SSE (Week 3)

```
Priority: Stream AI responses and file changes to the frontend

1. Set up SSE endpoint on backend
   - POST /api/v1/project/:id/chat returns text/event-stream
   - Events: text, tool_call, file_change, done, error

2. Implement streaming
   - Stream LLM text chunks as SSE events
   - Stream file change events
   - Stream tool call status (started/completed)

3. Build the chat UI
   - useChat hook that consumes SSE stream
   - Message rendering with markdown
   - Typing/activity indicator while AI is working

4. Build the workspace panel (tabbed: Preview + Code)
   - "Preview" tab: iframe with sandbox Vite URL (port 5173)
   - "Code" tab: iframe with sandbox VS Code URL (port 3000)
   - Both stay mounted (hidden/shown) so state is preserved
```

### Phase 4: S3 Persistence (Week 4)

```
Priority: Projects survive sandbox shutdown

1. Set up S3 (or MinIO for local dev)
   - Create bucket
   - Configure credentials

2. Implement ProjectStorage
   - persistProject (sandbox → S3)
   - restoreProject (S3 → sandbox)

3. Wire up lifecycle
   - Restore on sandbox create
   - Persist on sandbox shutdown
   - Persist on file changes (debounced)

4. Implement heartbeat system
   - Frontend setInterval + fetch POST to /heartbeat
   - navigator.sendBeacon on beforeunload for persist
   - Backend timeout management
   - Graceful shutdown: persist to S3 then kill sandbox
```

### Phase 5: Project Management (Week 5)

```
Priority: Users can create, list, and resume projects

1. Project CRUD API
   - POST /api/v1/project (create sandbox, return previewUrl + vscodeUrl)
   - GET /api/v1/projects (list user's projects)
   - GET /api/v1/project/:id (get project details)
   - DELETE /api/v1/project/:id (delete project + S3 files)

2. Project page UI
   - Create project from prompt
   - List existing projects
   - Resume project (re-create sandbox, restore files, return new URLs)

3. Conversation history
   - Save all messages to DB
   - Restore conversation when resuming project
   - Display full history in chat
```

### Phase 6: Deployment & Polish (Week 6)

```
Priority: Users can deploy their projects

1. Build & deploy pipeline
   - Build project in sandbox
   - Deploy to S3 + CloudFront OR Vercel

2. Console log / network request capture
   - Inject script into iframe to capture console.log
   - Send back to backend for AI debugging

3. Image generation (optional)
   - Integrate DALL-E or Flux for image generation tool

4. Web search (optional)
   - Integrate search API for websearch tool
```

---

## Appendix A: Key Dependencies to Install

```bash
# In apps/orchestrator
pnpm add e2b @anthropic-ai/sdk @aws-sdk/client-s3 zod

# In apps/backend
pnpm add ws @types/ws

# In apps/web
pnpm add socket.io-client  # or native WebSocket
```

## Appendix B: Environment Variables

```env
# E2B
E2B_API_KEY=e2b_...

# LLM
ANTHROPIC_API_KEY=sk-ant-...
# or
OPENAI_API_KEY=sk-...

# S3
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
S3_BUCKET=lovable-projects

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/lovable

# Auth
BETTER_AUTH_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

## Appendix C: Database Schema Additions

```prisma
// Add these to your existing schema.prisma

model Project {
  id                    String                @id @default(uuid())
  title                 String
  initialPrompt         String
  userId                String
  user                  User                  @relation(fields: [userId], references: [id])
  conversationHistories ConversationHistory[]

  // NEW FIELDS:
  status                ProjectStatus         @default(ACTIVE)
  lastSavedAt           DateTime?
  deployedUrl           String?
  sandboxTemplateId     String?               // E2B template used
  s3Prefix              String?               // S3 path for this project's files

  createdAt             DateTime              @default(now())
  updatedAt             DateTime              @updatedAt
}

enum ProjectStatus {
  ACTIVE
  DEPLOYED
  ARCHIVED
  DELETED
}
```

## Appendix D: Resource Constraints & Autoscaling

### E2B Limits

- Each sandbox uses ~512MB-2GB RAM
- E2B handles the VM infrastructure
- You're charged per sandbox-minute
- Max concurrent sandboxes depends on your E2B plan

### Autoscaling Strategy

```
Users → Load Balancer → Backend instances (stateless, scale horizontally)
                              │
                              ▼
                    Orchestrator workers (CPU-bound for LLM calls)
                              │
                              ▼
                    E2B (auto-scales sandboxes, managed by E2B)

- Backend: Scale based on WebSocket connections
- Orchestrator workers: Scale based on queue depth (if using Redis queue)
- E2B: Managed service, scales automatically
- S3: Infinite scale, no concerns
```

### For Production: Separate Orchestrator Workers

Instead of running the orchestrator inline with the backend, use a message queue:

```
Backend → Redis Queue → Orchestrator Worker Pool
              │
              ▼
         Job: {
           projectId: "...",
           message: "Build me a todo app",
           sandboxId: "...",
         }
```

This lets you scale orchestrator workers independently of the backend.
