export type ObjectStoreProvider = "s3" | "gcs";

export interface ObjectStorePutOptions {
  contentType?: string;
  cacheControl?: string;
}

export interface ObjectStoreGetOptions {
  expiresInSeconds?: number;
}

export interface S3ObjectStoreConfig {
  provider: "s3";
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  cdnDomain?: string;
}

export interface GcsObjectStoreConfig {
  provider: "gcs";
  bucket: string;
  projectId: string;
  serviceAccountKeyPath?: string;
  serviceAccountKeyJson?: string;
  cdnDomain?: string;
}

export type ObjectStoreConfig = S3ObjectStoreConfig | GcsObjectStoreConfig;

export class ObjectStoreError extends Error {
  readonly code: string;

  constructor(message: string, code = "OBJECT_STORE_ERROR") {
    super(message);
    this.name = "ObjectStoreError";
    this.code = code;
  }
}

export class ObjectStoreNotFoundError extends ObjectStoreError {
  constructor(message: string) {
    super(message, "NOT_FOUND");
    this.name = "ObjectStoreNotFoundError";
  }
}
