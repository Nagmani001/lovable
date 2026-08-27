import { createClient, RedisClientType } from "redis";

let queueClient: RedisClientType | null = null;
let pubSubClient: RedisClientType | null = null;

export async function initRedis(): Promise<{
  queueClient: RedisClientType;
  pubSubClient: RedisClientType;
}> {
  if (!queueClient) {
    queueClient = createClient({ url: process.env.REDIS_URL });
    await queueClient.connect();
  }
  if (!pubSubClient) {
    pubSubClient = createClient({ url: process.env.REDIS_URL });
    await pubSubClient.connect();
  }
  return { queueClient, pubSubClient };
}

export function getQueueClient(): RedisClientType {
  if (!queueClient) {
    throw new Error("Redis not initialized. Call initRedis() first.");
  }
  return queueClient;
}

export function getPubSubClient(): RedisClientType {
  if (!pubSubClient) {
    throw new Error("Redis not initialized. Call initRedis() first.");
  }
  return pubSubClient;
}

export async function closeRedis(): Promise<void> {
  await Promise.allSettled([queueClient?.quit(), pubSubClient?.quit()]);
  queueClient = null;
  pubSubClient = null;
}
