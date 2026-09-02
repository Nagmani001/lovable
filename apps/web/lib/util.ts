export function getBackendUrl() {
  if (typeof window === "undefined") {
    return process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_BASE_URL;
  }
  return process.env.NEXT_PUBLIC_BASE_URL;
}

export function getAppDomain(): string {
  return process.env.NEXT_PUBLIC_APP_DOMAIN || "app.lovable.nagmani.site";
}

export function getDeployUrl(prefix: string): string {
  return `https://${prefix}.${getAppDomain()}`;
}
