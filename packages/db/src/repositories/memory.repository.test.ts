import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createProjectDatabase, PROJECT_DATABASE_FILE, runProjectMigrations } from "../index.js";
import { MemoryRepository } from "./memory.repository.js";
import { ProjectRepository } from "./project.repository.js";

describe("MemoryRepository", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const tempDir of tempDirs.splice(0)) {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it("persists Memory V2 provenance, scope, validity range, and conflict metadata", async () => {
    const projectDatabase = await createProjectDatabaseWithProject(tempDirs);
    try {
      const repository = new MemoryRepository(projectDatabase);
      const memory = repository.createMemory({
        confidence: 0.92,
        content: "林鸢在第九章前已经失去星潮感知。",
        contradictionGroupId: "contradiction_group_1",
        entityId: "character_linyuan",
        entityType: "character",
        evidence: {
          artifactId: "artifact_1",
          quote: "星潮感知彻底沉寂。",
        },
        kind: "state",
        memoryId: "memory_1",
        projectId: "project_1",
        scope: "arc",
        sourceId: "artifact_1",
        sourceQuote: "星潮感知彻底沉寂。",
        sourceType: "artifact",
        status: "canon",
        supersedesMemoryId: "memory_old",
        validFromChapterIndex: 9,
        validToChapterIndex: 18,
      });

      expect(memory).toMatchObject({
        contradictionGroupId: "contradiction_group_1",
        embeddingRef: null,
        scope: "arc",
        sourceId: "artifact_1",
        sourceQuote: "星潮感知彻底沉寂。",
        sourceType: "artifact",
        supersedesMemoryId: "memory_old",
        validFromChapterIndex: 9,
        validToChapterIndex: 18,
      });
      expect(memory.evidence).toEqual({
        artifactId: "artifact_1",
        quote: "星潮感知彻底沉寂。",
      });
      expect(repository.listMemories({ projectId: "project_1", statuses: ["canon"] })[0]).toEqual(
        memory,
      );
    } finally {
      projectDatabase.close();
    }
  });
});

async function createProjectDatabaseWithProject(tempDirs: string[]) {
  const tempDir = mkdtempSync(join(tmpdir(), "story-pilot-memory-repository-"));
  tempDirs.push(tempDir);
  const projectDatabase = createProjectDatabase(join(tempDir, PROJECT_DATABASE_FILE));
  await runProjectMigrations(projectDatabase);
  new ProjectRepository(projectDatabase).createProject({
    defaultVolumeId: "volume_1",
    genre: "玄幻",
    projectId: "project_1",
    rootPath: join(tempDir, "project_1"),
    title: "星潮纪",
    workId: "work_1",
  });

  return projectDatabase;
}
