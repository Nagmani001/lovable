import { parseBuildErrors } from "./parserUtils.js";

export async function runTypeCheck(
  sandbox: import("e2b").Sandbox,
  projectBasePath: string,
): Promise<string> {
  try {
    const result = await sandbox.commands.run(
      `cd ${projectBasePath} && npx tsc --noEmit -p tsconfig.app.json 2>&1 || true`,
      { timeoutMs: 60_000 },
    );

    console.log("typescript check output result : ", result);
    return result.stdout || "";
  } catch (err: any) {
    if (err?.result?.stdout) {
      return err.result.stdout as string;
    }
    console.error("[fixup] tsc command failed unexpectedly:", err);
    return "";
  }
}

export async function runBuildCheck(
  sandbox: import("e2b").Sandbox,
  projectBasePath: string,
): Promise<string> {
  try {
    const result = await sandbox.commands.run(
      `cd ${projectBasePath} && npx vite build 2>&1 || true`,
      { timeoutMs: 90_000 },
    );
    console.log("build output result : ", result);
    const output = result.stdout || "";
    // Vite prints "error" in the output when the build fails
    if (
      output.includes("error during build") ||
      output.includes("ERROR") ||
      output.includes("Build failed")
    ) {
      return parseBuildErrors(output);
    }
    return "";
  } catch (err: any) {
    if (err?.result?.stdout) {
      return parseBuildErrors(err.result.stdout as string);
    }
    console.error("[fixup] build check failed unexpectedly:", err);
    return "";
  }
}
