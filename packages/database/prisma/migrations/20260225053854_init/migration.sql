-- CreateEnum
CREATE TYPE "ConversationType" AS ENUM ('TOOL_CALL', 'TEXT_MESSAGE');

-- CreateEnum
CREATE TYPE "MessageFrom" AS ENUM ('USER', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "ToolCall" AS ENUM ('READ_FILE', 'WRITE_FILE', 'DELETE_FILE', 'UPDATE_FILE');

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "initialPrompt" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updateAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationHistory" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "contents" TEXT NOT NULL,
    "hidden" BOOLEAN NOT NULL,
    "from" "MessageFrom" NOT NULL,
    "toolCall" "ToolCall",
    "type" "ConversationType" NOT NULL,
    "createdAT" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationHistory_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationHistory" ADD CONSTRAINT "ConversationHistory_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
