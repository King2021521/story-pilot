import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";

import { GLOBAL_DATABASE_FILE } from "@story-pilot/db";

export const STORY_PILOT_HOME_ENV = "STORY_PILOT_HOME";
export const STORY_PILOT_SETTINGS_PATH_ENV = "STORY_PILOT_SETTINGS_PATH";
export const STORY_PILOT_PROJECTS_ROOT_ENV = "STORY_PILOT_PROJECTS_ROOT";
export const STORY_PILOT_GLOBAL_DATABASE_PATH_ENV = "STORY_PILOT_GLOBAL_DATABASE_PATH";

const DEFAULT_SETTINGS_FILE = "setting.json";
const STORY_PILOT_LLM_API_KEY_ENV = "STORY_PILOT_LLM_API_KEY";
const STORY_PILOT_LLM_BASE_URL_ENV = "STORY_PILOT_LLM_BASE_URL";
const STORY_PILOT_LLM_MODEL_ENV = "STORY_PILOT_LLM_MODEL";

export interface RuntimeModelSettings {
  readonly provider: "openai-compatible";
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly model: string;
  readonly embeddingModel: string;
  readonly timeoutMs: number;
  readonly maxRetries: number;
}

export interface RuntimeSettings {
  readonly version: 1;
  readonly model: RuntimeModelSettings;
  readonly storage: {
    readonly homeDir: string;
    readonly autoBackup: boolean;
    readonly backupRetention: number;
  };
  readonly privacy: {
    readonly redactApiKeyInLogs: boolean;
    readonly allowDiagnosticsExport: boolean;
  };
}

export interface RuntimeConfig {
  readonly homePath: string;
  readonly settingsPath: string;
  readonly projectsRoot: string;
  readonly globalDatabasePath: string;
  readonly logsPath: string;
  readonly diagnosticsPath: string;
  readonly tempPath: string;
  readonly settings: RuntimeSettings;
}

type RuntimeSettingsFieldPatch<TSettings extends object> = {
  readonly [TKey in keyof TSettings]?: TSettings[TKey] | undefined;
};

export interface RuntimeSettingsPatch {
  readonly model?: RuntimeSettingsFieldPatch<RuntimeModelSettings> | undefined;
  readonly storage?: RuntimeSettingsFieldPatch<RuntimeSettings["storage"]> | undefined;
  readonly privacy?: RuntimeSettingsFieldPatch<RuntimeSettings["privacy"]> | undefined;
}

export interface InitializeRuntimeConfigOptions {
  readonly env?: NodeJS.ProcessEnv;
}

export function initializeRuntimeConfig(
  options: InitializeRuntimeConfigOptions = {},
): RuntimeConfig {
  const env = options.env ?? process.env;
  const homePath = resolveStoryPilotHome(env);
  const settingsPath = resolveSettingsPath(homePath, env);

  mkdirSync(homePath, { recursive: true });
  mkdirSync(dirname(settingsPath), { recursive: true });

  const rawSettings = readSettingsFile(settingsPath);
  const settings = normalizeRuntimeSettings(rawSettings, homePath);

  writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
  const projectsRoot = resolveRuntimeProjectsRoot(env);
  const globalDatabasePath = resolveRuntimeGlobalDatabasePath(env);
  const logsPath = join(homePath, "logs");
  const diagnosticsPath = join(homePath, "diagnostics");
  const tempPath = join(homePath, "temp");

  mkdirSync(projectsRoot, { recursive: true });
  mkdirSync(logsPath, { recursive: true });
  mkdirSync(diagnosticsPath, { recursive: true });
  mkdirSync(tempPath, { recursive: true });
  mkdirSync(dirname(globalDatabasePath), { recursive: true });

  env[STORY_PILOT_HOME_ENV] = env[STORY_PILOT_HOME_ENV] ?? homePath;
  env[STORY_PILOT_SETTINGS_PATH_ENV] = env[STORY_PILOT_SETTINGS_PATH_ENV] ?? settingsPath;
  env[STORY_PILOT_PROJECTS_ROOT_ENV] = env[STORY_PILOT_PROJECTS_ROOT_ENV] ?? projectsRoot;
  env[STORY_PILOT_GLOBAL_DATABASE_PATH_ENV] =
    env[STORY_PILOT_GLOBAL_DATABASE_PATH_ENV] ?? globalDatabasePath;
  applyDefaultModelProvider(settings, env);

  return {
    diagnosticsPath,
    globalDatabasePath,
    homePath,
    logsPath,
    projectsRoot,
    settings,
    settingsPath,
    tempPath,
  };
}

