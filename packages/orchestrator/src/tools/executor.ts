import type { Sandbox } from "e2b";
import type { StreamChunk } from "@repo/common/types";
import type { ContextManager } from "../context/context-manager.js";

export class ToolExecutor {
  private sandbox: Sandbox;
  private projectBasePath: string;
  private consoleLogs: string[] = [];
  private networkRequests: string[] = [];
  private contextManager?: ContextManager;

  constructor(
    sandbox: Sandbox,
    projectBasePath: string,
    contextManager?: ContextManager,
  ) {
    this.sandbox = sandbox;
    this.projectBasePath = projectBasePath;
    this.contextManager = contextManager;
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
        let content = args.content as string;

        // Ensure parent directory exists
        const dir = filePath.substring(0, filePath.lastIndexOf("/"));
        await this.sandbox.commands.run(`mkdir -p "${dir}"`);
        await this.sandbox.files.write(filePath, content);
        this.contextManager?.applyWrite(args.file_path as string, content);

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

        this.contextManager?.applyDelete(args.file_path as string);

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

        this.contextManager?.applyRename(
          args.original_file_path as string,
          args.new_file_path as string,
        );

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
        const hintFirst = args.first_replaced_line as number;
        const hintLast = args.last_replaced_line as number;
        const search = args.search as string;
        const replace = args.replace as string;
        const content = await this.sandbox.files.read(filePath);
        const lines = content.split("\n");

        // Validate search against file content and find the actual line range
        const { actualFirst, actualLast } = this.findMatchingRange(
          lines,
          search,
          hintFirst,
          hintLast,
        );

        const replaceLines = replace.split("\n");

        lines.splice(
          actualFirst - 1,
          actualLast - actualFirst + 1,
          ...replaceLines,
        );

        const newContent = lines.join("\n");
        await this.sandbox.files.write(filePath, newContent);

        this.contextManager?.applyLineReplace(
          args.file_path as string,
          newContent,
        );

        onStream({
          type: "file_change",
          action: "update",
          path: args.file_path as string,
        });

        return `Lines ${actualFirst}-${actualLast} replaced in ${args.file_path}`;
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

        await this.syncPackageJson();

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

        await this.syncPackageJson();

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

      default:
        return `Unknown tool: ${toolName}`;
    }
  }

  private async syncPackageJson(): Promise<void> {
    if (!this.contextManager) return;
    try {
      const pkgPath = `${this.projectBasePath}/package.json`;
      const content = await this.sandbox.files.read(pkgPath);
      this.contextManager.applyWrite("package.json", content);
    } catch {
      // ignore read failures
    }
  }

  /**
   * Validates the search parameter against actual file content and finds
   * the correct line range, correcting for line number mismatches from the AI.
   */
  private findMatchingRange(
    lines: string[],
    search: string,
    hintFirst: number,
    hintLast: number,
  ): { actualFirst: number; actualLast: number } {
    const searchLines = search.split("\n");
    const ellipsisIndex = searchLines.findIndex((l) => l.trim() === "...");

    const SEARCH_WINDOW = 20;

    if (ellipsisIndex < 0) {
      // No ellipsis — find where the full search content starts
      const start = this.findBlockStart(
        lines,
        searchLines,
        hintFirst,
        SEARCH_WINDOW,
      );
      if (start !== -1) {
        return {
          actualFirst: start,
          actualLast: start + searchLines.length - 1,
        };
      }
      // Fallback to provided line numbers
      return { actualFirst: hintFirst, actualLast: hintLast };
    }

    // Has ellipsis — find prefix start and suffix end independently
    const prefixLines = searchLines.slice(0, ellipsisIndex);
    const suffixLines = searchLines.slice(ellipsisIndex + 1);

    let actualFirst = hintFirst;
    let actualLast = hintLast;

    if (prefixLines.length > 0) {
      const found = this.findBlockStart(
        lines,
        prefixLines,
        hintFirst,
        SEARCH_WINDOW,
      );
      if (found !== -1) actualFirst = found;
    }

    if (suffixLines.length > 0) {
      const found = this.findBlockEnd(
        lines,
        suffixLines,
        hintLast,
        SEARCH_WINDOW,
      );
      if (found !== -1) actualLast = found;
    }

    if (actualFirst > actualLast) {
      return { actualFirst: hintFirst, actualLast: hintLast };
    }

    return { actualFirst, actualLast };
  }

  /**
   * Find where a block of lines starts in the file, searching near `hint` (1-indexed).
   * Returns 1-indexed line number or -1 if not found.
   */
  private findBlockStart(
    fileLines: string[],
    blockLines: string[],
    hint: number,
    window: number,
  ): number {
    if (blockLines.length === 0) return -1;

    for (let offset = 0; offset <= window; offset++) {
      const deltas = offset === 0 ? [0] : [offset, -offset];
      for (const delta of deltas) {
        const startIdx = hint - 1 + delta; // 0-indexed
        if (startIdx < 0 || startIdx + blockLines.length > fileLines.length) {
          continue;
        }

        let match = true;
        for (let i = 0; i < blockLines.length; i++) {
          const fileLine = fileLines[startIdx + i] ?? "";
          const searchLine = blockLines[i] ?? "";
          if (fileLine.trim() !== searchLine.trim()) {
            match = false;
            break;
          }
        }

        if (match) return startIdx + 1; // 1-indexed
      }
    }

    return -1;
  }

  /**
   * Find where a block of lines ends in the file, searching near `hint` (1-indexed).
   * Returns 1-indexed line number of the last line, or -1 if not found.
   */
  private findBlockEnd(
    fileLines: string[],
    blockLines: string[],
    hint: number,
    window: number,
  ): number {
    if (blockLines.length === 0) return -1;

    for (let offset = 0; offset <= window; offset++) {
      const deltas = offset === 0 ? [0] : [offset, -offset];
      for (const delta of deltas) {
        const endIdx = hint - 1 + delta; // 0-indexed
        const startIdx = endIdx - blockLines.length + 1;
        if (startIdx < 0 || endIdx >= fileLines.length) continue;

        let match = true;
        for (let i = 0; i < blockLines.length; i++) {
          const fileLine = fileLines[startIdx + i] ?? "";
          const searchLine = blockLines[i] ?? "";
          if (fileLine.trim() !== searchLine.trim()) {
            match = false;
            break;
          }
        }

        if (match) return endIdx + 1; // 1-indexed
      }
    }

    return -1;
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
