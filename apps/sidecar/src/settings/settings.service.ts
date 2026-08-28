import { Injectable } from "@nestjs/common";
import type { CommandPayload } from "@story-pilot/contracts";

import {
  initializeRuntimeConfig,
  type RuntimeSettings,
  updateRuntimeSettings,
} from "../config/runtime-settings.js";

export interface ModelValidationResult {
  readonly ok: boolean;
  readonly provider: RuntimeSettings["model"]["provider"];
  readonly model: string;
  readonly checkedAt: string;
  readonly endpoint?: string;
  readonly errorCode?: "AI_MODEL_NOT_CONFIGURED" | "AI_MODEL_ENDPOINT_INVALID";
  readonly missingFields?: readonly string[];
}

@Injectable()
export class SettingsService {
  getSettings(): RuntimeSettings {
    return initializeRuntimeConfig().settings;
  }

  updateSettings(input: CommandPayload<"settings.update">): RuntimeSettings {
    return updateRuntimeSettings(input).settings;
  }

  validateModel(input: CommandPayload<"settings.validateModel">): ModelValidationResult {
    const settings = initializeRuntimeConfig().settings;
    const baseUrl = input.baseUrl ?? settings.model.baseUrl;
    const apiKey = input.apiKey ?? settings.model.apiKey;
    const model = input.model ?? settings.model.model;
    const modelFields = [
      { field: "apiKey", value: apiKey },
      { field: "baseUrl", value: baseUrl },
      { field: "model", value: model },
    ] as const;
    const missingFields = modelFields
      .filter(({ value }) => value.trim().length === 0)
      .map(({ field }) => field);
    const checkedAt = new Date().toISOString();

    if (missingFields.length > 0) {
      return {
        checkedAt,
        errorCode: "AI_MODEL_NOT_CONFIGURED",
        missingFields,
        model,
        ok: false,
        provider: settings.model.provider,
      };
    }

    try {
      const endpoint = new URL(baseUrl);
      return {
        checkedAt,
        endpoint: endpoint.toString(),
        model,
        ok: true,
        provider: settings.model.provider,
      };
    } catch {
      return {
        checkedAt,
        errorCode: "AI_MODEL_ENDPOINT_INVALID",
        model,
        ok: false,
        provider: settings.model.provider,
      };
    }
  }
}
