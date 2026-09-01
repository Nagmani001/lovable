import { ObjectStore, createObjectStoreFromEnv } from "@repo/storage";

let objectStore: ObjectStore | null = null;

export function getObjectStore(): ObjectStore {
  if (!objectStore) {
    objectStore = createObjectStoreFromEnv();
  }
  return objectStore;
}
