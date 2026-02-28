import { Template, defaultBuildLogger } from "e2b";
import { template } from "./template";

async function main() {
  await Template.build(template, "lovable-template", {
    cpuCount: 6,
    memoryMB: 1536,
    onBuildLogs: defaultBuildLogger(),
  });
  console.log(`Template built successfully!`);
}

main().catch(console.error);
