import "dotenv/config";
import { REDIS_QUEUE_NAME } from "@repo/common/data";
import type { WorkerQueueItem } from "@repo/common/types";
import { processQueueItem } from "./processQueue";
import { initObjectStore } from "./lib/object-store";
import { createClient, RedisClientType } from "redis";

export const queueClient: RedisClientType = createClient();

async function main() {
  try {
    await queueClient.connect();
    console.log("connected to queue");
    initObjectStore();
    console.log("object sotre initialized");
  } catch (err) {
    console.log("error connecting with redis ", err);
  }

  while (true) {
    const popped = await queueClient.brPop(REDIS_QUEUE_NAME, 0);
    const parsedData = JSON.parse(popped?.element!) as WorkerQueueItem;

    try {
      const result = await processQueueItem(parsedData);
      console.log(`[worker] processed ${parsedData.type}:`, result);
    } catch (err) {
      console.error(`[worker] failed to process ${parsedData.type}:`, err);
    }
  }
}

main();
