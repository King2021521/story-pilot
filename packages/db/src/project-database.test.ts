import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { PROJECT_DATABASE_FILE, createProjectDatabase, runProjectMigrations } from "./index.js";
import { schemaTableNames } from "./schema/index.js";

describe("project database", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const tempDir of tempDirs.splice(0)) {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it("creates a SQLite database and initializes MVP source tables", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "story-pilot-db-"));
    tempDirs.push(tempDir);
    const projectDatabase = createProjectDatabase(join(tempDir, PROJECT_DATABASE_FILE));

    try {
      await runProjectMigrations(projectDatabase);
      await runProjectMigrations(projectDatabase);

      const tables = projectDatabase.client
        .prepare("select name from sqlite_master where type = 'table'")
        .all()
        .map((row) => (row as { name: string }).name);

      expect(tables).toEqual(expect.arrayContaining(schemaTableNames));
      expect(tables).toContain("__story_pilot_migrations");
      expect(tables).toEqual(
        expect.arrayContaining([
          "creative_stages",
          "project_briefs",
          "story_blueprints",
          "outlines",
          "chapter_outlines",
          "review_issues",
        ]),
      );
    } finally {
      projectDatabase.close();
    }
  });
});
