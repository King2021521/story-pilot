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

  it("completes 12-dimension fields with structured prompt context and conservative parameters", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "story-pilot-worldbuilding-ai-"));
    tempDirs.push(rootDir);
    process.env.STORY_PILOT_PROJECTS_ROOT = rootDir;
    const provider = new CapturingObjectProvider({
      fields: {
        coreConflict: "旧信真相与旧城秩序不可同时保全。",
        culture: "旧城居民相信沉默是保护家人的必要代价。",
        economy: "档案、路引和旧城通行资格构成关键资源。",
        factions: "钟楼议会、旧警署残部和地下信使互相制衡。",
        geography: "旧城围绕钟楼向外扩散，内圈保存档案。",
        history: "十年前钟楼火灾改变了旧城权力结构。",
        powerOrder: "钟楼议会拥有名义裁决权。",
        powerSystem: "角色依靠线索、关系和档案解读能力推进调查。",
        rules: "任何人不得私自带走钟楼档案。",
        socialStructure: "旧城按是否拥有钟楼通行资格分层。",
        specialMechanism: "每封旧信都会对应一段被删改的档案。",
        worldBase: "近现代旧城悬疑世界。",
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
        powerSystem: "角色依靠线索、关系和档案解读能力推进调查。",
        worldBase: "近现代旧城悬疑世界。",
      });
      expect(provider.calls).toHaveLength(1);
      const [firstCall] = provider.calls;
      expect(firstCall).toMatchObject({
        purpose: "worldbuilding_generate",
        schemaName: "WorldbuildingFieldCompletionOutput",
        temperature: 0.65,
      });
      if (!firstCall) {
        throw new Error("expected model provider to receive a worldbuilding completion call");
      }
      const promptText = firstCall.messages.map((message) => message.content).join("\n");
      expect(promptText).toContain("长夜序章");
      expect(promptText).toContain("悬疑推理");
      expect(promptText).toContain("currentFields");
      expect(promptText).toContain("角色依靠档案解读推进调查。");
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
