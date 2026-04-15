import { readFileSync, readdirSync, statSync } from "fs";
import { resolve, dirname, relative, basename, extname } from "path";
import { fileURLToPath } from "url";
import type { Intent } from "./intent-classifier.js";
import { initialContext } from "./initial-context.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const TEMPLATE_DIR = resolve(
  __dirname,
  "../../../e2b-template/src/starter-project-lovable/",
);

const RECENT_WRITES_LIMIT = 5;

const BASELINE_CONTENT_FILES = [
  "package.json",
  "tailwind.config.ts",
  "components.json",
  "src/index.css",
  "src/App.tsx",
  "src/main.tsx",
  "src/pages/Index.tsx",
  "src/pages/NotFound.tsx",
  "src/lib/utils.ts",
  "src/hooks/use-mobile.tsx",
  "src/hooks/use-toast.ts",
  "src/components/NavLink.tsx",
];

function langForExt(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    ".tsx": "tsx",
    ".ts": "typescript",
    ".jsx": "jsx",
    ".js": "javascript",
    ".css": "css",
    ".json": "json",
    ".html": "html",
  };
  return map[ext] || "";
}

function walkDir(dir: string, base: string): string[] {
  const results: string[] = [];
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      if (
        entry === "node_modules" ||
        entry === ".git" ||
        entry === "bun.lockb" ||
        entry === "package-lock.json"
      ) {
        continue;
      }
      const full = resolve(dir, entry);
      const rel = relative(base, full);
      try {
        const stat = statSync(full);
        if (stat.isDirectory()) {
          results.push(...walkDir(full, base));
        } else {
          results.push(rel);
        }
      } catch {
        // skip unreadable entries
      }
    }
  } catch {
    // skip unreadable dirs
  }
  return results;
}

