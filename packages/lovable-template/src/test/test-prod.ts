import { Sandbox } from "e2b";

async function main() {
  console.log("Starting production sandbox...");
  const sandbox = await Sandbox.create("lovable-template", {
    timeoutMs: 60_000 * 60,
  });

  console.log(`Sandbox ID: ${sandbox.sandboxId}`);
  console.log(`Sandbox URL: https://${sandbox.getHost(5173)}`);
  console.log(`VS Code URL: https://${sandbox.getHost(3000)}`);

  console.log("\nStarting Vite + OpenVSCode Server...");
  const proc = await sandbox.commands.run("bash /home/user/start.sh", {
    background: true,
  });

  await new Promise((r) => setTimeout(r, 5000));

  const ps = await sandbox.commands.run(
    "ps aux | grep -E 'vite|openvscode' | grep -v grep",
  );
  console.log("\nRunning processes:");
  console.log(ps.stdout);

  const ports = await sandbox.commands.run("ss -tlnp | grep -E '5173|3000'");
  console.log("Listening ports:");
  console.log(ports.stdout);

  console.log("\n--- Production Sandbox is running ---");
  console.log("Press Ctrl+C to stop and kill the sandbox.");

  process.on("SIGINT", async () => {
    console.log("\nShutting down sandbox...");
    await sandbox.kill();
    console.log("Done.");
    process.exit(0);
  });

  await new Promise(() => {});
}

main().catch(console.error);
