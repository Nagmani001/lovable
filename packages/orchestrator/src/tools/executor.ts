import type { Sandbox } from "e2b";
import type { StreamChunk } from "@repo/common/types";

export class ToolExecutor {
  private sandbox: Sandbox;
  private projectBasePath: string;
  private consoleLogs: string[] = [];
  private networkRequests: string[] = [];

  constructor(sandbox: Sandbox, projectBasePath: string) {
    this.sandbox = sandbox;
    this.projectBasePath = projectBasePath;
  }

  storeConsoleLogs(logs: string[]): void {
    this.consoleLogs = logs;
  }

  storeNetworkRequests(requests: string[]): void {
    this.networkRequests = requests;
  }

  async execute(
    toolName: string,
    args: Record<string, unknown>,
    onStream: (chunk: StreamChunk) => void,
  ): Promise<string> {
    onStream({
      type: "tool_call",
      name: toolName,
      status: "started",
      args,
    });

    try {
      const result = await this.executeInternal(toolName, args, onStream);

      onStream({
        type: "tool_call",
        name: toolName,
        status: "completed",
        result,
      });

      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);

      onStream({
        type: "tool_call",
        name: toolName,
        status: "failed",
        result: errorMsg,
      });

      return `Error executing ${toolName}: ${errorMsg}`;
    }
  }

  private resolvePath(filePath: string): string {
    // If path is absolute, use it; otherwise resolve relative to project
    if (filePath.startsWith("/")) return filePath;
    return `${this.projectBasePath}/${filePath}`;
  }

  private async executeInternal(
    toolName: string,
    args: Record<string, unknown>,
    onStream: (chunk: StreamChunk) => void,
  ): Promise<string> {
    switch (toolName) {
      // ═══════════════════════════════════════
      // FILE OPERATIONS
      // ═══════════════════════════════════════

      case "lov-write": {
        const filePath = this.resolvePath(args.file_path as string);
        const content = args.content as string;

        // Ensure parent directory exists
        const dir = filePath.substring(0, filePath.lastIndexOf("/"));
        await this.sandbox.commands.run(`mkdir -p "${dir}"`);

        await this.sandbox.files.write(filePath, content);

        onStream({
          type: "file_change",
          action: "write",
          path: args.file_path as string,
        });

        return `File written: ${args.file_path}`;
      }

      case "lov-view": {
        const filePath = this.resolvePath(args.file_path as string);
        const content = await this.sandbox.files.read(filePath);

        if (args.lines) {
          return this.sliceLines(content, args.lines as string);
        }

        // Default: return first 500 lines
        const lines = content.split("\n");
        if (lines.length > 500) {
          return (
            lines
              .slice(0, 500)
              .map((line, i) => `${i + 1}: ${line}`)
              .join("\n") +
            `\n\n... (${lines.length - 500} more lines, use 'lines' parameter to view)`
          );
        }

        return lines.map((line, i) => `${i + 1}: ${line}`).join("\n");
      }

      case "lov-delete": {
        const filePath = this.resolvePath(args.file_path as string);
        await this.sandbox.files.remove(filePath);

        onStream({
          type: "file_change",
          action: "delete",
          path: args.file_path as string,
        });

        return `File deleted: ${args.file_path}`;
      }

      case "lov-rename": {
        const originalPath = this.resolvePath(
          args.original_file_path as string,
        );
        const newPath = this.resolvePath(args.new_file_path as string);

        // Ensure parent directory of destination exists
        const dir = newPath.substring(0, newPath.lastIndexOf("/"));
        await this.sandbox.commands.run(`mkdir -p "${dir}"`);

        await this.sandbox.commands.run(`mv "${originalPath}" "${newPath}"`);

        onStream({
          type: "file_change",
          action: "rename",
          path: args.new_file_path as string,
          from: args.original_file_path as string,
        });

        return `File renamed: ${args.original_file_path} → ${args.new_file_path}`;
      }

      case "lov-copy": {
        const sourcePath = this.resolvePath(args.source_file_path as string);
        const destPath = this.resolvePath(args.destination_file_path as string);

        const dir = destPath.substring(0, destPath.lastIndexOf("/"));
        await this.sandbox.commands.run(`mkdir -p "${dir}"`);

        await this.sandbox.commands.run(`cp "${sourcePath}" "${destPath}"`);

        return `Copied ${args.source_file_path} → ${args.destination_file_path}`;
      }

      case "lov-line-replace": {
        const filePath = this.resolvePath(args.file_path as string);
        const firstLine = args.first_replaced_line as number;
        const lastLine = args.last_replaced_line as number;
        const replace = args.replace as string;

        const content = await this.sandbox.files.read(filePath);
        const lines = content.split("\n");

        // Replace the specified line range
        const replaceLines = replace.split("\n");
        lines.splice(firstLine - 1, lastLine - firstLine + 1, ...replaceLines);

        const newContent = lines.join("\n");
        await this.sandbox.files.write(filePath, newContent);

        onStream({
          type: "file_change",
          action: "update",
          path: args.file_path as string,
        });

        return `Lines ${firstLine}-${lastLine} replaced in ${args.file_path}`;
      }

      case "lov-search-files": {
        const query = args.query as string;
        const includePattern = args.include_pattern as string;
        const excludePattern = args.exclude_pattern as string | undefined;
        const caseSensitive = args.case_sensitive as boolean | undefined;

        let cmd = `cd ${this.projectBasePath} && grep -rn`;
        if (!caseSensitive) cmd += "i";
        cmd += ` "${query}" --include="${includePattern}"`;
        if (excludePattern) cmd += ` --exclude="${excludePattern}"`;
        cmd += " . 2>/dev/null || true";

        const result = await this.sandbox.commands.run(cmd, {
          timeoutMs: 15_000,
        });

        return result.stdout || "No results found";
      }

      // ═══════════════════════════════════════
      // DEPENDENCY MANAGEMENT
      // ═══════════════════════════════════════

      case "lov-add-dependency": {
        const pkg = args.package as string;
        const result = await this.sandbox.commands.run(
          `cd ${this.projectBasePath} && npm install ${pkg}`,
          { timeoutMs: 60_000 },
        );

        onStream({
          type: "terminal",
          content: result.stdout + (result.stderr || ""),
        });

        return result.stdout || "Package installed";
      }

      case "lov-remove-dependency": {
        const pkg = args.package as string;
        const result = await this.sandbox.commands.run(
          `cd ${this.projectBasePath} && npm uninstall ${pkg}`,
          { timeoutMs: 30_000 },
        );

        return result.stdout || "Package removed";
      }

      // ═══════════════════════════════════════
      // DOWNLOAD
      // ═══════════════════════════════════════

      case "lov-download-to-repo": {
        const sourceUrl = args.source_url as string;
        const targetPath = this.resolvePath(args.target_path as string);

        const dir = targetPath.substring(0, targetPath.lastIndexOf("/"));
        await this.sandbox.commands.run(`mkdir -p "${dir}"`);

        await this.sandbox.commands.run(
          `curl -sL -o "${targetPath}" "${sourceUrl}"`,
          { timeoutMs: 30_000 },
        );

        return `Downloaded ${sourceUrl} → ${args.target_path}`;
      }

      // ═══════════════════════════════════════
      // CONSOLE & NETWORK LOGS
      // ═══════════════════════════════════════

      case "lov-read-console-logs": {
        const search = args.search as string;
        if (!this.consoleLogs.length) {
          return "No console logs available";
        }

        if (search) {
          const filtered = this.consoleLogs.filter((log) =>
            log.toLowerCase().includes(search.toLowerCase()),
          );
          return filtered.join("\n") || "No matching console logs found";
        }

        return this.consoleLogs.join("\n");
      }

      case "lov-read-network-requests": {
        const search = args.search as string;
        if (!this.networkRequests.length) {
          return "No network requests available";
        }

        if (search) {
          const filtered = this.networkRequests.filter((req) =>
            req.toLowerCase().includes(search.toLowerCase()),
          );
          return filtered.join("\n") || "No matching network requests found";
        }

        return this.networkRequests.join("\n");
      }

      // ═══════════════════════════════════════
      // WEB FETCH (simplified - no browser)
      // ═══════════════════════════════════════

      case "lov-fetch-website": {
        const url = args.url as string;
        const result = await this.sandbox.commands.run(
          `curl -sL "${url}" | head -c 50000`,
          { timeoutMs: 15_000 },
        );
        return result.stdout || "Failed to fetch website";
      }

      // ═══════════════════════════════════════
      // NOT IMPLEMENTED (stubs for tools that need external services)
      // ═══════════════════════════════════════

      case "websearch--web_search":
        return "Web search is not yet configured. Please set up a search API integration.";

      case "imagegen--generate_image":
        return "Image generation is not yet configured. Please set up an image generation API.";

      case "imagegen--edit_image":
        return "Image editing is not yet configured. Please set up an image generation API.";

      case "secrets--add_secret":
      case "secrets--update_secret":
        return "Secrets management is not yet configured.";

      case "supabase--docs-search":
      case "supabase--docs-get":
        return "Supabase integration is not yet configured.";

      case "document--parse_document":
        return "Document parsing is not yet configured.";

      case "analytics--read_project_analytics":
        return "Analytics is not yet configured.";

      case "stripe--enable_stripe":
        return "Stripe integration is not yet configured.";

      case "security--run_security_scan":
      case "security--get_security_scan_results":
      case "security--get_table_schema":
        return "Security scanning is not yet configured.";

      default:
        return `Unknown tool: ${toolName}`;
    }
  }

  private sliceLines(content: string, linesParam: string): string {
    const allLines = content.split("\n");
    const result: string[] = [];

    // Parse line ranges like "1-800, 1001-1500"
    const ranges = linesParam.split(",").map((r) => r.trim());

    for (const range of ranges) {
      if (range.includes("-")) {
        const parts = range.split("-").map(Number);
        const start = parts[0] ?? 1;
        const end = parts[1] ?? allLines.length;
        for (let i = start; i <= Math.min(end, allLines.length); i++) {
          result.push(`${i}: ${allLines[i - 1]}`);
        }
      } else {
        const lineNum = Number(range);
        if (lineNum >= 1 && lineNum <= allLines.length) {
          result.push(`${lineNum}: ${allLines[lineNum - 1]}`);
        }
      }
    }

    return result.join("\n");
  }
}
