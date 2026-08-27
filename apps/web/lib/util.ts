export function getBackendUrl() {
  if (typeof window === "undefined") {
    return process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_BASE_URL;
  }
  return process.env.NEXT_PUBLIC_BASE_URL;
}
