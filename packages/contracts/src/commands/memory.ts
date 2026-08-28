import { z } from "zod";

import { projectIdPayloadSchema } from "./shared.js";

export const memoryCommandSchemas = {
  "memory.listCandidates": projectIdPayloadSchema.extend({
    status: z.enum(["pending", "accepted", "merged", "rejected"]).optional(),
  }),
  "memory.confirm": projectIdPayloadSchema.extend({
    candidateId: z.string().min(1),
    decision: z.enum(["canon", "hypothesis", "merge", "reject"]),
    mergeTargetMemoryId: z.string().min(1).optional(),
    editedStatement: z.string().min(1).optional(),
  }),
  "memory.reject": projectIdPayloadSchema.extend({
    candidateId: z.string().min(1),
  }),
  "memory.merge": projectIdPayloadSchema.extend({
    candidateId: z.string().min(1),
    targetMemoryId: z.string().min(1),
  }),
  "memory.search": projectIdPayloadSchema.extend({
    query: z.string().min(1),
    status: z.enum(["canon", "hypothesis", "deprecated"]).optional(),
    limit: z.number().int().positive().max(100).default(20),
  }),
  "graph.getNeighborhood": projectIdPayloadSchema.extend({
    nodeType: z.string().min(1),
    nodeId: z.string().min(1),
    depth: z.number().int().min(1).max(3).default(2),
  }),
  "graph.findContradictions": projectIdPayloadSchema.extend({
    scope: z.enum(["project", "chapter", "character", "world_rule"]).default("project"),
    targetId: z.string().min(1).optional(),
  }),
  "graph.rebuild": projectIdPayloadSchema,
  "graph.projectSinceCheckpoint": projectIdPayloadSchema,
};
