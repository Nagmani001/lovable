import { createObjectStore, ObjectStore } from "@repo/storage";
import type { ObjectStoreConfig } from "@repo/storage/types";

let objectStore: ObjectStore | null = null;

export function buildObjectStoreConfig(): ObjectStoreConfig {
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

export function getObjectStore(): ObjectStore {
  if (!objectStore) {
    objectStore = createObjectStore(buildObjectStoreConfig());
  }
  return objectStore;
}
