import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Test } from "@nestjs/testing";
import {
  createProjectDatabase,
  GLOBAL_DATABASE_FILE,
  PROJECT_DATABASE_FILE,
} from "@story-pilot/db";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ProjectModule } from "./project.module.js";
import { ProjectService } from "./project.service.js";

describe("ProjectService", () => {
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

  it("creates a project directory and initial database records", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "story-pilot-projects-"));
    tempDirs.push(rootDir);
    process.env.STORY_PILOT_PROJECTS_ROOT = rootDir;

    const moduleRef = await Test.createTestingModule({
      imports: [ProjectModule],
    }).compile();
    const service = moduleRef.get(ProjectService);

    const project = await service.createProject({
      title: "长夜序章",
      genre: "悬疑",
      logline: "雨夜来信揭开旧案。",
      wordCountGoal: 80000,
    });

    expect(project.title).toBe("长夜序章");
    expect(project.genre).toBe("悬疑");
    expect(project.status).toBe("planning");
    expect(project.defaultVolumeId).toEqual(expect.any(String));
    expect(existsSync(project.rootPath)).toBe(true);
    expect(existsSync(join(project.rootPath, PROJECT_DATABASE_FILE))).toBe(true);
    expect(existsSync(join(project.rootPath, "graph.kuzu"))).toBe(true);
    expect(existsSync(join(project.rootPath, "files"))).toBe(true);
    expect(existsSync(join(project.rootPath, "snapshots"))).toBe(true);
    expect(existsSync(join(project.rootPath, "backups"))).toBe(true);
    expect(existsSync(join(rootDir, GLOBAL_DATABASE_FILE))).toBe(true);

    const projectDatabase = createProjectDatabase(join(project.rootPath, PROJECT_DATABASE_FILE));
    try {
      const projectRow = projectDatabase.client
        .prepare("select title, genre, status from projects")
        .get();
      const workRow = projectDatabase.client
        .prepare("select title, genre, target_length, logline from works")
        .get();
      const volumeRow = projectDatabase.client
        .prepare("select id, title, position from volumes")
        .get();

      expect(projectRow).toMatchObject({
        title: "长夜序章",
        genre: "悬疑",
        status: "planning",
      });
      expect(workRow).toMatchObject({
        title: "长夜序章",
        genre: "悬疑",
        target_length: 80000,
        logline: "雨夜来信揭开旧案。",
      });
      expect(volumeRow).toMatchObject({
        id: project.defaultVolumeId,
        title: "第一卷",
        position: 1,
      });
    } finally {
      projectDatabase.close();
    }

    const globalDatabase = createProjectDatabase(join(rootDir, GLOBAL_DATABASE_FILE));
    try {
      const indexRow = globalDatabase.client
        .prepare(
          "select project_id, title, genre, status, root_path, database_path, graph_path from project_index",
        )
        .get();

      expect(indexRow).toMatchObject({
        database_path: join(project.rootPath, PROJECT_DATABASE_FILE),
        genre: "悬疑",
        graph_path: join(project.rootPath, "graph.kuzu"),
        project_id: project.id,
        root_path: project.rootPath,
        status: "planning",
        title: "长夜序章",
      });
    } finally {
      globalDatabase.close();
    }
  });

  it("lists and opens projects through the global project index", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "story-pilot-projects-"));
    tempDirs.push(rootDir);
    process.env.STORY_PILOT_PROJECTS_ROOT = rootDir;

    const moduleRef = await Test.createTestingModule({
      imports: [ProjectModule],
    }).compile();
    const service = moduleRef.get(ProjectService);

    const firstProject = await service.createProject({ title: "第一部", genre: "悬疑" });
    const secondProject = await service.createProject({ title: "第二部", genre: "科幻" });
    const opened = await service.openProject({ path: firstProject.rootPath });
    const recent = await service.listRecent({ limit: 2 });

    expect(opened.id).toBe(firstProject.id);
    expect(recent.map((project) => project.id)).toEqual([firstProject.id, secondProject.id]);
  });
});
