import { z } from "zod";

export const createProjectSchema = z.object({
  prompt: z.string(),
});

export const updateProjectSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    isPinned: z.boolean().optional(),
  })
  .refine((data) => data.title !== undefined || data.isPinned !== undefined, {
    message: "At least one field to update is required",
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
