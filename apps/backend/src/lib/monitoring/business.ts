import client from "@prometheus-io/client";

export const activeSandboxesGauge = new client.Gauge({
  name: "sandboxes_active",
  help: "Number of sandboxes currently running",
  labelNames: ["user_id", "state"],
});

export const deployDurationHistogram = new client.Histogram({
  name: "deploy_duration_seconds",
  help: "Duration of deploys in seconds",
  labelNames: ["app_id"],
  buckets: [0.1, 0.5, 1, 2.5, 5, 10, 30, 60, 120, 300],
});

export const deployLatencySummary = new client.Summary({
  name: "deploy_latency_seconds",
  help: "Latency of deploys in seconds",
  labelNames: ["app_id"],
  percentiles: [0.5, 0.9, 0.95, 0.99],
  maxAgeSeconds: 600,
  ageBuckets: 5,
});

export const totalUsersCounter = new client.Counter({
  name: "users_total_registered",
  help: "Total number of registered users",
  labelNames: ["provider"],
});
