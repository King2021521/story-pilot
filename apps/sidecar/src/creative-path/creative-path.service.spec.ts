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
import type { CommandPayload } from "@story-pilot/contracts";
import {
  createProjectDatabase,
  PROJECT_DATABASE_FILE,
  WorldbuildingRepository,
} from "@story-pilot/db";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { MODEL_GATEWAY } from "../ai/model-gateway.provider.js";
import { ProjectModule } from "../project/project.module.js";
import { ProjectService } from "../project/project.service.js";
import { CreativePathModule } from "./creative-path.module.js";
import { CreativePathService } from "./creative-path.service.js";

type CoreStoryFields = CommandPayload<"blueprint.saveForm">["fields"];

function coreStoryFields(overrides: Partial<CoreStoryFields> = {}): CoreStoryFields {
  return {
    antagonistForce: "",
    corePromise: "",
    differentiators: [],
    emotionalAxes: [],
    logline: "",
    mainConflict: "",
    mainGoal: "",
    premise: "",
    protagonistArc: "",
    risks: [],
    stakes: "",
    storyDriver: "growth_reversal",
    ...overrides,
  };
}

describe("CreativePathService core story form", () => {
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

  it("preserves estimated word and chapter counts when saving a brief", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "story-pilot-brief-length-service-"));
    tempDirs.push(rootDir);
    process.env.STORY_PILOT_PROJECTS_ROOT = rootDir;

    const moduleRef = await Test.createTestingModule({
      imports: [ProjectModule, CreativePathModule],
    }).compile();
    try {
      const projectService = moduleRef.get(ProjectService);
      const creativePathService = moduleRef.get(CreativePathService);
      const project = await projectService.createProject({ genre: "玄幻", title: "旧都遗物" });

      const brief = await creativePathService.saveBrief({
        emotionalRewards: ["爽点"],
        estimatedChapterCount: 260,
        estimatedWordCount: 800_000,
        genre: "玄幻",
        lengthProfile: "长篇连载",
        projectId: project.id,
        subgenres: ["废柴逆袭"],
      });

      expect(brief).toMatchObject({
        estimatedChapterCount: 260,
        estimatedWordCount: 800_000,
        genre: "玄幻",
        status: "draft",
      });
    } finally {
      await moduleRef.close();
    }
  });

  it("saves editable core story fields as the current blueprint draft", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "story-pilot-core-story-service-"));
    tempDirs.push(rootDir);
    process.env.STORY_PILOT_PROJECTS_ROOT = rootDir;

    const moduleRef = await Test.createTestingModule({
      imports: [ProjectModule, CreativePathModule],
    }).compile();
    try {
      const projectService = moduleRef.get(ProjectService);
      const creativePathService = moduleRef.get(CreativePathService);
      const project = await projectService.createProject({ genre: "悬疑", title: "长夜序章" });

      const blueprint = await creativePathService.saveBlueprintForm({
        fields: coreStoryFields({
          corePromise: "每个单元都给出硬线索和情绪反转。",
          differentiators: ["旧信谜题和人物成长绑定"],
          emotionalAxes: ["悬疑", "反转"],
          logline: "雨夜旧信把主角拖回十年前钟楼旧案。",
          mainConflict: "主角追查真相时不断触碰旧城秩序。",
          mainGoal: "找出钟楼火灾真相并保护仍被旧案威胁的人。",
          premise: "旧城钟楼火灾十年后，主角收到一封不该存在的旧信。",
          stakes: "失败会让旧案幸存者再次被清算。",
          storyDriver: "mystery",
        }),
        projectId: project.id,
      });

      expect(blueprint).toMatchObject({
        corePromise: "每个单元都给出硬线索和情绪反转。",
        emotionalAxes: ["悬疑", "反转"],
        mainGoal: "找出钟楼火灾真相并保护仍被旧案威胁的人。",
        stakes: "失败会让旧案幸存者再次被清算。",
        status: "draft",
        storyDriver: "mystery",
      });
    } finally {
      await moduleRef.close();
    }
  });

  it("completes core story fields with project, brief, worldbuilding and current field context", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "story-pilot-core-story-ai-"));
    tempDirs.push(rootDir);
    process.env.STORY_PILOT_PROJECTS_ROOT = rootDir;
    const provider = new CapturingObjectProvider({
      fields: coreStoryFields({
        antagonistForce: "旧城钟楼背后的既得利益者和被旧案保护的制度。",
        corePromise: "每个单元都提供硬线索、身份反转和旧案真相的一次推进。",
        differentiators: ["旧信谜题与人物成长绑定", "钟楼档案形成连续线索网"],
        emotionalAxes: ["悬疑", "反转"],
        logline: "雨夜旧信把主角拖回十年前钟楼旧案。",
        mainConflict: "主角追查真相时不断触碰旧城秩序。",
        mainGoal: "找出钟楼火灾真相并保护仍被旧案威胁的人。",
        premise: "旧城钟楼火灾十年后，主角收到一封不该存在的旧信。",
        protagonistArc: "从逃避旧案到主动承担真相带来的代价。",
        risks: ["线索密度不足会削弱追读", "旧案反转不能只靠隐瞒信息"],
        stakes: "失败会让旧案幸存者再次被清算。",
        storyDriver: "mystery",
      }),
    });

    const moduleRef = await Test.createTestingModule({
      imports: [ProjectModule, CreativePathModule],
    })
      .overrideProvider(MODEL_GATEWAY)
      .useValue(new ModelGateway(provider))
      .compile();
    try {
      const projectService = moduleRef.get(ProjectService);
      const creativePathService = moduleRef.get(CreativePathService);
      const project = await projectService.createProject({
        genre: "悬疑",
        logline: "雨夜旧信把主角拖回十年前钟楼旧案。",
        style: "悬疑推理",
        title: "长夜序章",
      });
      const projectDatabase = createProjectDatabase(join(project.rootPath, PROJECT_DATABASE_FILE));
      try {
        new WorldbuildingRepository(projectDatabase).saveProfile({
          fields: {
            worldBase: "近现代旧城悬疑世界。",
          },
          projectId: project.id,
        });
      } finally {
        projectDatabase.close();
      }

      const completed = await creativePathService.completeBlueprintForm({
        fields: coreStoryFields({
          mainGoal: "查清钟楼旧案。",
          premise: "主角收到旧信。",
        }),
        projectId: project.id,
      });

      expect(completed.fields).toMatchObject({
        mainGoal: "找出钟楼火灾真相并保护仍被旧案威胁的人。",
        storyDriver: "mystery",
      });
      expect(provider.calls).toHaveLength(1);
      const [firstCall] = provider.calls;
      if (!firstCall) {
        throw new Error("expected model provider to receive a core story completion call");
      }
      expect(firstCall).toMatchObject({
        purpose: "core_story_complete",
        schemaName: "CoreStoryFieldCompletionOutput",
        temperature: 0.7,
      });
      const promptText = firstCall.messages.map((message) => message.content).join("\n");
      expect(promptText).toContain("长夜序章");
      expect(promptText).toContain("悬疑推理");
      expect(promptText).toContain("worldbuildingProfile");
      expect(promptText).toContain("近现代旧城悬疑世界。");
      expect(promptText).toContain("查清钟楼旧案。");
    } finally {
      await moduleRef.close();
    }
  });
});

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
