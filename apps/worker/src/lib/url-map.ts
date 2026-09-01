import { GoogleAuth } from "google-auth-library";
import {
  getGcpProjectId,
  getGcpServiceAccountKeyJson,
  getGcpServiceAccountKeyPath,
  getBackendBucketName,
  getUrlMapName,
  getAppDomain,
  getArtifactsPrefix,
} from "./config";

interface UrlMapPathRule {
  paths: string[];
  service: string;
  routeAction: { urlRewrite: { pathPrefixRewrite: string } };
}

interface UrlMapPathMatcher {
  name: string;
  defaultService: string;
  pathRules: UrlMapPathRule[];
}

interface UrlMapHostRule {
  hosts: string[];
  pathMatcher: string;
}

interface UrlMapResource {
  name: string;
  defaultService: string;
  fingerprint?: string;
  hostRules?: UrlMapHostRule[];
  pathMatchers?: UrlMapPathMatcher[];
}

async function getAuthClient(): Promise<GoogleAuth> {
  const options: Record<string, unknown> = {
    projectId: getGcpProjectId(),
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  };
  const keyJson = getGcpServiceAccountKeyJson();
  const keyPath = getGcpServiceAccountKeyPath();
  if (keyJson) {
    options.credentials = JSON.parse(keyJson);
  } else if (keyPath) {
    options.keyFile = keyPath;
  }
  return new GoogleAuth(options);
}

async function getAccessToken(): Promise<string> {
  const auth = await getAuthClient();
  const client = await auth.getClient();
  const { token } = await client.getAccessToken();
  if (!token) {
    throw new Error("Failed to obtain GCP access token");
  }
  return token;
}

const computeUrl = (projectId: string, urlMapName: string) =>
  `https://compute.googleapis.com/compute/v1/projects/${projectId}/global/urlMaps/${urlMapName}`;

async function fetchUrlMap(
  projectId: string,
  urlMapName: string,
): Promise<UrlMapResource | null> {
  const token = await getAccessToken();
  const res = await fetch(computeUrl(projectId, urlMapName), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(
      `Failed to fetch url map: ${res.status} ${await res.text()}`,
    );
  }
  return (await res.json()) as UrlMapResource;
}

async function updateUrlMap(
  projectId: string,
  urlMapName: string,
  resource: UrlMapResource,
): Promise<void> {
  const token = await getAccessToken();
  const body: Record<string, unknown> = {
    name: resource.name,
    defaultService: resource.defaultService,
    hostRules: resource.hostRules,
    pathMatchers: resource.pathMatchers,
  };
  if (resource.fingerprint) {
    body.fingerprint = resource.fingerprint;
  }
  const res = await fetch(computeUrl(projectId, urlMapName), {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(
      `Failed to update url map: ${res.status} ${await res.text()}`,
    );
  }
}

export async function registerHostRule(deployPrefix: string): Promise<string> {
  const project = getGcpProjectId();
  if (!project) {
    throw new Error("GCS_PROJECT_ID is not set; cannot register host rule");
  }

  const urlMapName = getUrlMapName();
  const backendBucket = getBackendBucketName();
  const appDomain = getAppDomain();
  const artifactsPrefix = getArtifactsPrefix();
  const host = `${deployPrefix}.${appDomain}`;
  const matcherName = `matcher-${deployPrefix}`;
  const backendUrl = `https://www.googleapis.com/compute/v1/projects/${project}/global/backendBuckets/${backendBucket}`;

  const current = await fetchUrlMap(project, urlMapName);
  const baseResource: UrlMapResource = current
    ? { ...current }
    : {
        name: urlMapName,
        defaultService: backendUrl,
        hostRules: [],
        pathMatchers: [],
      };

  const existing = baseResource.hostRules?.find((rule) =>
    rule.hosts.includes(host),
  );
  if (existing) {
    console.log(`[urlmap] host rule already exists for ${host}`);
    return host;
  }

  const pathMatcher: UrlMapPathMatcher = {
    name: matcherName,
    defaultService: backendUrl,
    pathRules: [
      {
        paths: ["/index.html"],
        service: backendUrl,
        routeAction: {
          urlRewrite: {
            pathPrefixRewrite: `${artifactsPrefix}/${deployPrefix}/`,
          },
        },
      },
      {
        paths: ["/"],
        service: backendUrl,
        routeAction: {
          urlRewrite: {
            pathPrefixRewrite: `${artifactsPrefix}/${deployPrefix}/index.html`,
          },
        },
      },
      {
        paths: ["/*"],
        service: backendUrl,
        routeAction: {
          urlRewrite: {
            pathPrefixRewrite: `${artifactsPrefix}/${deployPrefix}/`,
          },
        },
      },
    ],
  };

  baseResource.hostRules = [
    ...(baseResource.hostRules ?? []),
    { hosts: [host], pathMatcher: matcherName },
  ];
  baseResource.pathMatchers = [
    ...(baseResource.pathMatchers ?? []),
    pathMatcher,
  ];

  await updateUrlMap(project, urlMapName, baseResource);
  console.log(`[urlmap] registered host rule ${host} -> ${matcherName}`);
  return host;
}
