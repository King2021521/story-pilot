import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";

import { GLOBAL_DATABASE_FILE } from "@story-pilot/db";

export const STORY_PILOT_HOME_ENV = "STORY_PILOT_HOME";
export const STORY_PILOT_SETTINGS_PATH_ENV = "STORY_PILOT_SETTINGS_PATH";
export const STORY_PILOT_PROJECTS_ROOT_ENV = "STORY_PILOT_PROJECTS_ROOT";
export const STORY_PILOT_GLOBAL_DATABASE_PATH_ENV = "STORY_PILOT_GLOBAL_DATABASE_PATH";

const DEFAULT_SETTINGS_FILE = "settings.json";
const DEFAULT_PROVIDER_ID = "default-openai-compatible";

export interface RuntimeModelProviderSettings {
  readonly id: string;
  readonly type: "openai-compatible";
  readonly name: string;
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly model: string;
}

export interface RuntimeSettings {
  readonly version: 1;
  readonly storage: {
    readonly homePath: string;
    readonly projectsRoot: string;
    readonly globalDatabasePath: string;
  };
  readonly llm: {
    readonly defaultProviderId: string;
    readonly providers: readonly RuntimeModelProviderSettings[];
  };
}

export interface RuntimeConfig {
  readonly homePath: string;
  readonly settingsPath: string;
  readonly projectsRoot: string;
  readonly globalDatabasePath: string;
  readonly settings: RuntimeSettings;
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

  const rawSettings = existsSync(settingsPath)
    ? JSON.parse(readFileSync(settingsPath, "utf8"))
    : undefined;
  const settings = normalizeRuntimeSettings(rawSettings, homePath);

  writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
  mkdirSync(settings.storage.projectsRoot, { recursive: true });
  mkdirSync(join(homePath, "logs"), { recursive: true });
  mkdirSync(dirname(settings.storage.globalDatabasePath), { recursive: true });

  env[STORY_PILOT_HOME_ENV] = env[STORY_PILOT_HOME_ENV] ?? homePath;
  env[STORY_PILOT_PROJECTS_ROOT_ENV] =
    env[STORY_PILOT_PROJECTS_ROOT_ENV] ?? settings.storage.projectsRoot;
  env[STORY_PILOT_GLOBAL_DATABASE_PATH_ENV] =
    env[STORY_PILOT_GLOBAL_DATABASE_PATH_ENV] ?? settings.storage.globalDatabasePath;
  applyDefaultModelProvider(settings, env);

  return {
    globalDatabasePath: settings.storage.globalDatabasePath,
    homePath,
    projectsRoot: settings.storage.projectsRoot,
    settings,
    settingsPath,
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
  const projectsRoot = resolvePath(
    readString(storageRecord.projectsRoot) ?? join(homePath, "projects"),
    homePath,
  );
  const globalDatabasePath = resolvePath(
    readString(storageRecord.globalDatabasePath) ?? join(homePath, GLOBAL_DATABASE_FILE),
    homePath,
  );
  const llmRecord = isRecord(inputRecord.llm) ? inputRecord.llm : {};
  const providers = readProviders(llmRecord.providers);
  const defaultProviderId =
    readString(llmRecord.defaultProviderId) ?? providers[0]?.id ?? DEFAULT_PROVIDER_ID;

  return {
    llm: {
      defaultProviderId,
      providers,
    },
    storage: {
      globalDatabasePath,
      homePath,
      projectsRoot,
    },
    version: 1,
  };
}

function readProviders(input: unknown): RuntimeModelProviderSettings[] {
  if (!Array.isArray(input) || input.length === 0) {
    return [createDefaultProvider()];
  }

  const providers = input.map(readProvider).filter((provider) => provider !== undefined);
  return providers.length > 0 ? providers : [createDefaultProvider()];
}

function readProvider(input: unknown): RuntimeModelProviderSettings | undefined {
  if (!isRecord(input)) {
    return undefined;
  }

  const id = readString(input.id);
  if (!id) {
    return undefined;
  }

  return {
    apiKey: readString(input.apiKey) ?? "",
    baseUrl: readString(input.baseUrl) ?? "",
    id,
    model: readString(input.model) ?? "gpt-5.5",
    name: readString(input.name) ?? id,
    type: "openai-compatible",
  };
}

function createDefaultProvider(): RuntimeModelProviderSettings {
  return {
    apiKey: "",
    baseUrl: "",
    id: DEFAULT_PROVIDER_ID,
    model: "gpt-5.5",
    name: "Default OpenAI Compatible",
    type: "openai-compatible",
  };
}

function applyDefaultModelProvider(settings: RuntimeSettings, env: NodeJS.ProcessEnv): void {
  const defaultProvider =
    settings.llm.providers.find((provider) => provider.id === settings.llm.defaultProviderId) ??
    settings.llm.providers[0];
  if (!defaultProvider || !defaultProvider.apiKey || !defaultProvider.baseUrl) {
    return;
  }

  env.STORY_PILOT_LLM_API_KEY = defaultProvider.apiKey;
  env.STORY_PILOT_LLM_BASE_URL = defaultProvider.baseUrl;
  env.STORY_PILOT_LLM_MODEL = defaultProvider.model;
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

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}
