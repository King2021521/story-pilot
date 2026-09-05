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
  ChapterRepository,
  createProjectDatabase,
  PROJECT_DATABASE_FILE,
  SerialReviewRepository,
  SerialStateRepository,
} from "@story-pilot/db";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { MODEL_GATEWAY } from "../ai/model-gateway.provider.js";
import { ContextPackageModule } from "../context-package/context-package.module.js";
import { ProjectModule } from "../project/project.module.js";
import { ProjectService } from "../project/project.service.js";
import { ReviewModule } from "./review.module.js";
import { SerialReviewService } from "./serial-review.service.js";

describe("SerialReviewService", () => {
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

  it("generates a serial review artifact from summaries and applies it to serial_reviews", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "story-pilot-serial-review-service-"));
    tempDirs.push(rootDir);
    process.env.STORY_PILOT_PROJECTS_ROOT = rootDir;
    const provider = new CapturingObjectProvider({
      characterStagnation: [
        {
          characterId: "character_shen_yan",
          evidence: "沈砚连续 3 章只在防守。",
          suggestion: "让他主动布置假热源反制追踪者。",
        },
      ],
      nextActions: [
        {
          actionType: "plot_debt_fix",
          targetId: "plot_debt_heat_source",
          title: "第 11 章强化炉芯追踪者线索",
        },
      ],
      plotDebtRisks: [
        {
          plotDebtId: "plot_debt_heat_source",
          riskLevel: "high",
          suggestion: "追踪者身份不能继续空转。",
        },
      ],
      progressSummary: "前 10 章完成安全屋初建，但外部威胁升级不足。",
      promiseDelivery: [
        {
          evidence: "第 1、5、9 章完成三次安全屋升级。",
          promise: "安全屋持续升级",
          score: 82,
        },
      ],
      repetitionRisks: ["外部敲门式冲突重复。"],
      rhythmReport: {
        issue: "第 7-9 章信息增量偏低。",
        score: 76,
        suggestion: "补一次资源账目反转。",
      },
    });

    const moduleRef = await Test.createTestingModule({
      imports: [ProjectModule, ContextPackageModule, ReviewModule],
    })
      .overrideProvider(MODEL_GATEWAY)
      .useValue(new ModelGateway(provider))
      .compile();

    try {
      const projectService = moduleRef.get(ProjectService);
      const serialReviewService = moduleRef.get(SerialReviewService);
      const project = await projectService.createProject({
        genre: "冰雪末世",
        style: "硬核生存、基地经营",
        title: "雪境堡垒",
        wordCountGoal: 5_000_000,
      });
      seedSerialReviewContext(project.rootPath, project.id, project.defaultVolumeId);

      const generated = await serialReviewService.generate({
        endChapterIndex: 10,
        projectId: project.id,
        scope: "chapter_batch",
        startChapterIndex: 1,
      });

      expect(generated.artifact).toMatchObject({
        kind: "serial_review_report",
        status: "pending",
        targetId: "1-10",
        targetType: "chapter_range",
        title: "第 1-10 章阶段复盘",
      });
      expect(provider.calls).toHaveLength(1);
      const [firstCall] = provider.calls;
      if (!firstCall) {
        throw new Error("expected model provider to receive a serial review call");
      }
      expect(firstCall).toMatchObject({
        maxOutputTokens: 9000,
        promptVersion: "serial-review.generate@v1",
        purpose: "retrospective_generate",
        schemaName: "SerialReviewOutput",
        temperature: 0.35,
      });
      const promptText = firstCall.messages.map((message) => message.content).join("\n");
      expect(promptText).toContain("<reviewScope>");
      expect(promptText).toContain("第一章 炉芯预警");
      expect(promptText).toContain("安全屋持续升级承诺");
      expect(promptText).not.toContain("FULL_MANUSCRIPT_TEXT_SHOULD_NOT_ENTER_REVIEW");

      const afterGenerateDatabase = createProjectDatabase(
        join(project.rootPath, PROJECT_DATABASE_FILE),
      );
      try {
        expect(
          new SerialReviewRepository(afterGenerateDatabase).listByProject(project.id),
        ).toHaveLength(0);
      } finally {
        afterGenerateDatabase.close();
      }

      const applied = await serialReviewService.apply({
        artifactId: generated.artifact.id,
        projectId: project.id,
      });

      expect(applied).toMatchObject({
        progressSummary: "前 10 章完成安全屋初建，但外部威胁升级不足。",
        scope: "chapter_batch",
        sourceArtifactId: generated.artifact.id,
        status: "applied",
      });
      const afterApplyDatabase = createProjectDatabase(
        join(project.rootPath, PROJECT_DATABASE_FILE),
      );
      try {
        expect(
          new SerialReviewRepository(afterApplyDatabase).listByProject(project.id),
        ).toHaveLength(1);
        expect(
          new ArtifactRepository(afterApplyDatabase).getById(project.id, generated.artifact.id),
        ).toMatchObject({ status: "applied" });
      } finally {
        afterApplyDatabase.close();
      }
    } finally {
      await moduleRef.close();
    }
  });
});

function seedSerialReviewContext(rootPath: string, projectId: string, volumeId: string): void {
  const projectDatabase = createProjectDatabase(join(rootPath, PROJECT_DATABASE_FILE));
  try {
    const chapterRepository = new ChapterRepository(projectDatabase);
    const stateRepository = new SerialStateRepository(projectDatabase);
    const firstChapter = chapterRepository.createChapter({
      chapterId: "chapter_1",
      position: 1,
      projectId,
      summary: "沈砚启动炉芯，安全屋第一次供热成功。",
      title: "第一章 炉芯预警",
      volumeId,
    });
    chapterRepository.saveContent({
      baseVersion: 0,
      chapterId: firstChapter.id,
      content: "FULL_MANUSCRIPT_TEXT_SHOULD_NOT_ENTER_REVIEW",
      nextVersion: 1,
      projectId,
      source: "user",
      versionId: "chapter_version_1",
    });
    chapterRepository.createChapter({
      chapterId: "chapter_10",
      position: 10,
      projectId,
      summary: "沈砚守住安全屋外门，但追踪者身份仍未揭示。",
      title: "第十章 雪门试探",
      volumeId,
    });
    stateRepository.createStorySnapshot({
      activeConflicts: ["炉芯热信号追踪"],
      chapterId: "chapter_10",
      chapterIndex: 10,
      globalSituation: "安全屋初建完成，外部势力开始试探。",
      hiddenInformation: ["追踪者真实身份"],
      openQuestions: ["谁在追踪炉芯热信号"],
      projectId,
      revealedInformation: ["炉芯可持续供热但会暴露坐标"],
      storySnapshotId: "story_state_10",
    });
    stateRepository.savePlotDebt({
      debtId: "plot_debt_heat_source",
      debtType: "reader_promise",
      expectedPayoffChapterIndex: 18,
      lifecycleNotes: ["第 1 章种下安全屋持续升级承诺"],
      promise: "安全屋持续升级承诺",
      projectId,
      riskLevel: "high",
      seedChapterIndex: 1,
      status: "open",
      title: "安全屋持续升级承诺",
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
