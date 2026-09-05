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
  ChapterRepository,
  CharacterRepository,
  createProjectDatabase,
  PROJECT_DATABASE_FILE,
  SerialStateRepository,
} from "@story-pilot/db";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { MODEL_GATEWAY } from "../ai/model-gateway.provider.js";
import { ContextPackageModule } from "../context-package/context-package.module.js";
import { ProjectModule } from "../project/project.module.js";
import { ProjectService } from "../project/project.service.js";
import { SerialStateModule } from "./serial-state.module.js";
import { SerialStateService } from "./serial-state.service.js";

describe("SerialStateService", () => {
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

  it("extracts state deltas as an artifact and applies snapshots plus plot debts only after adoption", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "story-pilot-serial-state-service-"));
    tempDirs.push(rootDir);
    process.env.STORY_PILOT_PROJECTS_ROOT = rootDir;
    const provider = new CapturingObjectProvider({
      characterDeltas: [
        {
          characterId: "character_shen_yan",
          emotionalState: "警惕但开始承认堡垒边界需要被他人见证。",
          externalGoal: "守住第一次炉芯启动后的热源坐标。",
          internalNeed: "学会把信任变成可执行规则。",
          knowledgeState: "知道炉芯启动会留下可追踪热信号。",
          physicalState: "低温疲惫，右手冻伤。",
          relationshipChanges: ["与周岑形成条件同盟"],
          resourceChanges: ["消耗一组高密度电池"],
          riskFlags: ["热源坐标暴露"],
        },
      ],
      memoryCandidates: ["炉芯第一次启动会留下热信号。"],
      plotDebtDeltas: [
        {
          action: "create",
          note: "首次炉芯启动兑现升级爽点，但热信号来源和追踪者身份必须后续回收。",
          title: "炉芯热信号追踪者",
        },
      ],
      storyDelta: {
        globalSituationChange: "安全屋从隐蔽囤货点变成会释放热信号的争夺坐标。",
        hiddenInformation: ["三小时前预警来源仍未知"],
        locationChanges: ["旧堡垒地下二层从封闭区变成可疑热源区"],
        organizationChanges: ["北墙哨点可能捕捉到热源异常"],
        resourceChanges: ["高密度电池减少一组，供热可维持十二小时"],
        revealedInformation: ["炉芯启动会留下可追踪热信号"],
      },
    });

    const moduleRef = await Test.createTestingModule({
      imports: [ProjectModule, ContextPackageModule, SerialStateModule],
    })
      .overrideProvider(MODEL_GATEWAY)
      .useValue(new ModelGateway(provider))
      .compile();

    try {
      const projectService = moduleRef.get(ProjectService);
      const serialStateService = moduleRef.get(SerialStateService);
      const project = await projectService.createProject({
        genre: "冰雪末世",
        style: "硬核生存、基地经营",
        title: "雪境堡垒",
      });
      seedAppliedChapter(project.rootPath, project.id, project.defaultVolumeId);

      const generated = await serialStateService.extractDelta({
        chapterId: "chapter_1",
        chapterVersion: 1,
        projectId: project.id,
      });

      expect(generated.artifact).toMatchObject({
        kind: "story_state_delta_draft",
        status: "pending",
        targetId: "chapter_1",
        targetType: "chapter",
      });
      const [firstCall] = provider.calls;
      if (!firstCall) {
        throw new Error("expected model provider to receive a state extraction call");
      }
      expect(firstCall).toMatchObject({
        maxOutputTokens: 6000,
        promptVersion: "story-state-delta.extract@v1",
        purpose: "story_state_delta_extract",
        schemaName: "StoryStateDeltaOutput",
        temperature: 0.2,
      });
      const promptText = firstCall.messages.map((message) => message.content).join("\n");
      expect(promptText).toContain("<chapter>");
      expect(promptText).toContain("<contextPackage>");
      expect(promptText).toContain("炉芯启动");

      const afterGenerateDatabase = createProjectDatabase(
        join(project.rootPath, PROJECT_DATABASE_FILE),
      );
      try {
        const repository = new SerialStateRepository(afterGenerateDatabase);
        expect(repository.listStorySnapshots(project.id)).toHaveLength(0);
        expect(repository.listPlotDebts({ projectId: project.id })).toHaveLength(0);
      } finally {
        afterGenerateDatabase.close();
      }

      const applied = await serialStateService.applyDelta({
        artifactId: generated.artifact.id,
        projectId: project.id,
      });

      expect(applied.storySnapshot).toMatchObject({
        chapterIndex: 1,
        globalSituation: "安全屋从隐蔽囤货点变成会释放热信号的争夺坐标。",
        revealedInformation: ["炉芯启动会留下可追踪热信号"],
      });
      expect(applied.characterSnapshots).toEqual([
        expect.objectContaining({
          characterId: "character_shen_yan",
          riskFlags: ["热源坐标暴露"],
        }),
      ]);
      expect(applied.plotDebtChanges).toEqual([
        expect.objectContaining({
          debtType: "reader_promise",
          lifecycleNotes: ["首次炉芯启动兑现升级爽点，但热信号来源和追踪者身份必须后续回收。"],
          status: "open",
          title: "炉芯热信号追踪者",
        }),
      ]);
    } finally {
      await moduleRef.close();
    }
  });
});

function seedAppliedChapter(rootPath: string, projectId: string, volumeId: string): void {
  const projectDatabase = createProjectDatabase(join(rootPath, PROJECT_DATABASE_FILE));
  try {
    new CharacterRepository(projectDatabase).createCharacter({
      characterId: "character_shen_yan",
      name: "沈砚",
      projectId,
      role: "protagonist",
      traits: [],
    });
    const chapterRepository = new ChapterRepository(projectDatabase);
    chapterRepository.createChapter({
      chapterId: "chapter_1",
      projectId,
      summary: "沈砚启动旧堡垒炉芯。",
      title: "第一章 炉芯预警",
      volumeId,
    });
    chapterRepository.saveContent({
      baseVersion: 0,
      chapterId: "chapter_1",
      content:
        "冻雨敲在旧堡垒外墙上。沈砚合上闸门，炉芯启动，温度计第一次越过零度线，同时日志跳出三小时前的预警。",
      nextVersion: 1,
      projectId,
      source: "user",
      versionId: "chapter_version_1",
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
