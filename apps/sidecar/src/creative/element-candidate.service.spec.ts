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
import { createProjectDatabase, PROJECT_DATABASE_FILE, WorldRepository } from "@story-pilot/db";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { MODEL_GATEWAY } from "../ai/model-gateway.provider.js";
import { ProjectModule } from "../project/project.module.js";
import { ProjectService } from "../project/project.service.js";
import { CreativeModule } from "./creative.module.js";
import { ElementCandidateService } from "./element-candidate.service.js";

describe("ElementCandidateService", () => {
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

  it("injects toolbox intent into the element prompt and keeps an expanded output budget", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "story-pilot-element-candidates-"));
    tempDirs.push(rootDir);
    process.env.STORY_PILOT_PROJECTS_ROOT = rootDir;
    const provider = new CapturingObjectProvider({
      items: [
        {
          description: "控制安全屋外部白色补给线的半地下互助联盟。",
          name: "白线同盟",
          rationale: "能承载物资交易、背叛和临时秩序争夺。",
          tags: ["补给", "势力"],
          type: "faction",
        },
      ],
    });

    const moduleRef = await Test.createTestingModule({
      imports: [ProjectModule, CreativeModule],
    })
      .overrideProvider(MODEL_GATEWAY)
      .useValue(new ModelGateway(provider))
      .compile();
    try {
      const projectService = moduleRef.get(ProjectService);
      const elementCandidateService = moduleRef.get(ElementCandidateService);
      const project = await projectService.createProject({
        genre: "冰雪末世",
        style: "硬核生存、基地经营",
        title: "雪境堡垒",
      });
      const projectDatabase = createProjectDatabase(join(project.rootPath, PROJECT_DATABASE_FILE));
      try {
        new WorldRepository(projectDatabase).createWorldRule({
          category: "economy",
          constraintLevel: "hard",
          projectId: project.id,
          statement: "极寒后燃料、电池、药品和安全屋通行权成为核心资源。",
          title: "资源秩序",
          worldRuleId: "rule_resource_order",
        });
      } finally {
        projectDatabase.close();
      }

      const generated = await elementCandidateService.generateCandidates({
        constraints: ["不要英文缩写", "名字要能长期反复出场"],
        count: 5,
        description: "围绕安全屋外部补给线生成可长期博弈的地下势力名称。",
        elementType: "faction",
        genre: "冰雪末世",
        projectId: project.id,
        style: "硬核生存、基地经营",
        worldRuleIds: ["rule_resource_order"],
      });

      expect(generated.items).toHaveLength(5);
      expect(generated.items[0]).toMatchObject({ name: "白线同盟", type: "faction" });
      expect(provider.calls).toHaveLength(1);
      const [firstCall] = provider.calls;
      expect(firstCall).toMatchObject({
        maxOutputTokens: 5000,
        promptVersion: "element-candidate.generate@v1",
        purpose: "element_generate",
        schemaName: "ElementCandidateOutput",
        temperature: 0.8,
      });
      if (!firstCall) {
        throw new Error("expected model provider to receive an element generation call");
      }
      const promptText = firstCall.messages.map((message) => message.content).join("\n");
      expect(promptText).toContain("模板：element-candidate.generate@v1");
      expect(promptText).toContain("<generationRequest>");
      expect(promptText).toContain('"count": 5');
      expect(promptText).toContain("雪境堡垒");
      expect(promptText).toContain('"elementType": "faction"');
      expect(promptText).toContain(
        '"description": "围绕安全屋外部补给线生成可长期博弈的地下势力名称。"',
      );
      expect(promptText).toContain("资源秩序");
      expect(promptText).toContain("每个候选的 description 40 到 90 字");
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
