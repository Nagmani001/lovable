import { Sandbox } from "e2b";

async function main() {
  const sandbox = await Sandbox.create("lovable-template", {
    timeoutMs: 60_000 * 60,
  });

  console.log(`Sandbox ID: ${sandbox.sandboxId}`);
  console.log(`Sandbox URL: https://${sandbox.getHost(5173)}`);
  console.log(`VS Code URL: https://${sandbox.getHost(3000)}`);

  console.log("\nStarting Vite + OpenVSCode Server...");
  await sandbox.commands.run("bash /home/user/start.sh", {
    background: true,
  });

  process.on("SIGINT", async () => {
    console.log("\nShutting down sandbox...");
    await sandbox.kill();
    console.log("Done.");
    process.exit(0);
  });

  // keep the terminal stuck
  await new Promise(() => {});
}

main().catch(console.error);