function extractTargetFiles(message: string, fileTree: Set<string>): string[] {
  // strip punctuation, lowercase
  const words = message
    .toLowerCase()
    .replace(/['"`.]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);

  const candidates: string[] = [];
  for (const filePath of fileTree) {
    const fileBase = basename(filePath)
      .toLowerCase()
      .replace(/\.(tsx?|jsx?|css|json|html)$/, "");
    for (const word of words) {
      if (fileBase === word || filePath.toLowerCase().includes(word)) {
        if (!candidates.includes(filePath)) {
          candidates.push(filePath);
        }
      }
    }
  }
  return candidates
    .sort((a, b) => {
      const aSrc = a.startsWith("src/") ? 0 : 1;
      const bSrc = b.startsWith("src/") ? 0 : 1;
      return aSrc - bSrc;
    })
    .slice(0, 3);
}

export class ContextManager {
  files: Map<string, string> = new Map();
  fileTree: Set<string> = new Set();
  uiComponents: string[] = [];

  private recentWrites: string[] = [];

  /** Tracks ALL files modified during this session (not capped like recentWrites). */
  private allModifiedFiles: Set<string> = new Set();

  private consoleLogs: string[] = [];

  private networkRequests: string[] = [];

  private constructor() {}

  static createFromBaseline(): ContextManager {
    const ctx = new ContextManager();

    const allFiles = walkDir(TEMPLATE_DIR, TEMPLATE_DIR);
    for (const f of allFiles) {
      ctx.fileTree.add(f);
    }

    for (const relPath of BASELINE_CONTENT_FILES) {
      try {
        const content = readFileSync(resolve(TEMPLATE_DIR, relPath), "utf-8");
        ctx.files.set(relPath, content);
      } catch {
        // File might not exist in template, skip
      }
    }

    const uiDir = resolve(TEMPLATE_DIR, "src/components/ui");
    try {
      const uiFiles = readdirSync(uiDir);
      ctx.uiComponents = uiFiles
        .filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"))
        .map((f) => basename(f, extname(f)))
        .filter((name) => name !== "use-toast")
        .sort();
    } catch {
      // No UI dir
    }

    return ctx;
  }

  applyWrite(path: string, content: string): void {
    const rel = this.normalizePath(path);
    this.fileTree.add(rel);
    this.files.set(rel, content);
    this.pushRecentWrite(rel);
    this.allModifiedFiles.add(rel);
  }

  applyDelete(path: string): void {
    const rel = this.normalizePath(path);
    this.fileTree.delete(rel);
    this.files.delete(rel);
    this.allModifiedFiles.add(rel);
  }

  applyRename(from: string, to: string): void {
    const relFrom = this.normalizePath(from);
    const relTo = this.normalizePath(to);

    const content = this.files.get(relFrom);
    if (content !== undefined) {
      this.files.delete(relFrom);
      this.files.set(relTo, content);
    }

    this.fileTree.delete(relFrom);
    this.fileTree.add(relTo);
    this.pushRecentWrite(relTo);
    this.allModifiedFiles.add(relTo);
  }

  applyLineReplace(path: string, newFullContent: string): void {
    const rel = this.normalizePath(path);
    if (this.files.has(rel)) {
      this.files.set(rel, newFullContent);
    }
    this.pushRecentWrite(rel);
    this.allModifiedFiles.add(rel);
  }

  storeConsoleLogs(logs: string[]): void {
    this.consoleLogs = logs;
  }

  storeNetworkRequests(requests: string[]): void {
    this.networkRequests = requests;
  }

  generateInitializationContext(): string {
    return initialContext;
  }

  /**
   * Returns all files modified during this session.
   */
  getModifiedFiles(): string[] {
    return [...this.allModifiedFiles];
  }

  /**
   * Clears the modified files tracker (call between sessions).
   */
  clearModifiedFiles(): void {
    this.allModifiedFiles.clear();
  }

  /**
   * Generates a structured <useful-context> block for the TypeScript fix-up loop.
   * Includes the filtered tsc errors and the full content of small files
   * (< 100 lines) that have errors, so the AI can fix them without lov-view.
   */
  generateTypeCheckContext(
    filteredErrors: string,
    errorFiles: string[],
  ): string {
    const sections: string[] = [];

    sections.push("## TypeScript Errors\n");
    sections.push(
      "The following TypeScript errors were found in files you modified.",
    );
    sections.push("Fix ALL errors using `lov-line-replace` or `lov-write`.\n");
    sections.push("```\n" + filteredErrors + "\n```");

    // Include file contents for small files so the AI doesn't need to lov-view
    const fileContents: string[] = [];
    for (const filePath of errorFiles) {
      const content = this.files.get(filePath);
      if (!content) continue;
      const lineCount = content.split("\n").length;
      if (lineCount <= 100) {
        const lang = filePath.endsWith(".tsx")
          ? "tsx"
          : filePath.endsWith(".ts")
            ? "typescript"
            : "";
        fileContents.push(`### ${filePath}\n\`\`\`${lang}\n${content}\n\`\`\``);
      } else {
        fileContents.push(
          `### ${filePath}\n(${lineCount} lines — use lov-view to inspect)`,
        );
      }
    }

    if (fileContents.length > 0) {
      sections.push("\n## Files With Errors\n");
      sections.push(fileContents.join("\n\n"));
    }

    return `<useful-context>\n${sections.join("\n")}\n</useful-context>`;
  }

  generateContext(intent: Intent, userMessage: string): string {
    const sections: string[] = [];

    switch (intent) {
      case "ui_styling": {
        sections.push(this.sectionFileTree());
        sections.push(this.sectionDesignSystem());
        const targets = extractTargetFiles(userMessage, this.fileTree);
        if (targets.length > 0)
          sections.push(this.sectionTargetFiles("Target Files", targets));
        const recent = this.sectionRecentlyModified(targets);
        if (recent) sections.push(recent);
        break;
      }

      case "animation": {
        sections.push(this.sectionFileTree());
        sections.push(this.sectionDesignSystem());
        const targets = extractTargetFiles(userMessage, this.fileTree);
        if (targets.length > 0)
          sections.push(this.sectionTargetFiles("Target Files", targets));
        break;
      }

      case "responsive_layout": {
        sections.push(this.sectionFileTree());
        sections.push(this.sectionDesignSystem());
        const targets = extractTargetFiles(userMessage, this.fileTree);
        if (targets.length > 0)
          sections.push(this.sectionTargetFiles("Target Files", targets));
        break;
      }

      case "new_feature": {
        sections.push(this.sectionFileTree());
        sections.push(this.sectionDesignSystem());
        sections.push(this.sectionAppStructure());
        const targets = extractTargetFiles(userMessage, this.fileTree);
        if (targets.length > 0)
          sections.push(
            this.sectionTargetFiles("Related Existing Components", targets),
          );
        const recent = this.sectionRecentlyModified(targets);
        if (recent) sections.push(recent);
        break;
      }

      case "bug_fix": {
        sections.push(this.sectionFileTree());
        const consoleSec = this.sectionConsoleLogs();
        if (consoleSec) sections.push(consoleSec);
        const networkSec = this.sectionNetworkRequests();
        if (networkSec) sections.push(networkSec);
        const targets = extractTargetFiles(userMessage, this.fileTree);
        if (targets.length > 0)
          sections.push(this.sectionTargetFiles("Target Files", targets));
        const recent = this.sectionRecentlyModified(targets);
        if (recent) sections.push(recent);
        break;
      }

      case "logic_state": {
        sections.push(this.sectionFileTree());
        const targets = extractTargetFiles(userMessage, this.fileTree);
        if (targets.length > 0)
          sections.push(this.sectionTargetFiles("Target Files", targets));
        const sharedState = this.sectionSharedState();
        if (sharedState) sections.push(sharedState);
        const recent = this.sectionRecentlyModified(targets);
        if (recent) sections.push(recent);
        break;
      }

      case "data_api": {
        sections.push(this.sectionFileTree());
        sections.push(this.sectionAppStructure());
        const dataLayer = this.sectionDataLayer();
        if (dataLayer) sections.push(dataLayer);
        const targets = extractTargetFiles(userMessage, this.fileTree);
        if (targets.length > 0)
          sections.push(this.sectionTargetFiles("Target Files", targets));
        const types = this.sectionTypes();
        if (types) sections.push(types);
        break;
      }

      case "navigation_routing": {
        sections.push(this.sectionFileTree());
        sections.push(this.sectionAppStructure());
        const navComponents = this.sectionNavComponents();
        if (navComponents) sections.push(navComponents);
        const targets = extractTargetFiles(userMessage, this.fileTree);
        if (targets.length > 0)
          sections.push(this.sectionTargetFiles("Target Page", targets));
        break;
      }

      case "refactor": {
        sections.push(this.sectionFileTree());
        const targets = extractTargetFiles(userMessage, this.fileTree);
        if (targets.length > 0)
          sections.push(this.sectionTargetFiles("Target Files", targets));
        const recent = this.sectionRecentlyModified(targets);
        if (recent) sections.push(recent);
        break;
      }

      case "typescript_types": {
        sections.push(this.sectionFileTree());
        const types = this.sectionTypes();
        if (types) sections.push(types);
        const targets = extractTargetFiles(userMessage, this.fileTree);
        if (targets.length > 0)
          sections.push(this.sectionTargetFiles("Target Files", targets));
        break;
      }

      case "content_copy": {
        // Minimal context — just the file containing the text.
        const targets = extractTargetFiles(userMessage, this.fileTree);
        if (targets.length > 0) {
          sections.push(this.sectionTargetFiles("Target Files", targets));
        } else {
          // Fall back to file tree so LLM can locate the right file itself.
          sections.push(this.sectionFileTree());
        }
        break;
      }

      case "question":
      default: {
        sections.push(this.sectionFileTree());
        sections.push(this.sectionPackageInfo());
        break;
      }
    }

    const body = sections.filter(Boolean).join("\n\n");
    return `<useful-context>\n${body}\n</useful-context>`;
  }

  private sectionFileTree(): string {
    const sorted = [...this.fileTree].sort();
    const lines = sorted.map((f) => `  ${f}`);
    return `## File Structure\n${lines.join("\n")}`;
  }

  private sectionDesignSystem(): string {
    const parts: string[] = ["## Design System"];
    for (const key of ["src/index.css", "tailwind.config.ts"]) {
      const content = this.files.get(key);
      if (content) {
        const lang = langForExt(key);
        parts.push(`### ${key}\n\`\`\`${lang}\n${content}\n\`\`\``);
      }
    }
    return parts.length > 1 ? parts.join("\n\n") : "";
  }

  private sectionAppStructure(): string {
    const content = this.files.get("src/App.tsx");
    if (!content) return "";
    return `## App Structure\n### src/App.tsx\n\`\`\`tsx\n${content}\n\`\`\``;
  }

  private sectionTargetFiles(heading: string, filePaths: string[]): string {
    const parts: string[] = [`## ${heading}`];
    for (const p of filePaths) {
      const content = this.files.get(p);
      if (content) {
        const lang = langForExt(p);
        parts.push(`### ${p}\n\`\`\`${lang}\n${content}\n\`\`\``);
      }
    }
    return parts.length > 1 ? parts.join("\n\n") : "";
  }

  private sectionRecentlyModified(excludePaths: string[] = []): string {
    const recent = this.recentWrites
      .filter((p) => !excludePaths.includes(p))
      .slice(-RECENT_WRITES_LIMIT);
    if (recent.length === 0) return "";
    return this.sectionTargetFiles("Recently Modified", recent);
  }

  private sectionSharedState(): string {
    // Look for context files, stores, or hooks
    const candidates = [...this.fileTree].filter(
      (p) =>
        p.match(/\/(context|store|stores|hooks|state)\//i) ||
        p.match(/(use[A-Z][a-zA-Z]+|Store|Context|Provider)\.(tsx?|jsx?)$/),
    );
    if (candidates.length === 0) return "";
    return this.sectionTargetFiles(
      "Shared State / Utilities",
      candidates.slice(0, 3),
    );
  }

  private sectionDataLayer(): string {
    const candidates = [...this.fileTree].filter(
      (p) =>
        p.match(/\/(api|lib|services|utils|hooks)\//i) ||
        p.match(/(api|client|supabase|firebase|service|query)\.(tsx?|jsx?)$/i),
    );
    if (candidates.length === 0) return "";
    return this.sectionTargetFiles(
      "Existing Data Layer",
      candidates.slice(0, 4),
    );
  }

  private sectionNavComponents(): string {
    const candidates = [...this.fileTree].filter(
      (p) =>
        p.match(
          /(navbar|nav-bar|sidebar|navigation|header|breadcrumb|menubar)\.(tsx?|jsx?)$/i,
        ) || p.toLowerCase().includes("navlink"),
    );
    if (candidates.length === 0) return "";
    return this.sectionTargetFiles("Navigation Components", candidates);
  }

  private sectionTypes(): string {
    const candidates = [...this.fileTree].filter(
      (p) =>
        p.match(/\/types\//i) ||
        p.endsWith(".d.ts") ||
        p.match(/types?\.(tsx?|jsx?)$/i),
    );
    if (candidates.length === 0) return "";
    return this.sectionTargetFiles("Types", candidates.slice(0, 4));
  }

  private sectionPackageInfo(): string {
    const content = this.files.get("package.json");
    if (!content) return "";
    return `## Package Info\n### package.json\n\`\`\`json\n${content}\n\`\`\``;
  }

  private sectionConsoleLogs(): string {
    if (this.consoleLogs.length === 0) return "";
    return `## Console Logs\n${this.consoleLogs.join("\n")}`;
  }

  private sectionNetworkRequests(): string {
    if (this.networkRequests.length === 0) return "";
    return `## Network Requests\n${this.networkRequests.join("\n")}`;
  }

  private pushRecentWrite(rel: string): void {
    // Remove existing occurrence to avoid duplicates, then push to end
    this.recentWrites = this.recentWrites.filter((p) => p !== rel);
    this.recentWrites.push(rel);
    if (this.recentWrites.length > RECENT_WRITES_LIMIT) {
      this.recentWrites.shift();
    }
  }

  private normalizePath(path: string): string {
    let p = path.startsWith("./") ? path.slice(2) : path;
    if (p.startsWith("/")) {
      const markers = ["/home/user/project/", "/project/"];
      for (const marker of markers) {
        if (p.startsWith(marker)) {
          p = p.slice(marker.length);
          break;
        }
      }
      if (p.startsWith("/")) {
        p = p.slice(1);
      }
    }
    return p;
  }
}
