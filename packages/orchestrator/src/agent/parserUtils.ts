export function filterErrorsByFiles(
  tscOutput: string,
  modifiedFiles: string[],
): { filteredErrors: string; errorFiles: string[] } {
  if (!tscOutput || !tscOutput.trim()) {
    return { filteredErrors: "", errorFiles: [] };
  }

  const lines = tscOutput.split("\n");
  const matchedLines: string[] = [];
  const errorFileSet = new Set<string>();

  for (const line of lines) {
    // tsc error format: path(line,col): error TSxxxx: message
    const match = line.match(/^(.+?)\(\d+,\d+\):\s*error\s+TS\d+:/);
    if (!match) continue;

    const errorPath = match[1]!.trim();

    // Check if this file path matches any modified file
    for (const modFile of modifiedFiles) {
      if (
        errorPath === modFile ||
        errorPath.endsWith(`/${modFile}`) ||
        modFile.endsWith(`/${errorPath}`) ||
        errorPath.endsWith(modFile)
      ) {
        matchedLines.push(line);
        errorFileSet.add(modFile);
        break;
      }
    }
  }

  return {
    filteredErrors: matchedLines.join("\n"),
    errorFiles: [...errorFileSet],
  };
}

export function parseBuildErrors(rawOutput: string): string {
  const clean = rawOutput.replace(/\x1b\[[0-9;]*m/g, "");
  const lines = clean.split("\n");
  const errorLines: string[] = [];
  let capturing = false;

  for (const line of lines) {
    if (
      line.includes("error during build") ||
      line.includes("ERROR") ||
      line.includes("Build failed") ||
      line.includes("[plugin:") ||
      line.match(/^\s*\d+\s*\|/) || // source code lines from vite error display
      line.includes("SyntaxError") ||
      line.includes("CssSyntaxError") ||
      line.includes("RollupError") ||
      line.includes("Could not resolve")
    ) {
      capturing = true;
    }

    if (capturing) {
      const trimmed = line.trim();
      // Stop capturing on blank lines after we've collected some errors
      if (!trimmed && errorLines.length > 0) {
        capturing = false;
        continue;
      }
      if (trimmed) {
        errorLines.push(trimmed);
      }
    }
  }

  // Cap at 30 lines to avoid flooding the LLM context
  return errorLines.slice(0, 30).join("\n");
}
