import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Test } from "@nestjs/testing";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ChapterModule } from "../chapter/chapter.module.js";
import { ChapterService } from "../chapter/chapter.service.js";
import { ProjectModule } from "../project/project.module.js";
import { ProjectService } from "../project/project.service.js";
import { ProjectStorageService } from "../storage/project-storage.service.js";
import { StorageModule } from "../storage/storage.module.js";
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

  it("rejects applying an AI draft artifact over a newer user chapter version", async () => {
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
      content: "用户第一版。",
      baseVersion: 0,
    });
    const artifact = await artifactService.createArtifact({
      body: "AI 草稿。",
      kind: "chapter_draft",
      projectId: project.id,
      targetId: chapter.id,
      targetType: "chapter",
      title: "AI 草稿",
    });
    await chapterService.saveContent({
      projectId: project.id,
      chapterId: chapter.id,
      content: "用户第二版，不应被旧草稿覆盖。",
      baseVersion: 1,
    });

    await expect(
      artifactService.applyArtifact({
        applyMode: "replace",
        artifactId: artifact.id,
        projectId: project.id,
        targetVersion: 1,
      }),
    ).rejects.toThrow("CHAPTER_VERSION_CONFLICT");

    await expect(chapterService.getChapter(project.id, chapter.id)).resolves.toMatchObject({
      content: "用户第二版，不应被旧草稿覆盖。",
      version: 2,
    });
  });

  it("creates an AI chapter version linked to the applied artifact without changing content in version-only mode", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "story-pilot-artifacts-"));
    tempDirs.push(rootDir);
    process.env.STORY_PILOT_PROJECTS_ROOT = rootDir;

    const moduleRef = await Test.createTestingModule({
      imports: [ProjectModule, ChapterModule, ArtifactModule, StorageModule],
    }).compile();
    const projectService = moduleRef.get(ProjectService);
    const chapterService = moduleRef.get(ChapterService);
    const artifactService = moduleRef.get(ArtifactService);
    const projectStorage = moduleRef.get(ProjectStorageService);

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
      content: "用户当前正文。",
      baseVersion: 0,
    });

    const artifact = await artifactService.createArtifact({
      body: "AI 备选草稿。",
      kind: "chapter_draft",
      projectId: project.id,
      targetId: chapter.id,
      targetType: "chapter",
      title: "AI 草稿",
    });

    const applied = await artifactService.applyArtifact({
      applyMode: "create_version_only",
      artifactId: artifact.id,
      projectId: project.id,
      targetVersion: 1,
    });

    expect(applied.chapter.content).toBe("用户当前正文。");
    expect(applied.chapter.version).toBe(2);

    const projectDatabase = await projectStorage.openProjectDatabase(project.id);
    try {
      const versionRow = projectDatabase.client
        .prepare(
          "select source, content, artifact_id from chapter_versions where chapter_id = ? and version = ?",
        )
        .get(chapter.id, 2) as { source: string; content: string; artifact_id: string | null };
      expect(versionRow).toEqual({
        artifact_id: artifact.id,
        content: "AI 备选草稿。",
        source: "ai",
      });

      const eventRow = projectDatabase.client
        .prepare(
          "select event_type, aggregate_id, payload from domain_events where aggregate_id = ?",
        )
        .get(artifact.id) as { event_type: string; aggregate_id: string; payload: string };
      expect(eventRow.event_type).toBe("artifact.applied");
      expect(JSON.parse(eventRow.payload)).toMatchObject({
        applyMode: "create_version_only",
        chapterId: chapter.id,
        version: 2,
      });
    } finally {
      projectDatabase.close();
    }
  });

  it("applies a structured rewrite patch artifact to chapter content", async () => {
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
      title: "第一章 雨夜来信",
      volumeId: project.defaultVolumeId,
    });
    await chapterService.saveContent({
      baseVersion: 0,
      chapterId: chapter.id,
      content: "旧城区下雨。林鸢看见门缝下的信。",
      projectId: project.id,
    });

    const artifact = await artifactService.createArtifact({
      body: JSON.stringify({
        operations: [
          {
            find: "旧城区下雨",
            op: "replace_text",
            replace: "旧城区落雨",
          },
        ],
      }),
      kind: "rewrite_patch",
      projectId: project.id,
      targetId: chapter.id,
      targetType: "chapter",
      title: "润色补丁",
    });

    const applied = await artifactService.applyArtifact({
      applyMode: "patch",
      artifactId: artifact.id,
      projectId: project.id,
      targetVersion: 1,
    });

    expect(applied.chapter).toMatchObject({
      content: "旧城区落雨。林鸢看见门缝下的信。",
      version: 2,
    });
    expect(applied.artifact.status).toBe("applied");
  });
});
