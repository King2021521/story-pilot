import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Test } from "@nestjs/testing";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ChapterModule } from "../chapter/chapter.module.js";
import { ChapterService } from "../chapter/chapter.service.js";
import { ProjectModule } from "../project/project.module.js";
import { ProjectService } from "../project/project.service.js";
import { ArtifactModule } from "./artifact.module.js";
import { ArtifactService } from "./artifact.service.js";

describe("ArtifactService", () => {
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

  it("applies an AI draft artifact by creating the next chapter version", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "story-pilot-artifacts-"));
    tempDirs.push(rootDir);
    process.env.STORY_PILOT_PROJECTS_ROOT = rootDir;

    const moduleRef = await Test.createTestingModule({
      imports: [ProjectModule, ChapterModule, ArtifactModule],
    }).compile();
    const projectService = moduleRef.get(ProjectService);
    const chapterService = moduleRef.get(ChapterService);
    const artifactService = moduleRef.get(ArtifactService);

    const project = await projectService.createProject({
      title: "长夜序章",
      genre: "悬疑",
    });
    const chapter = await chapterService.createChapter({
      projectId: project.id,
      volumeId: project.defaultVolumeId,
      title: "第一章 雨夜来信",
    });
    await chapterService.saveContent({
      projectId: project.id,
      chapterId: chapter.id,
      content: "这是用户自己写下的第一版。",
      baseVersion: 0,
    });

    const artifact = await artifactService.createArtifact({
      projectId: project.id,
      kind: "chapter_draft",
      targetType: "chapter",
      targetId: chapter.id,
      title: "AI 草稿",
      body: "雨夜来信。门缝下的旧报纸露出了十年前的日期。",
    });

    const applied = await artifactService.applyArtifact({
      projectId: project.id,
      artifactId: artifact.id,
      applyMode: "replace",
      targetVersion: 1,
    });

    expect(applied.artifact.status).toBe("applied");
    expect(applied.chapter.version).toBe(2);
    expect(applied.chapter.content).toContain("十年前");
    expect(applied.chapter.content).not.toContain("用户自己写下");
  });
});
