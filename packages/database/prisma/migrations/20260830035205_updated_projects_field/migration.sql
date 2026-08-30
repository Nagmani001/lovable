-- CreateEnum
CREATE TYPE "ProjectDeployingStatus" AS ENUM ('NOTSTARTED', 'QUEUED', 'PROCESSING', 'DEPLOYED', 'FAILED');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "deployIngStatus" "ProjectDeployingStatus" NOT NULL DEFAULT 'NOTSTARTED';
