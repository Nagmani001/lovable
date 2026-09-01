export function getE2bApiKey(): string {
  return process.env.E2B_API_KEY || "";
}

export function getAppDomain(): string {
  return process.env.APP_DOMAIN || "app.lovable.nagmani.site";
}

export function getProjectBasePath(): string {
  return process.env.PROJECT_BASE_PATH || "/home/user/project";
}

export function getArtifactsPrefix(): string {
  return process.env.ARTIFACTS_PREFIX || "build-artifacts";
}

export function getGcpProjectId(): string {
  return process.env.GCS_PROJECT_ID || "";
}

export function getGcpServiceAccountKeyJson(): string | undefined {
  return process.env.GCS_SERVICE_ACCOUNT_KEY;
}

export function getGcpServiceAccountKeyPath(): string | undefined {
  return process.env.GCS_SERVICE_ACCOUNT_KEY_PATH;
}

export function getUrlMapName(): string {
  return process.env.URL_MAP_NAME || "lovable-cdn";
}

export function getBackendBucketName(): string {
  return process.env.BACKEND_BUCKET_NAME || "lovable-cdn";
}

export function getBuildTimeoutMs(): number {
  return Number(process.env.BUILD_TIMEOUT_MS || 120_000);
}

export function getUploadTimeoutMs(): number {
  return Number(process.env.UPLOAD_TIMEOUT_MS || 180_000);
}
