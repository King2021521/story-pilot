import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Test } from "@nestjs/testing";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ProjectModule } from "../project/project.module.js";
import { ProjectService } from "../project/project.service.js";
import { ChapterModule } from "./chapter.module.js";
import { ChapterService } from "./chapter.service.js";

describe("ChapterService", () => {
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

  it("creates chapters and saves user content as incrementing versions", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "story-pilot-chapters-"));
    tempDirs.push(rootDir);
    process.env.STORY_PILOT_PROJECTS_ROOT = rootDir;

    const moduleRef = await Test.createTestingModule({
      imports: [ProjectModule, ChapterModule],
    }).compile();
    const projectService = moduleRef.get(ProjectService);
    const chapterService = moduleRef.get(ChapterService);

    const project = await projectService.createProject({
      title: "长夜序章",
      genre: "悬疑",
    });
    const chapter = await chapterService.createChapter({
      projectId: project.id,
      volumeId: project.defaultVolumeId,
      title: "第一章 雨夜来信",
      summary: "主角收到一封来自旧案现场的信。",
    });

    expect(chapter).toMatchObject({
      title: "第一章 雨夜来信",
      version: 0,
      wordCount: 0,
    });

    const saved = await chapterService.saveContent({
      projectId: project.id,
      chapterId: chapter.id,
      content: "雨夜来信。旧案重新浮出水面。",
      baseVersion: 0,
    });

    expect(saved.version).toBe(1);
    expect(saved.content).toContain("旧案");

    const versions = await chapterService.listVersions({
      projectId: project.id,
      chapterId: chapter.id,
    });
    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({
      source: "user",
      version: 1,
    });
  });
});
