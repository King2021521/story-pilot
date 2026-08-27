import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Test } from "@nestjs/testing";
import { createProjectDatabase, PROJECT_DATABASE_FILE } from "@story-pilot/db";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ProjectModule } from "../project/project.module.js";
import { ProjectService } from "../project/project.service.js";
import { WorldModule } from "./world.module.js";
import { WorldRuleService } from "./world-rule.service.js";

describe("WorldRuleService", () => {
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

  it("creates canon world rules and records domain events", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "story-pilot-world-"));
    tempDirs.push(rootDir);
    process.env.STORY_PILOT_PROJECTS_ROOT = rootDir;

    const moduleRef = await Test.createTestingModule({
      imports: [ProjectModule, WorldModule],
    }).compile();
    const projectService = moduleRef.get(ProjectService);
    const worldRuleService = moduleRef.get(WorldRuleService);

    const project = await projectService.createProject({ title: "长夜序章", genre: "悬疑" });
    const rule = await worldRuleService.createWorldRule({
      projectId: project.id,
      category: "society",
      title: "旧城区治安结构",
      statement: "旧城区存在由熟人关系维系的地下消息网络。",
      constraintLevel: "hard",
    });

    expect(rule).toMatchObject({
      category: "society",
      content: "旧城区存在由熟人关系维系的地下消息网络。",
      status: "canon",
      title: "旧城区治安结构",
    });

    const projectDatabase = createProjectDatabase(join(project.rootPath, PROJECT_DATABASE_FILE));
    try {
      const event = projectDatabase.client
        .prepare("select event_type from domain_events where aggregate_id = ?")
        .get(rule.id);

      expect(event).toMatchObject({ event_type: "world_rule.created" });
    } finally {
      projectDatabase.close();
    }
  });
});
