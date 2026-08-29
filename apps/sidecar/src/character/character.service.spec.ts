import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Test } from "@nestjs/testing";
import { createProjectDatabase, PROJECT_DATABASE_FILE } from "@story-pilot/db";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ProjectModule } from "../project/project.module.js";
import { ProjectService } from "../project/project.service.js";
import { CharacterModule } from "./character.module.js";
import { CharacterService } from "./character.service.js";

describe("CharacterService", () => {
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

  it("creates characters with traits and confirmed entity relations", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "story-pilot-characters-"));
    tempDirs.push(rootDir);
    process.env.STORY_PILOT_PROJECTS_ROOT = rootDir;

    const moduleRef = await Test.createTestingModule({
      imports: [ProjectModule, CharacterModule],
    }).compile();
    const projectService = moduleRef.get(ProjectService);
    const characterService = moduleRef.get(CharacterService);

    const project = await projectService.createProject({ title: "长夜序章", genre: "悬疑" });
    const protagonist = await characterService.createCharacter({
      appearance: "旧风衣、随身旧笔记本。",
      arcEnd: "愿意公开旧案证据并承担代价。",
      arcStart: "逃避旧案，只想离开旧城。",
      arcTurn: "发现证人仍被追杀后决定回头。",
      biography: "前刑警，因旧案离队。",
      firstAppearance: "第 1 章",
      flaw: "过度自责",
      genderAge: "男，29 岁",
      goal: "查清父亲死亡真相",
      importance: "core",
      name: "林澈",
      narrativeFunction: "viewpoint",
      need: "学会信任他人",
      projectId: project.id,
      relationshipHook: "与周潜互相怀疑。",
      role: "protagonist",
      secret: "十年前曾到过案发现场",
      storyTask: "把旧信线索推进成主线调查。",
      voiceProfile: "克制、短句、观察细节",
    });
    const antagonist = await characterService.createCharacter({
      projectId: project.id,
      name: "周潜",
      role: "antagonist",
    });
    const relation = await characterService.createRelation({
      projectId: project.id,
      sourceEntityType: "character",
      sourceEntityId: protagonist.id,
      relationType: "suspects",
      targetEntityType: "character",
      targetEntityId: antagonist.id,
      description: "林澈怀疑周潜参与旧案掩盖。",
      polarity: -1,
      strength: 0.8,
    });

    expect(protagonist.traits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "goal", value: "查清父亲死亡真相" }),
        expect.objectContaining({ name: "secret", value: "十年前曾到过案发现场" }),
      ]),
    );
    expect(protagonist).toMatchObject({
      appearance: "旧风衣、随身旧笔记本。",
      arcEnd: "愿意公开旧案证据并承担代价。",
      firstAppearance: "第 1 章",
      genderAge: "男，29 岁",
      importance: "core",
      narrativeFunction: "viewpoint",
      relationshipHook: "与周潜互相怀疑。",
      storyTask: "把旧信线索推进成主线调查。",
    });
    expect(relation).toMatchObject({
      relationType: "suspects",
      sourceEntityId: protagonist.id,
      targetEntityId: antagonist.id,
    });
    const updatedProtagonist = await characterService.updateCharacter({
      characterId: protagonist.id,
      patch: {
        need: "保护证人",
        secret: "",
        voiceProfile: "回答前会先观察对方反应。",
      },
      projectId: project.id,
    });
    expect(updatedProtagonist.traits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "need", value: "保护证人" }),
        expect.objectContaining({ name: "voice_profile", value: "回答前会先观察对方反应。" }),
      ]),
    );
    expect(updatedProtagonist.traits).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "secret" })]),
    );

    const projectDatabase = createProjectDatabase(join(project.rootPath, PROJECT_DATABASE_FILE));
    try {
      const eventTypes = projectDatabase.client
        .prepare("select event_type from domain_events order by created_at asc")
        .all()
        .map((row) => (row as { event_type: string }).event_type);

      expect(eventTypes).toEqual(
        expect.arrayContaining(["character.created", "entity_relation.confirmed"]),
      );
    } finally {
      projectDatabase.close();
    }
  });
});
