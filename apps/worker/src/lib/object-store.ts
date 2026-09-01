import { ObjectStore, createObjectStoreFromEnv } from "@repo/storage";

let objectStore: ObjectStore | null = null;

export function initObjectStore(): ObjectStore {
  if (!objectStore) {
    objectStore = createObjectStoreFromEnv();
  }
  return objectStore;
}

export function getObjectStore(): ObjectStore {
  if (!objectStore) {
    throw new Error(
      "Object store not initialized. Call initObjectStore() first.",
    );
  }
  return objectStore;
}
