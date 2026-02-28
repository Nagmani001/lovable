import type { Sandbox } from "e2b";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export class ProjectDeployer {
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

  /**
   * Build the project inside the sandbox and upload the dist to S3.
   * Returns the deployed URL.
   */
  async deploy(
    sandbox: Sandbox,
    projectId: string,
    projectBasePath: string = "/home/user/project",
  ): Promise<string> {
    // Build the project
    const buildResult = await sandbox.commands.run(
      `cd ${projectBasePath} && npm run build`,
      { timeoutMs: 120_000 },
    );

    if (buildResult.exitCode !== 0) {
      throw new Error(
        `Build failed:\n${buildResult.stderr || buildResult.stdout}`,
      );
    }

    // Create a tar of the dist directory
    await sandbox.commands.run(
      `cd ${projectBasePath} && tar -cf /tmp/dist.tar -C dist .`,
      { timeoutMs: 15_000 },
    );

    // Read the tar from sandbox
    const distTarContent = await sandbox.files.read("/tmp/dist.tar");

    // Upload the dist tar to S3 (for a real deployment, you'd
    // extract and upload individual files to a static hosting bucket)
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: `deployments/${projectId}/dist.tar`,
        Body: Buffer.from(distTarContent, "binary"),
        ContentType: "application/x-tar",
      }),
    );

    // In production, you'd:
    // 1. Extract the tar
    // 2. Upload each file to an S3 bucket with static website hosting
    // 3. Or use Vercel/Netlify API
    // 4. Return the actual deployed URL

    return `https://${projectId}.your-domain.com`;
  }
}
