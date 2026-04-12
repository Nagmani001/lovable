//BUG: written by AI , not working currently  , i always send the initial context .
import { readFileSync, readdirSync, statSync } from "fs";
import { resolve, dirname, relative, basename, extname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const TEMPLATE_DIR =
  "/home/nagmani/root/projects/lovable/packages/e2b-template/src/starter-project-lovable/";

/**
 * Files whose full content is tracked in context (relative to project root).
 */
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

/**
 * Extension-to-language map for code fences.
 */
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

/**
 * Recursively collects all file paths under a directory, relative to `base`.
 */
function walkDir(dir: string, base: string): string[] {
  const results: string[] = [];
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      // Skip noise directories
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

export class ContextManager {
  /** Relative path -> full file content (for important/tracked files) */
  files: Map<string, string> = new Map();

  /** All known file paths in the project (for tree display) */
  fileTree: Set<string> = new Set();

  /** shadcn UI component names (name only, not content) */
  uiComponents: string[] = [];

  private constructor() {}

  /**
   * Create a ContextManager seeded from the starter template on local disk.
   */
  static createFromBaseline(): ContextManager {
    const ctx = new ContextManager();

    // Walk the template directory to build the file tree
    const allFiles = walkDir(TEMPLATE_DIR, TEMPLATE_DIR);
    for (const f of allFiles) {
      ctx.fileTree.add(f);
    }

    // Read content for tracked baseline files
    for (const relPath of BASELINE_CONTENT_FILES) {
      try {
        const content = readFileSync(resolve(TEMPLATE_DIR, relPath), "utf-8");
        ctx.files.set(relPath, content);
      } catch {
        // File might not exist in template, skip
      }
    }

    // Discover UI component names from src/components/ui/
    const uiDir = resolve(TEMPLATE_DIR, "src/components/ui");
    try {
      const uiFiles = readdirSync(uiDir);
      ctx.uiComponents = uiFiles
        .filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"))
        .map((f) => basename(f, extname(f)))
        .filter((name) => name !== "use-toast") // use-toast is a hook, not a component
        .sort();
    } catch {
      // No UI dir
    }

    return ctx;
  }

  // ═══════════════════════════════════════════
  // MUTATION METHODS
  // ═══════════════════════════════════════════

  /**
   * Track a file write (new file or update).
   */
  applyWrite(path: string, content: string): void {
    const rel = this.normalizePath(path);
    this.fileTree.add(rel);
    this.files.set(rel, content);
  }

  /**
   * Track a file deletion.
   */
  applyDelete(path: string): void {
    const rel = this.normalizePath(path);
    this.fileTree.delete(rel);
    this.files.delete(rel);
  }

  /**
   * Track a file rename/move.
   */
  applyRename(from: string, to: string): void {
    const relFrom = this.normalizePath(from);
    const relTo = this.normalizePath(to);

    // Move content if tracked
    const content = this.files.get(relFrom);
    if (content !== undefined) {
      this.files.delete(relFrom);
      this.files.set(relTo, content);
    }

    // Update tree
    this.fileTree.delete(relFrom);
    this.fileTree.add(relTo);
  }

  /**
   * Track a line-replace operation (update content for a tracked file).
   */
  applyLineReplace(path: string, newFullContent: string): void {
    const rel = this.normalizePath(path);
    if (this.files.has(rel)) {
      this.files.set(rel, newFullContent);
    }
  }

  // ═══════════════════════════════════════════
  // CONTEXT GENERATION
  // ═══════════════════════════════════════════

  /**
   * Generate the full <useful-context> block to inject into the user message.
   */
  generateContext(): string {
    const sections: string[] = [];

    // 1. File tree
    sections.push(this.generateFileTree());

    // 2. Dependencies from package.json
    sections.push(this.generateDependencies());

    // 3. UI component list
    if (this.uiComponents.length > 0) {
      sections.push(this.generateUIComponents());
    }

    // 4. Current code (tracked file contents)
    sections.push(this.generateCurrentCode());

    return `<useful-context>\n${sections.join("\n\n")}\n</useful-context>`;
  }

  private generateFileTree(): string {
    const sorted = [...this.fileTree].sort();
    const lines = sorted.map((f) => `  ${f}`);
    return `## File Structure\n${lines.join("\n")}`;
  }

  private generateDependencies(): string {
    const pkgContent = this.files.get("package.json");
    if (!pkgContent)
      return "## Installed Dependencies\n  (no package.json found)";

    try {
      const pkg = JSON.parse(pkgContent) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      const deps = pkg.dependencies || {};
      const lines = Object.entries(deps)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, version]) => `  ${name}: ${version}`);
      return `## Installed Dependencies\n${lines.join("\n")}`;
    } catch {
      return "## Installed Dependencies\n  (could not parse package.json)";
    }
  }

  private generateUIComponents(): string {
    return `## Available UI Components (import from @/components/ui/)\n${this.uiComponents.join(", ")}`;
  }

  private generateCurrentCode(): string {
    const sections: string[] = ["## Current Code"];

    // Sort files for consistent output
    const sortedFiles = [...this.files.entries()].sort(([a], [b]) =>
      a.localeCompare(b),
    );

    for (const [path, content] of sortedFiles) {
      // Skip package.json from code section (already shown in dependencies)
      if (path === "package.json") continue;

      const lang = langForExt(path);
      sections.push(`### ${path}\n\`\`\`${lang}\n${content}\n\`\`\``);
    }

    return sections.join("\n\n");
  }

  /**
   * Normalize a file path to be relative (strip leading slash or project base path prefix).
   */
  private normalizePath(path: string): string {
    // Strip leading "./" if present
    let p = path.startsWith("./") ? path.slice(2) : path;
    // If it's an absolute path, try to make it relative by stripping common prefixes
    if (p.startsWith("/")) {
      // Look for common sandbox base paths
      const markers = ["/home/user/project/", "/project/"];
      for (const marker of markers) {
        if (p.startsWith(marker)) {
          p = p.slice(marker.length);
          break;
        }
      }
      // If still absolute, just strip the leading slash
      if (p.startsWith("/")) {
        p = p.slice(1);
      }
    }
    return p;
  }
}
