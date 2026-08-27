export const GLOBAL_DATABASE_FILE = "global.sqlite";
export const PROJECT_DATABASE_FILE = "project.sqlite";

export type DatabaseFileRole = "global" | "project";

export function getDatabaseFileName(role: DatabaseFileRole): string {
  return role === "global" ? GLOBAL_DATABASE_FILE : PROJECT_DATABASE_FILE;
}

export * from "./project-database.js";
export * from "./global-database.js";
export * from "./repositories/index.js";
export * from "./schema/index.js";
