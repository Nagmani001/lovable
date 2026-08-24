import { Storage } from "@google-cloud/storage";
import type { SaveOptions, StorageOptions } from "@google-cloud/storage";
import { ObjectStore } from "./objectStoreProtocol.js";
import type { ObjectStorePutOptions, GcsObjectStoreConfig } from "./types.js";

export class GcsObjectStore extends ObjectStore {
  readonly provider = "gcs" as const;

  private storage: Storage;
  private bucket: string;
  private cdnDomain?: string;

  constructor(config: GcsObjectStoreConfig) {
    super();
    this.bucket = config.bucket;
    this.cdnDomain = config.cdnDomain;

    const storageOptions: StorageOptions = {
      projectId: config.projectId,
    };
    if (config.serviceAccountKeyJson) {
      storageOptions.credentials = JSON.parse(config.serviceAccountKeyJson);
    } else if (config.serviceAccountKeyPath) {
      storageOptions.keyFilename = config.serviceAccountKeyPath;
    }

    this.storage = new Storage(storageOptions);
  }

  async put(
    key: string,
    body: Uint8Array,
    options?: ObjectStorePutOptions,
  ): Promise<void> {
    const file = this.storage.bucket(this.bucket).file(key);
    const saveOptions: SaveOptions = {};
    if (options?.contentType) saveOptions.contentType = options.contentType;
    if (options?.cacheControl) {
      saveOptions.metadata = { cacheControl: options.cacheControl };
    }
    await file.save(body, saveOptions);
  }

  async get(key: string): Promise<Buffer | null> {
    const file = this.storage.bucket(this.bucket).file(key);
    const [exists] = await file.exists();
    if (!exists) return null;
    const [data] = await file.download();
    return Buffer.from(data);
  }

  async delete(key: string): Promise<void> {
    await this.storage
      .bucket(this.bucket)
      .file(key)
      .delete({ ignoreNotFound: true });
  }

  async getPublicUrl(key: string): Promise<string> {
    if (this.cdnDomain) {
      return `https://${this.cdnDomain}/${key}`;
    }
    return `https://storage.googleapis.com/${this.bucket}/${key}`;
  }
}
