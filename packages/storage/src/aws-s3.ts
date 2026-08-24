import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ObjectStore } from "./objectStoreProtocol.js";
import type {
  ObjectStoreGetOptions,
  ObjectStorePutOptions,
  S3ObjectStoreConfig,
} from "./types.js";

export class S3ObjectStore extends ObjectStore {
  readonly provider = "s3" as const;

  private client: S3Client;
  private bucket: string;
  private region: string;
  private cdnDomain?: string;

  constructor(config: S3ObjectStoreConfig) {
    super();
    this.bucket = config.bucket;
    this.region = config.region;
    this.cdnDomain = config.cdnDomain;
    this.client = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  async put(
    key: string,
    body: Uint8Array,
    options?: ObjectStorePutOptions,
  ): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: options?.contentType,
        CacheControl: options?.cacheControl,
      }),
    );
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      if (!response.Body) return null;
      const bytes = await response.Body.transformToByteArray();
      return Buffer.from(bytes);
    } catch (err: unknown) {
      if (this.isNotFoundError(err)) return null;
      throw err;
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  async getPublicUrl(key: string): Promise<string> {
    if (this.cdnDomain) {
      return `https://${this.cdnDomain}/${key}`;
    }
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }

  async getSignedPutUrl(
    key: string,
    options?: ObjectStorePutOptions,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: options?.contentType,
    });
    return getSignedUrl(this.client, command, { expiresIn: 60 * 15 });
  }

  async getSignedGetUrl(
    key: string,
    options?: ObjectStoreGetOptions,
  ): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, {
      expiresIn: options?.expiresInSeconds ?? 60 * 60,
    });
  }

  private isNotFoundError(err: unknown): boolean {
    const error = err as {
      name?: string;
      $metadata?: { httpStatusCode?: number };
    };
    return (
      error.name === "NoSuchKey" || error.$metadata?.httpStatusCode === 404
    );
  }
}
