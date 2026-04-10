import { z } from "zod";

export const createProjectSchema = z.object({
  prompt: z.string(),
});

export const chatMessageSchema = z.object({
  message: z.string().min(1),
});

export const heartbeatSchema = z.object({
  projectId: z.string().uuid(),
});