export function updateRuntimeSettings(
  patch: RuntimeSettingsPatch,
  options: InitializeRuntimeConfigOptions = {},
): RuntimeConfig {
  const env = options.env ?? process.env;
  const current = initializeRuntimeConfig({ env });
  const settings = normalizeRuntimeSettings(
    {
      model: {
        ...current.settings.model,
        ...(patch.model ?? {}),
      },
      privacy: {
        ...current.settings.privacy,
        ...(patch.privacy ?? {}),
      },
      storage: {
        ...current.settings.storage,
        ...(patch.storage ?? {}),
      },
      version: 1,
    },
    current.homePath,
  );

  writeFileSync(current.settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
  applyDefaultModelProvider(settings, env);

  return {
    ...current,
    settings,
  };
}

export function resolveStoryPilotHome(env: NodeJS.ProcessEnv = process.env): string {
  return resolvePath(env[STORY_PILOT_HOME_ENV] ?? join(homedir(), ".story-pilot"), homedir());
}

export function resolveRuntimeProjectsRoot(env: NodeJS.ProcessEnv = process.env): string {
  if (env[STORY_PILOT_PROJECTS_ROOT_ENV]) {
    return resolvePath(env[STORY_PILOT_PROJECTS_ROOT_ENV], resolveStoryPilotHome(env));
  }

  return join(resolveStoryPilotHome(env), "projects");
}

export function resolveRuntimeGlobalDatabasePath(env: NodeJS.ProcessEnv = process.env): string {
  if (env[STORY_PILOT_GLOBAL_DATABASE_PATH_ENV]) {
    return resolvePath(env[STORY_PILOT_GLOBAL_DATABASE_PATH_ENV], resolveStoryPilotHome(env));
  }

  return join(resolveStoryPilotHome(env), GLOBAL_DATABASE_FILE);
}

function resolveSettingsPath(homePath: string, env: NodeJS.ProcessEnv): string {
  return resolvePath(env[STORY_PILOT_SETTINGS_PATH_ENV] ?? DEFAULT_SETTINGS_FILE, homePath);
}

function normalizeRuntimeSettings(input: unknown, homePath: string): RuntimeSettings {
  const inputRecord = isRecord(input) ? input : {};
  const storageRecord = isRecord(inputRecord.storage) ? inputRecord.storage : {};
  const modelRecord = isRecord(inputRecord.model)
    ? inputRecord.model
    : readLegacyModel(inputRecord);
  const privacyRecord = isRecord(inputRecord.privacy) ? inputRecord.privacy : {};

  return {
    model: {
      apiKey: readString(modelRecord.apiKey) ?? "",
      baseUrl: readString(modelRecord.baseUrl) ?? "",
      embeddingModel: readString(modelRecord.embeddingModel) ?? "",
      maxRetries: readNumber(modelRecord.maxRetries) ?? 2,
      model: readString(modelRecord.model) ?? "gpt-5.5",
      provider: "openai-compatible",
      timeoutMs: readNumber(modelRecord.timeoutMs) ?? 120_000,
    },
    privacy: {
      allowDiagnosticsExport: readBoolean(privacyRecord.allowDiagnosticsExport) ?? true,
      redactApiKeyInLogs: readBoolean(privacyRecord.redactApiKeyInLogs) ?? true,
    },
    storage: {
      autoBackup: readBoolean(storageRecord.autoBackup) ?? true,
      backupRetention: readNumber(storageRecord.backupRetention) ?? 20,
      homeDir: resolvePath(readString(storageRecord.homeDir) ?? homePath, homePath),
    },
    version: 1,
  };
}

function readSettingsFile(settingsPath: string): unknown {
  if (!existsSync(settingsPath)) {
    return undefined;
  }

  try {
    return JSON.parse(readFileSync(settingsPath, "utf8"));
  } catch {
    const invalidPath = settingsPath.replace(/\.json$/u, `.invalid.${Date.now()}.json`);
    renameSync(settingsPath, invalidPath);
    return undefined;
  }
}

function readLegacyModel(inputRecord: Record<string, unknown>): Record<string, unknown> {
  const llmRecord = isRecord(inputRecord.llm) ? inputRecord.llm : {};
  const providers = Array.isArray(llmRecord.providers) ? llmRecord.providers : [];
  const defaultProviderId = readString(llmRecord.defaultProviderId);
  const defaultProvider = providers
    .filter(isRecord)
    .find((provider) => provider.id === defaultProviderId);
  const firstProvider = providers.find(isRecord);

  return defaultProvider ?? firstProvider ?? {};
}

function applyDefaultModelProvider(settings: RuntimeSettings, env: NodeJS.ProcessEnv): void {
  const apiKey = settings.model.apiKey.trim();
  const baseUrl = settings.model.baseUrl.trim();
  const model = settings.model.model.trim() || "gpt-5.5";

  env[STORY_PILOT_LLM_MODEL_ENV] = model;

  if (!apiKey || !baseUrl) {
    delete env[STORY_PILOT_LLM_API_KEY_ENV];
    delete env[STORY_PILOT_LLM_BASE_URL_ENV];
    return;
  }

  env[STORY_PILOT_LLM_API_KEY_ENV] = apiKey;
  env[STORY_PILOT_LLM_BASE_URL_ENV] = baseUrl;
}

function resolvePath(path: string, basePath: string): string {
  if (path === "~") {
    return homedir();
  }

  if (path.startsWith("~/")) {
    return join(homedir(), path.slice(2));
  }

  if (isAbsolute(path)) {
    return path;
  }

  return resolve(basePath, path);
}

function readString(input: unknown): string | undefined {
  return typeof input === "string" ? input : undefined;
}

function readNumber(input: unknown): number | undefined {
  return typeof input === "number" && Number.isFinite(input) ? input : undefined;
}

function readBoolean(input: unknown): boolean | undefined {
  return typeof input === "boolean" ? input : undefined;
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}
