import { z } from "zod";

const worldbuildingFieldSchema = z.string().min(1).max(500);

export const WorldbuildingFieldCompletionOutputSchema = z.object({
  fields: z.object({
    coreConflict: worldbuildingFieldSchema,
    culture: worldbuildingFieldSchema,
    economy: worldbuildingFieldSchema,
    factions: worldbuildingFieldSchema,
    geography: worldbuildingFieldSchema,
    history: worldbuildingFieldSchema,
    powerOrder: worldbuildingFieldSchema,
    powerSystem: worldbuildingFieldSchema,
    rules: worldbuildingFieldSchema,
    socialStructure: worldbuildingFieldSchema,
    specialMechanism: worldbuildingFieldSchema,
    worldBase: worldbuildingFieldSchema,
  }),
});

export type WorldbuildingFieldCompletionOutput = z.infer<
  typeof WorldbuildingFieldCompletionOutputSchema
>;
