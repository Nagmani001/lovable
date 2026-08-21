import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import type { Sandbox } from "e2b";

export class ProjectArtifactManager {
  private s3: S3Client;
  private bucket: string;

  constructor(config: {
    region: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
  }) {
    this.s3 = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
    this.bucket = config.bucket;
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

    const tarContent = await sandbox.files.read("/tmp/project.tar.gz");

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: `projects/${projectId}/project.tar.gz`,
        Body: Buffer.from(tarContent, "binary"),
        ContentType: "application/gzip",
      }),
    );

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: `projects/${projectId}/metadata.json`,
        Body: JSON.stringify({
          lastSaved: new Date().toISOString(),
          projectId,
        }),
        ContentType: "application/json",
      }),
    );
  }

  async restoreProject(
    sandbox: Sandbox,
    projectId: string,
    projectBasePath: string = "/home/user/project",
  ): Promise<boolean> {
    try {
      const response = await this.s3.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: `projects/${projectId}/project.tar.gz`,
        }),
      );

      if (!response.Body) return false;

      const bodyBytes = await response.Body.transformToByteArray();
      const bodyString = Buffer.from(bodyBytes).toString("binary");

      await sandbox.files.write("/tmp/project.tar.gz", bodyString);

      await sandbox.commands.run(
        `mkdir -p "${projectBasePath}" && ` +
          `cd "${projectBasePath}" && ` +
          `tar -xzf /tmp/project.tar.gz`,
        { timeoutMs: 30_000 },
      );

      await sandbox.commands.run("rm -f /tmp/project.tar.gz");

      console.log(`Restored project ${projectId} from S3`);
      return true;
    } catch (err: unknown) {
      const error = err as { name?: string };
      if (error.name === "NoSuchKey") {
        return false;
      }
      throw err;
    }
  }

  async deleteProject(projectId: string): Promise<void> {
    const keys = [
      `projects/${projectId}/project.tar.gz`,
      `projects/${projectId}/metadata.json`,
    ];

    await Promise.all(
      keys.map((Key) =>
        this.s3
          .send(new DeleteObjectCommand({ Bucket: this.bucket, Key }))
          .catch(() => {}),
      ),
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

    const distTarContent = await sandbox.files.read("/tmp/dist.tar");

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: `deployments/${projectId}/dist.tar`,
        Body: Buffer.from(distTarContent, "binary"),
        ContentType: "application/x-tar",
      }),
    );

    return `https://${projectId}.your-domain.com`;
  }
}
