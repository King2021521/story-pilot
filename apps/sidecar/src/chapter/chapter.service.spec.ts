import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Test } from "@nestjs/testing";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LongformPlanRepository } from "@story-pilot/db";

import { ProjectModule } from "../project/project.module.js";
import { ProjectService } from "../project/project.service.js";
import { ProjectStorageService } from "../storage/project-storage.service.js";
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

  it("generates a draft artifact from a persisted chapter plan and stores plan context", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "story-pilot-chapter-plan-draft-"));
    tempDirs.push(rootDir);
    process.env.STORY_PILOT_PROJECTS_ROOT = rootDir;
    process.env.STORY_PILOT_ALLOW_FAKE_MODEL = "true";

    const moduleRef = await Test.createTestingModule({
      imports: [ProjectModule, ChapterModule],
    }).compile();
    const projectService = moduleRef.get(ProjectService);
    const projectStorage = moduleRef.get(ProjectStorageService);
    const chapterService = moduleRef.get(ChapterService);

    const project = await projectService.createProject({
      title: "星潮纪",
      genre: "玄幻",
    });
    const projectDatabase = await projectStorage.openProjectDatabase(project.id);
    try {
      const longformRepository = new LongformPlanRepository(projectDatabase);
      longformRepository.createBookPlanHierarchy({
        bookPlanId: "book_plan_1",
        corePromise: "每十章完成一次冲突升级。",
        projectId: project.id,
        targetWordCount: 3_000_000,
        title: "星潮纪全书规划",
        volumes: [
          {
            arcs: [
              {
                arcIndex: 1,
                arcPlanId: "arc_plan_1",
                escalation: ["触碰禁令", "夺取碎星砂"],
                purpose: "启动星潮规则和主角代价。",
                startChapterIndex: 1,
                title: "星潮初醒",
              },
            ],
            majorConflict: "主角想修行星潮，司星阁禁止底层接触星潮。",
            purpose: "建立世界规则和主角动机。",
            targetWordCount: 300_000,
            title: "第一卷 星潮初醒",
            volumeIndex: 1,
            volumePlanId: "volume_plan_1",
          },
        ],
      });
      longformRepository.createChapterPlans({
        chapterPlans: [
          {
            chapterGoal: "主角第一次触碰星潮禁令。",
            chapterIndex: 1,
            chapterPlanId: "chapter_plan_1",
            conflict: "求生需求与司星阁禁令冲突。",
            emotionalTurn: "从压抑到短暂掌控。",
            hook: "禁令名单出现主角父亲名字。",
            informationGain: "星潮不是天灾，而是被人为管控的资源。",
            scenes: [
              {
                conflictTurn: "守卫发现主角私入禁区。",
                memoryTargets: ["主角触碰星潮禁令"],
                outcome: "主角带走一枚碎星砂。",
                sceneGoal: "展示禁区规则和主角动机。",
                sceneIndex: 1,
                scenePlanId: "scene_plan_1",
              },
            ],
            targetWordCount: 3200,
            title: "第 1 章 星潮禁令",
          },
        ],
        defaultArcPlanId: "arc_plan_1",
        projectId: project.id,
        sourceArtifactId: "artifact_rolling_1",
      });
    } finally {
      projectDatabase.close();
    }

    const result = await chapterService.generateDraftFromPlan({
      chapterPlanId: "chapter_plan_1",
      projectId: project.id,
    });

    expect(result.artifact).toMatchObject({
      kind: "chapter_draft",
      status: "pending",
      targetType: "chapter",
      title: "雨夜来信",
    });
    expect(result.artifact.metadata).toContain("chapter_plan_1");
    expect(result.memoryCandidates).toHaveLength(1);

    const verifyDatabase = await projectStorage.openProjectDatabase(project.id);
    try {
      const chapter = verifyDatabase.client
        .prepare("select * from chapters where project_id = ? and title = ?")
        .get(project.id, "第 1 章 星潮禁令");
      const contextItems = verifyDatabase.client
        .prepare(
          `
          select item_type, content
          from context_package_items
          where project_id = ?
          order by rank asc
          `,
        )
        .all(project.id) as Array<{ item_type: string; content: string }>;

      expect(chapter).toMatchObject({
        content: "",
        position: 1,
        version: 0,
      });
      expect(contextItems).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining("主角第一次触碰星潮禁令。"),
            item_type: "chapter_plan",
          }),
          expect.objectContaining({
            content: expect.stringContaining("展示禁区规则和主角动机。"),
            item_type: "scene_plan",
          }),
        ]),
      );
    } finally {
      verifyDatabase.close();
      await moduleRef.close();
    }
  });
});
