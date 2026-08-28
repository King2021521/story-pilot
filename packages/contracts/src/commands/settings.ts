import { z } from "zod";

import { emptyPayloadSchema } from "./shared.js";

const modelSettingsPatchSchema = z
  .object({
    provider: z.literal("openai-compatible").optional(),
    baseUrl: z.string().optional(),
    apiKey: z.string().optional(),
    model: z.string().optional(),
    embeddingModel: z.string().optional(),
    timeoutMs: z.number().int().positive().optional(),
    maxRetries: z.number().int().nonnegative().max(10).optional(),
  })
  .strict();

const storageSettingsPatchSchema = z
  .object({
    autoBackup: z.boolean().optional(),
    backupRetention: z.number().int().positive().max(365).optional(),
  })
  .strict();

const privacySettingsPatchSchema = z
  .object({
    redactApiKeyInLogs: z.boolean().optional(),
    allowDiagnosticsExport: z.boolean().optional(),
  })
  .strict();

export const settingsCommandSchemas = {
  "settings.get": emptyPayloadSchema,
  "settings.update": z
    .object({
      model: modelSettingsPatchSchema.optional(),
      storage: storageSettingsPatchSchema.optional(),
      privacy: privacySettingsPatchSchema.optional(),
    })
    .strict(),
  "settings.validateModel": z
    .object({
      baseUrl: z.string().optional(),
      apiKey: z.string().optional(),
      model: z.string().optional(),
    })
    .strict()
    .default({}),
};
