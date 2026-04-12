import "dotenv/config";
import { Sandbox } from "e2b";

let sharedSandbox: Sandbox | null = null;

export async function getSharedSandbox(): Promise<Sandbox> {
  if (sharedSandbox) return sharedSandbox;

  const template = process.env["SANDBOX_TEMPLATE"];
  if (!template) {
    throw new Error(
      "SANDBOX_TEMPLATE env var is required. Copy .env.example → .env and fill it in.",
    );
  }

  console.log(`Creating sandbox from template:`);
  sharedSandbox = await Sandbox.create(template, {
    timeoutMs: 60_000 * 10, // 10 minutes
  });

  console.log("Starting frontend and  OpenVSCode Server");
  await sharedSandbox.commands.run("bash /home/user/start.sh", {
    background: true,
  });

  await waitForPreview(sharedSandbox, 5173, 30_000);
  console.log(`sandbox ready `);
  console.log(`   Sandbox ID  : ${sharedSandbox.sandboxId}`);
  console.log(`   Preview URL : https://${sharedSandbox.getHost(5173)}`);
  console.log(`   VS Code URL : https://${sharedSandbox.getHost(3000)}`);

  return sharedSandbox;
}

export async function killSharedSandbox(): Promise<void> {
  if (!sharedSandbox) return;
  console.log("\n🛑 Killing sandbox...");
  await sharedSandbox.kill();
  sharedSandbox = null;
  console.log("   Done.");
}

async function waitForPreview(
  sandbox: Sandbox,
  port: number,
  maxWaitMs: number,
): Promise<void> {
  const url = `https://${sandbox.getHost(port)}`;
  const deadline = Date.now() + maxWaitMs;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 304) return;
    } catch (err) {
      lastError = err;
    }
    // Wait 1s before retrying
    await new Promise((r) => setTimeout(r, 1_000));
  }

  // Not treating a timeout as fatal — the app might still start soon
  console.warn(
    `   ⚠️  Timed out waiting for port ${port} (last error: ${lastError}). Continuing anyway.`,
  );
}
