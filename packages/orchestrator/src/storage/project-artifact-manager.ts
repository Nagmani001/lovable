import { createObjectStore, ObjectStore } from "@repo/storage";
import type { ObjectStoreConfig } from "@repo/storage/types";
import type { Sandbox } from "e2b";

export class ProjectArtifactManager {
  private store: ObjectStore;

  constructor(config: ObjectStoreConfig) {
    this.store = createObjectStore(config);
  }

  async persistProject(
    sandbox: Sandbox,
    projectId: string,
    projectBasePath: string = "/home/user/project",
  ): Promise<void> {
    await sandbox.commands.run(
      `cd /home/user && tar -czf /tmp/project.tar.gz ` +
        `--exclude=node_modules --exclude=.git --exclude=dist ` +
        `-C "${projectBasePath}" .`,
      { timeoutMs: 30_000 },
    );

    const tarContent = await sandbox.files.read("/tmp/project.tar.gz", {
      format: "bytes",
    });

    await this.store.put(
      `projects/${projectId}/project.tar.gz`,
      Buffer.from(tarContent),
      { contentType: "application/gzip" },
    );

    await this.store.put(
      `projects/${projectId}/metadata.json`,
      Buffer.from(
        JSON.stringify({
          lastSaved: new Date().toISOString(),
          projectId,
        }),
      ),
      { contentType: "application/json" },
    );
  }

  async restoreProject(
    sandbox: Sandbox,
    projectId: string,
    projectBasePath: string = "/home/user/project",
  ): Promise<boolean> {
    const body = await this.store.get(`projects/${projectId}/project.tar.gz`);

    if (!body) return false;

    const arrayBuffer = body.buffer.slice(
      body.byteOffset,
      body.byteOffset + body.byteLength,
    ) as ArrayBuffer;

    await sandbox.files.write("/tmp/project.tar.gz", arrayBuffer);

    await sandbox.commands.run(
      `mkdir -p "${projectBasePath}" && ` +
        `cd "${projectBasePath}" && ` +
        `tar -xzf /tmp/project.tar.gz`,
      { timeoutMs: 30_000 },
    );

    await sandbox.commands.run("rm -f /tmp/project.tar.gz");

    console.log(`Restored project ${projectId} from object store`);
    return true;
  }

  async deleteProject(projectId: string): Promise<void> {
    const keys = [
      `projects/${projectId}/project.tar.gz`,
      `projects/${projectId}/metadata.json`,
    ];

    await Promise.all(
      keys.map((key) => this.store.delete(key).catch(() => {})),
    );
  }

  async deployProject(
    sandbox: Sandbox,
    projectId: string,
    projectBasePath: string = "/home/user/project",
  ): Promise<string> {
    const buildResult = await sandbox.commands.run(
      `cd ${projectBasePath} && npm run build`,
      { timeoutMs: 120_000 },
    );

    if (buildResult.exitCode !== 0) {
      throw new Error(
        `Build failed:\n${buildResult.stderr || buildResult.stdout}`,
      );
    }

    await sandbox.commands.run(
      `cd ${projectBasePath} && tar -cf /tmp/dist.tar -C dist .`,
      { timeoutMs: 15_000 },
    );

    const distTarContent = await sandbox.files.read("/tmp/dist.tar", {
      format: "bytes",
    });

    await this.store.put(
      `deployments/${projectId}/dist.tar`,
      Buffer.from(distTarContent),
      { contentType: "application/x-tar" },
    );

    return `https://${projectId}.your-domain.com`;
  }
}
