import { createClient, RedisClientType } from "redis";

let queueClient: RedisClientType | null = null;

export async function initRedis() {
  if (!queueClient) {
    queueClient = createClient({ url: process.env.REDIS_URL });
    await queueClient.connect();
  }
}

export function getQueueClient(): RedisClientType {
  if (!queueClient) {
    throw new Error("Redis not initialized. Call initRedis() first.");
  }
  return queueClient;
}
