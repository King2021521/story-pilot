import { z } from "zod";

export const emptyPayloadSchema = z.object({}).default({});

export const projectIdPayloadSchema = z.object({
  projectId: z.string().min(1),
});

export const optionalProjectIdPayloadSchema = z.object({
  projectId: z.string().min(1).optional(),
});

export const entityTargetSchema = z.object({
  targetType: z.string().min(1),
  targetId: z.string().min(1).optional(),
});

export const paginationSchema = z.object({
  limit: z.number().int().positive().max(200).optional(),
  cursor: z.string().min(1).optional(),
});
