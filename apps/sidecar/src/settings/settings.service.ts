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
  readonly errorCode?:
    | "AI_MODEL_NOT_CONFIGURED"
    | "AI_MODEL_ENDPOINT_INVALID"
    | "AI_MODEL_AUTH_FAILED"
    | "AI_MODEL_HTTP_ERROR"
    | "AI_MODEL_REQUEST_FAILED";
  readonly statusCode?: number;
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

  async validateModel(
    input: CommandPayload<"settings.validateModel">,
  ): Promise<ModelValidationResult> {
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
      const response = await fetch(buildChatCompletionsUrl(endpoint), {
        body: JSON.stringify({
          messages: [{ role: "user", content: "ping" }],
          model,
          stream: false,
        }),
        headers: {
          authorization: `Bearer ${normalizeApiKey(apiKey)}`,
          "content-type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        return {
          checkedAt,
          endpoint: endpoint.toString(),
          errorCode:
            response.status === 401 || response.status === 403
              ? "AI_MODEL_AUTH_FAILED"
              : "AI_MODEL_HTTP_ERROR",
          model,
          ok: false,
          provider: settings.model.provider,
          statusCode: response.status,
        };
      }

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
        errorCode: isValidUrl(baseUrl) ? "AI_MODEL_REQUEST_FAILED" : "AI_MODEL_ENDPOINT_INVALID",
        model,
        ok: false,
        provider: settings.model.provider,
      };
    }
  }
}

function buildChatCompletionsUrl(endpoint: URL): string {
  return `${endpoint.toString().replace(/\/+$/u, "")}/chat/completions`;
}

function normalizeApiKey(apiKey: string): string {
  return apiKey.trim().replace(/^Bearer\s+/iu, "");
}

function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}
