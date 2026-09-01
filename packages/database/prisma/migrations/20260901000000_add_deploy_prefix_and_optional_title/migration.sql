-- AlterTable
ALTER TABLE "Project" ALTER COLUMN "title" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "deployPrefix" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Project_deployPrefix_key" ON "Project"("deployPrefix");