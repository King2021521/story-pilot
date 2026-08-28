import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Test } from "@nestjs/testing";
import { createProjectDatabase, MemoryRepository, PROJECT_DATABASE_FILE } from "@story-pilot/db";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ProjectModule } from "../project/project.module.js";
import { ProjectService } from "../project/project.service.js";
import { MemoryModule } from "./memory.module.js";
import { MemoryService } from "./memory.service.js";

describe("MemoryService", () => {
  const tempDirs: string[] = [];
  let originalProjectsRoot: string | undefined;

  beforeEach(() => {
    originalProjectsRoot = process.env.STORY_PILOT_PROJECTS_ROOT;
  });

  afterEach(() => {
    if (originalProjectsRoot === undefined) {
      delete process.env.STORY_PILOT_PROJECTS_ROOT;
    } else {
      process.env.STORY_PILOT_PROJECTS_ROOT = originalProjectsRoot;
    }

    for (const tempDir of tempDirs.splice(0)) {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it("accepts a pending candidate as canon memory and emits a domain event", async () => {
    const { moduleRef, project, candidateId } = await createProjectWithCandidate(tempDirs);
    try {
      const memoryService = moduleRef.get(MemoryService);

      const result = await memoryService.confirm({
        candidateId,
        decision: "canon",
        projectId: project.id,
      });

      expect(result.candidate).toMatchObject({ id: candidateId, status: "accepted" });
      expect(result.memory).toMatchObject({
        content: "林鸢发现一封来历异常的旧信。",
        kind: "event",
        status: "canon",
      });

      const projectDatabase = createProjectDatabase(join(project.rootPath, PROJECT_DATABASE_FILE));
      try {
        expect(
          projectDatabase.client
            .prepare("select event_type, aggregate_id from domain_events where project_id = ?")
            .all(project.id),
        ).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              aggregate_id: result.memory?.id,
              event_type: "memory.confirmed",
            }),
          ]),
        );
      } finally {
        projectDatabase.close();
      }
    } finally {
      await moduleRef.close();
    }
  });

  it("rejects a candidate without creating canon memory", async () => {
    const { moduleRef, project, candidateId } = await createProjectWithCandidate(tempDirs);
    try {
      const memoryService = moduleRef.get(MemoryService);

      const result = await memoryService.reject({
        candidateId,
        projectId: project.id,
      });

      expect(result.candidate).toMatchObject({ id: candidateId, status: "rejected" });
      expect(result.memory).toBeUndefined();

      const projectDatabase = createProjectDatabase(join(project.rootPath, PROJECT_DATABASE_FILE));
      try {
        expect(
          projectDatabase.client.prepare("select count(*) as count from memories").get(),
        ).toEqual({ count: 0 });
      } finally {
        projectDatabase.close();
      }
    } finally {
      await moduleRef.close();
    }
  });

  it("merges a candidate into an existing memory", async () => {
    const { moduleRef, project, candidateId } = await createProjectWithCandidate(tempDirs);
    const targetMemoryId = "memory_target";
    const projectDatabase = createProjectDatabase(join(project.rootPath, PROJECT_DATABASE_FILE));
    try {
      new MemoryRepository(projectDatabase).createMemory({
        content: "林鸢发现一封旧信。",
        entityType: "story_event",
        kind: "event",
        memoryId: targetMemoryId,
        projectId: project.id,
        status: "canon",
      });
    } finally {
      projectDatabase.close();
    }

    try {
      const memoryService = moduleRef.get(MemoryService);

      const result = await memoryService.merge({
        candidateId,
        editedStatement: "林鸢发现一封来自十年前且来历异常的旧信。",
        projectId: project.id,
        targetMemoryId,
      });

      expect(result.candidate).toMatchObject({ id: candidateId, status: "merged" });
      expect(result.memory).toMatchObject({
        id: targetMemoryId,
        content: "林鸢发现一封来自十年前且来历异常的旧信。",
      });
    } finally {
      await moduleRef.close();
    }
  });
});

async function createProjectWithCandidate(tempDirs: string[]) {
  const rootDir = mkdtempSync(join(tmpdir(), "story-pilot-memory-"));
  tempDirs.push(rootDir);
  process.env.STORY_PILOT_PROJECTS_ROOT = rootDir;

  const moduleRef = await Test.createTestingModule({
    imports: [ProjectModule, MemoryModule],
  }).compile();
  const projectService = moduleRef.get(ProjectService);
  const project = await projectService.createProject({
    genre: "悬疑",
    title: "长夜序章",
  });
  const candidateId = "candidate_1";
  const projectDatabase = createProjectDatabase(join(project.rootPath, PROJECT_DATABASE_FILE));
  try {
    new MemoryRepository(projectDatabase).createCandidate({
      candidateId,
      confidence: 0.8,
      content: "林鸢发现一封来历异常的旧信。",
      entityType: "story_event",
      kind: "event",
      projectId: project.id,
      sourceId: "artifact_1",
      sourceType: "artifact",
    });
  } finally {
    projectDatabase.close();
  }

  return { candidateId, moduleRef, project };
}
