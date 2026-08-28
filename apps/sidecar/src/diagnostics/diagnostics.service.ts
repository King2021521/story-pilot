import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { Injectable } from "@nestjs/common";
import { PROJECT_DATABASE_FILE } from "@story-pilot/db";

import { initializeRuntimeConfig, type RuntimeSettings } from "../config/runtime-settings.js";
import { ProjectStorageService } from "../storage/project-storage.service.js";

export interface DiagnosticsHealthReport {
  readonly sidecar: "ok" | "degraded" | "failed";
  readonly storage: "ok" | "degraded" | "failed";
  readonly model: "configured" | "missing" | "failed";
  readonly appHome: string;
  readonly settingsPath: string;
  readonly globalDatabasePath: string;
  readonly projectsRoot: string;
  readonly projectCount: number;
}

export interface DiagnosticsExportResult {
  readonly path: string;
  readonly redacted: true;
}

@Injectable()
export class DiagnosticsService {
  constructor(private readonly projectStorage: ProjectStorageService) {}

  getHealthReport(): DiagnosticsHealthReport {
    const config = initializeRuntimeConfig();

    return {
      appHome: config.homePath,
      globalDatabasePath: config.globalDatabasePath,
      model:
        config.settings.model.apiKey && config.settings.model.baseUrl && config.settings.model.model
          ? "configured"
          : "missing",
      projectCount: this.projectStorage
        .listProjectRootPaths()
        .filter((projectRoot) => existsSync(join(projectRoot, PROJECT_DATABASE_FILE))).length,
      projectsRoot: config.projectsRoot,
      settingsPath: config.settingsPath,
      sidecar: "ok",
      storage: "ok",
    };
  }

  exportBundle(): DiagnosticsExportResult {
    const config = initializeRuntimeConfig();
    const exportedAt = new Date().toISOString();
    const fileName = `diagnostics-${exportedAt.replace(/[:.]/gu, "-")}.json`;
    const outputPath = join(config.diagnosticsPath, fileName);
    const bundle = {
      exportedAt,
      health: this.getHealthReport(),
      settings: redactSettings(config.settings),
    };

    writeFileSync(outputPath, `${JSON.stringify(bundle, null, 2)}\n`);

    return {
      path: outputPath,
      redacted: true,
    };
  }
}

function redactSettings(settings: RuntimeSettings): RuntimeSettings {
  return {
    ...settings,
    model: {
      ...settings.model,
      apiKey: settings.model.apiKey ? "[redacted]" : "",
    },
  };
}
