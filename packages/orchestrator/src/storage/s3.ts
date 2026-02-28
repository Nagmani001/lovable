import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import type { Sandbox } from "e2b";

export class ProjectStorage {
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

  /*
   * Persist project files from sandbox to S3 as a tar.gz archive.
   * Excludes node_modules, .git, and dist to keep the archive small.
   */
  async persistProject(
    sandbox: Sandbox,
    projectId: string,
    projectBasePath: string = "/home/user/project",
  ): Promise<void> {
    // Create tar.gz inside the sandbox
    await sandbox.commands.run(
      `cd /home/user && tar -czf /tmp/project.tar.gz ` +
        `--exclude=node_modules --exclude=.git --exclude=dist ` +
        `-C "${projectBasePath}" .`,
      { timeoutMs: 30_000 },
    );

    // Read the tar.gz from sandbox
    const tarContent = await sandbox.files.read("/tmp/project.tar.gz");

    // Upload to S3
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: `projects/${projectId}/project.tar.gz`,
        Body: Buffer.from(tarContent, "binary"),
        ContentType: "application/gzip",
      }),
    );

    // Save metadata
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

  /**
   * Restore project files from S3 into a sandbox.
   * Returns true if files were restored, false if no backup exists.
   */
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

      // Write tar.gz to sandbox
      await sandbox.files.write("/tmp/project.tar.gz", bodyString);

      // Extract into project directory
      await sandbox.commands.run(
        `mkdir -p "${projectBasePath}" && ` +
          `cd "${projectBasePath}" && ` +
          `tar -xzf /tmp/project.tar.gz`,
        { timeoutMs: 30_000 },
      );

      // Clean up tar file
      await sandbox.commands.run("rm -f /tmp/project.tar.gz");

      console.log(`Restored project ${projectId} from S3`);
      return true;
    } catch (err: unknown) {
      const error = err as { name?: string };
      if (error.name === "NoSuchKey") {
        // New project, no backup exists
        return false;
      }
      throw err;
    }
  }

  /**
   * Delete all S3 data for a project.
   */
  async deleteProject(projectId: string): Promise<void> {
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");

    const keys = [
      `projects/${projectId}/project.tar.gz`,
      `projects/${projectId}/metadata.json`,
    ];

    await Promise.all(
      keys.map((Key) =>
        this.s3
          .send(new DeleteObjectCommand({ Bucket: this.bucket, Key }))
          .catch(() => {
            /* ignore missing keys */
          }),
      ),
    );
  }
}
