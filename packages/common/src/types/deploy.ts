export const DEPLOYMENT_STATUS = {
  PENDING: "PENDING",
  BUILDING: "BUILDING",
  UPLOADING: "UPLOADING",
  CONFIGURING: "CONFIGURING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
} as const;

export type DeploymentStatus =
  (typeof DEPLOYMENT_STATUS)[keyof typeof DEPLOYMENT_STATUS];

export interface DeploymentStatusData {
  status: DeploymentStatus;
  deployedUrl?: string;
  error?: string;
  updatedAt: string;
}
