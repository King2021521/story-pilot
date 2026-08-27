import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Test } from "@nestjs/testing";
import { FakeModelProvider, ModelGateway } from "@story-pilot/ai";
import { createProjectDatabase, PROJECT_DATABASE_FILE } from "@story-pilot/db";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AiModule } from "../ai/ai.module.js";
import { MODEL_GATEWAY } from "../ai/model-gateway.provider.js";
import { ProjectModule } from "../project/project.module.js";
import { ProjectService } from "../project/project.service.js";
import { ChapterModule } from "./chapter.module.js";
import { ChapterService } from "./chapter.service.js";

describe("ChapterService.generateDraft", () => {
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

  it("creates a draft artifact and pending memory candidates without mutating chapter content", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "story-pilot-draft-"));
    tempDirs.push(rootDir);
    process.env.STORY_PILOT_PROJECTS_ROOT = rootDir;

    const moduleRef = await Test.createTestingModule({
      imports: [ProjectModule, AiModule, ChapterModule],
    })
      .overrideProvider(MODEL_GATEWAY)
      .useValue(
        new ModelGateway(
          new FakeModelProvider({
            objectResponses: {
              ChapterDraftOutput: {
                draft: {
                  body: "雨夜里，林鸢从门缝下抽出一封旧信。",
                  summary: "林鸢发现旧信。",
                  title: "雨夜来信",
                },
                memoryCandidates: [
                  {
                    confidence: 0.8,
                    content: "林鸢发现一封来历异常的旧信。",
                    entityType: "story_event",
                    kind: "event",
                  },
                ],
                reviewNotes: ["旧信来历仍需用户确认。"],
              },
            },
          }),
        ),
      )
      .compile();
    const projectService = moduleRef.get(ProjectService);
    const chapterService = moduleRef.get(ChapterService);

    const project = await projectService.createProject({
      genre: "悬疑",
      title: "长夜序章",
    });
    const chapter = await chapterService.createChapter({
      projectId: project.id,
      title: "第一章",
      volumeId: project.defaultVolumeId,
    });
    const saved = await chapterService.saveContent({
      baseVersion: 0,
      chapterId: chapter.id,
      content: "用户正文保持不变。",
      projectId: project.id,
    });

    const result = await chapterService.generateDraft({
      chapterId: chapter.id,
      instruction: "生成更强钩子的第一章草稿",
      projectId: project.id,
    });

    expect(result.artifact).toMatchObject({
      body: expect.stringContaining("旧信"),
      kind: "chapter_draft",
      status: "pending",
      targetId: chapter.id,
      targetType: "chapter",
    });
    expect(result.memoryCandidates).toEqual([
      expect.objectContaining({
        content: "林鸢发现一封来历异常的旧信。",
        status: "pending",
      }),
    ]);

    const projectDatabase = createProjectDatabase(join(project.rootPath, PROJECT_DATABASE_FILE));
    try {
      expect(
        projectDatabase.client.prepare("select content, version from chapters where id = ?").get(chapter.id),
      ).toEqual({
        content: "用户正文保持不变。",
        version: saved.version,
      });
      expect(
        projectDatabase.client
          .prepare("select kind, status, target_id from artifacts where id = ?")
          .get(result.artifact.id),
      ).toMatchObject({
        kind: "chapter_draft",
        status: "pending",
        target_id: chapter.id,
      });
      expect(
        projectDatabase.client
          .prepare("select content, status from memory_candidates where source_id = ?")
          .all(result.artifact.id),
      ).toEqual([
        expect.objectContaining({
          content: "林鸢发现一封来历异常的旧信。",
          status: "pending",
        }),
      ]);
    } finally {
      projectDatabase.close();
    }
  });
});
