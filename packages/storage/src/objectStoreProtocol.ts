import type { ObjectStoreGetOptions, ObjectStorePutOptions } from "./types.js";

export abstract class ObjectStore {
  abstract readonly provider: "s3" | "gcs";

  abstract put(
    key: string,
    body: Uint8Array,
    options?: ObjectStorePutOptions,
  ): Promise<void>;

  abstract get(key: string): Promise<Buffer | null>;

  abstract delete(key: string): Promise<void>;

  abstract getPublicUrl(key: string): Promise<string>;

  abstract getSignedPutUrl(
    key: string,
    options?: ObjectStorePutOptions,
  ): Promise<string>;

  abstract getSignedGetUrl(
    key: string,
    options?: ObjectStoreGetOptions,
  ): Promise<string>;
}
