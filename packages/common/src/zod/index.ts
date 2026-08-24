import { z } from "zod";

export const createProjectSchema = z.object({
  prompt: z.string(),
});

export const chatMessageSchema = z
  .object({
    message: z.string().optional(),
    imageKey: z.string().optional(),
    thumbnailKey: z.string().optional(),
  })
  .refine(
    (data) => data.message?.trim() || data.imageKey,
    "Either a message or an image is required",
  );

export const heartbeatSchema = z.object({
  projectId: z.string().uuid(),
});
