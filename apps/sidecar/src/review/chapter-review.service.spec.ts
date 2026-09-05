import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Test } from "@nestjs/testing";
import {
  ModelGateway,
  type ModelProvider,
  type ProviderEmbedInput,
  type ProviderEmbedResult,
  type ProviderGenerateObjectInput,
  type ProviderObjectResult,
  type ProviderStreamTextInput,
} from "@story-pilot/ai";
import {
  ArtifactRepository,
  ChapterExecutionCardRepository,
  ChapterRepository,
  createProjectDatabase,
  LongformPlanRepository,
  PROJECT_DATABASE_FILE,
} from "@story-pilot/db";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { MODEL_GATEWAY } from "../ai/model-gateway.provider.js";
import { ContextPackageModule } from "../context-package/context-package.module.js";
import { ProjectModule } from "../project/project.module.js";
import { ProjectService } from "../project/project.service.js";
import { ChapterReviewService } from "./chapter-review.service.js";
import { ReviewModule } from "./review.module.js";

describe("ChapterReviewService", () => {
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

  it("generates a chapter review artifact using the execution card and selected chapter version", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "story-pilot-chapter-review-service-"));
    tempDirs.push(rootDir);
    process.env.STORY_PILOT_PROJECTS_ROOT = rootDir;
    const provider = new CapturingObjectProvider({
      blockingIssues: [
        {
          issueType: "hook_missing",
          message: "章末没有兑现执行卡要求的不可能预警。",
          relatedEntityIds: ["chapter_1"],
          severity: "warning",
        },
      ],
      dimensions: [
        {
          evidence: "正文完成炉芯启动，但章末追踪钩子不足。",
          key: "plan_fit",
          score: 78,
          suggestion: "补一段炉芯日志异常，把外部追踪压力落到章末。",
        },
      ],
      rewriteSuggestions: ["把最后 300 字改成日志预警和外部热源扫描同步出现。"],
      score: 78,
    });

    const moduleRef = await Test.createTestingModule({
      imports: [ProjectModule, ContextPackageModule, ReviewModule],
    })
      .overrideProvider(MODEL_GATEWAY)
      .useValue(new ModelGateway(provider))
      .compile();

    try {
      const projectService = moduleRef.get(ProjectService);
      const reviewService = moduleRef.get(ChapterReviewService);
      const project = await projectService.createProject({
        genre: "冰雪末世",
        style: "硬核生存、基地经营",
        title: "雪境堡垒",
        wordCountGoal: 5_000_000,
      });
      seedChapterReviewContext(project.rootPath, project.id, project.defaultVolumeId);

      const generated = await reviewService.reviewDraft({
        chapterId: "chapter_1",
        chapterVersion: 1,
        projectId: project.id,
      });

      expect(generated.artifact).toMatchObject({
        kind: "chapter_review_report",
        status: "pending",
        targetId: "chapter_1",
        targetType: "chapter",
        title: "第一章 炉芯预警 审稿报告",
      });
      expect(provider.calls).toHaveLength(1);
      const [firstCall] = provider.calls;
      if (!firstCall) {
        throw new Error("expected model provider to receive a chapter review call");
      }
      expect(firstCall).toMatchObject({
        maxOutputTokens: 6000,
        promptVersion: "chapter-review.generate@v1",
        purpose: "chapter_review",
        schemaName: "ChapterReviewOutput",
        temperature: 0.2,
      });
      const promptText = firstCall.messages.map((message) => message.content).join("\n");
      expect(promptText).toContain("模板：chapter-review.generate");
      expect(promptText).toContain("<chapterExecutionCard>");
      expect(promptText).toContain("安全屋第一次供热成功");
      expect(promptText).toContain("炉芯启动成功，但章末没有出现追踪者");

      const projectDatabase = createProjectDatabase(join(project.rootPath, PROJECT_DATABASE_FILE));
      try {
        expect(
          new ArtifactRepository(projectDatabase).getById(project.id, generated.artifact.id),
        ).toMatchObject({ status: "pending" });
      } finally {
        projectDatabase.close();
      }
    } finally {
      await moduleRef.close();
    }
  });
});

function seedChapterReviewContext(rootPath: string, projectId: string, volumeId: string): void {
  const projectDatabase = createProjectDatabase(join(rootPath, PROJECT_DATABASE_FILE));
  try {
    const longformRepository = new LongformPlanRepository(projectDatabase);
    const chapterRepository = new ChapterRepository(projectDatabase);
    const chapter = chapterRepository.createChapter({
      chapterId: "chapter_1",
      projectId,
      summary: "沈砚启动旧堡垒炉芯。",
      title: "第一章 炉芯预警",
      volumeId,
    });
    chapterRepository.saveContent({
      baseVersion: 0,
      chapterId: chapter.id,
      content: "炉芯启动成功，但章末没有出现追踪者。",
      nextVersion: 1,
      projectId,
      source: "user",
      versionId: "chapter_version_1",
    });
    longformRepository.saveChapterPlan({
      arcPlanId: null,
      chapterGoal: "安全屋第一次供热成功。",
      chapterIndex: 1,
      chapterPlanId: "chapter_plan_1",
      conflict: "供热会暴露位置。",
      emotionalTurn: "从独自囤积转向面对外部求援。",
      hook: "章末出现热信号追踪。",
      informationGain: "炉芯短时可用。",
      projectId,
      relatedCharacterIds: [],
      relatedForeshadowingIds: [],
      relatedPlotlineIds: [],
      status: "draft",
      targetWordCount: 3500,
      title: "第一章 炉芯预警",
    });
    new ChapterExecutionCardRepository(projectDatabase).save({
      chapterId: chapter.id,
      chapterIndex: 1,
      chapterPlanId: "chapter_plan_1",
      coreConflict: "供热收益和坐标暴露之间的选择。",
      emotionalTurn: "沈砚开始承认安全屋需要边界规则。",
      forbiddenMoves: ["不要提前解释冰冠计划"],
      hook: "热信号追踪者在章末出现。",
      informationGain: "炉芯短时可用但会留下热信号。",
      narrativeGoal: "完成安全屋第一次升级并制造外部追踪压力。",
      povCharacterId: null,
      projectId,
      readerReward: "安全屋供热闭环首次兑现。",
      relatedForeshadowingIds: [],
      relatedPlotDebtIds: [],
      relatedPlotlineIds: [],
      requiredCharacterIds: [],
      requiredLocationIds: [],
      sceneBriefs: [
        {
          conflictTurn: "启动供热会暴露坐标。",
          memoryTargets: ["炉芯热信号"],
          outcome: "安全屋升温，外部风险上升。",
          sceneGoal: "验证供热闭环。",
          sceneIndex: 1,
        },
      ],
      sourceArtifactId: null,
      status: "confirmed",
      targetWordCount: 3500,
      title: "第一章 炉芯预警",
    });
  } finally {
    projectDatabase.close();
  }
}

class CapturingObjectProvider implements ModelProvider {
  readonly calls: ProviderGenerateObjectInput[] = [];
  readonly model = "capture-model";
  readonly name = "capture";

  constructor(private readonly object: unknown) {}

  async generateObject(input: ProviderGenerateObjectInput): Promise<ProviderObjectResult> {
    this.calls.push(input);

    return {
      object: this.object,
      raw: { object: this.object },
    };
  }

  streamText(_input: ProviderStreamTextInput): AsyncIterable<string> {
    void _input;
    return (async function* emptyStream() {})();
  }

  async embed(_input: ProviderEmbedInput): Promise<ProviderEmbedResult> {
    void _input;
    return { embedding: [] };
  }
}
