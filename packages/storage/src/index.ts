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
