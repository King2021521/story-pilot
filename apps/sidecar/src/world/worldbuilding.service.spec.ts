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
  createProjectDatabase,
  PROJECT_DATABASE_FILE,
  type WorldbuildingFields,
} from "@story-pilot/db";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { MODEL_GATEWAY } from "../ai/model-gateway.provider.js";
import { ProjectModule } from "../project/project.module.js";
import { ProjectService } from "../project/project.service.js";
import { WorldbuildingService } from "./worldbuilding.service.js";
import { WorldModule } from "./world.module.js";

function worldbuildingFields(overrides: Partial<WorldbuildingFields>): WorldbuildingFields {
  return {
    coreConflict: "",
    culture: "",
    economy: "",
    factions: "",
    geography: "",
    history: "",
    powerOrder: "",
    powerSystem: "",
    rules: "",
    socialStructure: "",
    specialMechanism: "",
    worldBase: "",
    ...overrides,
  };
}

describe("WorldbuildingService", () => {
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

  it("saves fixed worldbuilding form fields into one project profile", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "story-pilot-worldbuilding-service-"));
    tempDirs.push(rootDir);
    process.env.STORY_PILOT_PROJECTS_ROOT = rootDir;

    const moduleRef = await Test.createTestingModule({
      imports: [ProjectModule, WorldModule],
    }).compile();
    try {
      const projectService = moduleRef.get(ProjectService);
      const worldbuildingService = moduleRef.get(WorldbuildingService);
      const project = await projectService.createProject({ title: "长夜序章", genre: "悬疑" });

      const profile = await worldbuildingService.saveFields({
        fields: worldbuildingFields({
          geography: "旧城围绕钟楼扩散。",
          worldBase: "近现代旧城悬疑世界。",
        }),
        projectId: project.id,
      });

      expect(profile.fields).toMatchObject({
        geography: "旧城围绕钟楼扩散。",
        powerSystem: "",
        worldBase: "近现代旧城悬疑世界。",
      });

      const projectDatabase = createProjectDatabase(join(project.rootPath, PROJECT_DATABASE_FILE));
      try {
        const rowCount = projectDatabase.client
          .prepare("select count(*) as count from worldbuilding_profiles where project_id = ?")
          .get(project.id) as { count: number };
        const worldRuleCount = projectDatabase.client
          .prepare("select count(*) as count from world_rules where project_id = ?")
          .get(project.id) as { count: number };

        expect(rowCount.count).toBe(1);
        expect(worldRuleCount.count).toBe(0);
      } finally {
        projectDatabase.close();
      }
    } finally {
      await moduleRef.close();
    }
  });

  it("completes 12-dimension fields with a declared prompt template and expanded output budget", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "story-pilot-worldbuilding-ai-"));
    tempDirs.push(rootDir);
    process.env.STORY_PILOT_PROJECTS_ROOT = rootDir;
    const generatedDimension = buildGeneratedWorldbuildingText("旧城规则");
    const provider = new CapturingObjectProvider({
      fields: {
        coreConflict: generatedDimension,
        culture: generatedDimension,
        economy: generatedDimension,
        factions: generatedDimension,
        geography: generatedDimension,
        history: generatedDimension,
        powerOrder: generatedDimension,
        powerSystem: generatedDimension,
        rules: generatedDimension,
        socialStructure: generatedDimension,
        specialMechanism: generatedDimension,
        worldBase: generatedDimension,
      },
    });

    const moduleRef = await Test.createTestingModule({
      imports: [ProjectModule, WorldModule],
    })
      .overrideProvider(MODEL_GATEWAY)
      .useValue(new ModelGateway(provider))
      .compile();
    try {
      const projectService = moduleRef.get(ProjectService);
      const worldbuildingService = moduleRef.get(WorldbuildingService);
      const project = await projectService.createProject({
        genre: "悬疑",
        style: "悬疑推理",
        title: "长夜序章",
      });

      const completed = await worldbuildingService.completeFields({
        fields: worldbuildingFields({
          powerSystem: "角色依靠档案解读推进调查。",
          worldBase: "近现代旧城悬疑世界。",
        }),
        projectId: project.id,
      });

      expect(completed.fields).toMatchObject({
        powerSystem: generatedDimension,
        worldBase: generatedDimension,
      });
      expect(provider.calls).toHaveLength(1);
      const [firstCall] = provider.calls;
      expect(firstCall).toMatchObject({
        maxOutputTokens: 12000,
        purpose: "worldbuilding_generate",
        schemaName: "WorldbuildingFieldCompletionOutput",
        temperature: 0.65,
      });
      if (!firstCall) {
        throw new Error("expected model provider to receive a worldbuilding completion call");
      }
      const promptText = firstCall.messages.map((message) => message.content).join("\n");
      expect(promptText).toContain("模板：worldbuilding.complete@v1");
      expect(promptText).toContain("长夜序章");
      expect(promptText).toContain("悬疑推理");
      expect(promptText).toContain("<currentFields>");
      expect(promptText).toContain("角色依靠档案解读推进调查。");
      expect(promptText).toContain("每个字段 300 到 500 字");
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

function buildGeneratedWorldbuildingText(anchor: string): string {
  return [
    `${anchor}的设定描述围绕旧城档案、居民身份和钟楼裁决展开，所有人物行动都必须先面对通行资格、档案权限和公共沉默三层限制。`,
    "运行规则是任何线索都要通过人物选择才能生效，证据不能凭空出现，权力也不能无代价让步；每次调查推进都会消耗关系、暴露身份或触发旧组织反击。",
    "叙事冲突来自真相与安全不可兼得，主角越接近旧案核心，越会迫使盟友、亲人和对手重新站队。",
    "代价限制是每次破局都必须留下可回收后果，剧情接口则连接后续档案缺页、钟楼审议、地下信使和卷末公开审判。",
    "这一维度还必须能和空间地理、权力体系、资源经济和文化价值互相解释：地点决定谁能接触档案，权力决定谁能裁决真相，资源决定谁能承受公开代价，文化则解释普通人为什么会在沉默和反抗之间摇摆。",
  ].join("");
}
