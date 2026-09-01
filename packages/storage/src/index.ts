import { S3ObjectStore } from "./aws-s3.js";
import { GcsObjectStore } from "./gcp-gcs.js";
import { ObjectStore } from "./objectStoreProtocol.js";
import type { ObjectStoreConfig } from "./types.js";

export { ObjectStore } from "./objectStoreProtocol.js";
export { S3ObjectStore } from "./aws-s3.js";
export { GcsObjectStore } from "./gcp-gcs.js";
export * from "./types.js";

export function createObjectStore(config: ObjectStoreConfig): ObjectStore {
  switch (config.provider) {
    case "s3":
      return new S3ObjectStore(config);
    case "gcs":
      return new GcsObjectStore(config);
    default:
      throw new Error(
        `Unsupported object store provider: ${JSON.stringify(config)}`,
      );
  }
}

export function buildObjectStoreConfigFromEnv(): ObjectStoreConfig {
  const provider = process.env.OBJECT_STORE_PROVIDER || "s3";

  if (provider === "gcs") {
    return {
      provider: "gcs",
      bucket: process.env.GCS_BUCKET || "",
      projectId: process.env.GCS_PROJECT_ID || "",
      serviceAccountKeyJson: process.env.GCS_SERVICE_ACCOUNT_KEY,
      serviceAccountKeyPath: process.env.GCS_SERVICE_ACCOUNT_KEY_PATH,
      cdnDomain: process.env.GCS_CDN_DOMAIN,
    };
  }

  return {
    provider: "s3",
    bucket: process.env.S3_BUCKET || "lovable-projects",
    region: process.env.AWS_REGION || "us-east-1",
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    cdnDomain: process.env.S3_CDN_DOMAIN,
  };
}

export function createObjectStoreFromEnv(): ObjectStore {
  return createObjectStore(buildObjectStoreConfigFromEnv());
}
