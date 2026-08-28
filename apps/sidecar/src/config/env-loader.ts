import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { config as loadDotenv } from "dotenv";

export type LoadLocalEnvResult =
  | {
      loaded: true;
      path: string;
    }
  | {
      loaded: false;
    };

export interface LoadLocalEnvOptions {
  readonly cwd?: string;
  readonly env?: NodeJS.ProcessEnv;
}

export function loadLocalEnv(options: LoadLocalEnvOptions = {}): LoadLocalEnvResult {
  const envPath = findNearestEnvFile(options.cwd ?? process.cwd());
  if (!envPath) {
    return { loaded: false };
  }

  const result = loadDotenv({
    override: false,
    path: envPath,
    processEnv: options.env ?? process.env,
    quiet: true,
  });
  if (result.error) {
    throw result.error;
  }

  return {
    loaded: true,
    path: envPath,
  };
}

function findNearestEnvFile(startDir: string): string | undefined {
  let current = resolve(startDir);

  while (true) {
    const candidate = join(current, ".env");
    if (existsSync(candidate)) {
      return candidate;
    }

    const parent = dirname(current);
    if (parent === current) {
      return undefined;
    }
    current = parent;
  }
}
