/*
  Warnings:

  - You are about to drop the column `updateAt` on the `Project` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `Project` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'DEPLOYED', 'ARCHIVED', 'DELETED');

-- AlterTable
ALTER TABLE "Project" DROP COLUMN "updateAt",
ADD COLUMN     "deployedUrl" TEXT,
ADD COLUMN     "lastSavedAt" TIMESTAMP(3),
ADD COLUMN     "s3Prefix" TEXT,
ADD COLUMN     "sandboxTemplateId" TEXT,
ADD COLUMN     "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;
