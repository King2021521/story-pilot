import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createProjectDatabase, runProjectMigrations } from "../project-database.js";
import { CharacterRepository } from "./character.repository.js";
import { ProjectRepository } from "./project.repository.js";

describe("CharacterRepository", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const tempDir of tempDirs.splice(0)) {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it("stores character narrative profile fields and returns them from list/update", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "story-pilot-character-profile-"));
    tempDirs.push(tempDir);
    const projectDatabase = createProjectDatabase(join(tempDir, "project.sqlite"));

    try {
      await runProjectMigrations(projectDatabase);
      new ProjectRepository(projectDatabase).createProject({
        defaultVolumeId: "volume_1",
        genre: "悬疑",
        projectId: "project_1",
        rootPath: tempDir,
        title: "雾都案卷",
        workId: "work_1",
      });

      const repository = new CharacterRepository(projectDatabase);
      const created = repository.createCharacter({
        appearance: "旧风衣、随身旧笔记本，观察时会按住袖口。",
        arcEnd: "愿意公开旧案证据并承担代价。",
        arcStart: "逃避旧案，只想离开旧城。",
        arcTurn: "发现证人仍被追杀后决定回头。",
        archetype: "离队调查者",
        biography: "前刑警，因十年前钟楼案离队。",
        characterId: "character_1",
        firstAppearance: "第 1 章",
        genderAge: "女，27 岁",
        importance: "core",
        motivation: "查清旧信来源",
        name: "林鸢",
        narrativeFunction: "viewpoint",
        projectId: "project_1",
        relationshipHook: "与钟楼守档人互相试探。",
        role: "protagonist",
        storyTask: "把旧信线索推进成主线调查，并把被掩盖的旧案逼出来。",
        traits: [
          { traitId: "trait_need", name: "need", value: "重新学会信任他人" },
          { traitId: "trait_flaw", name: "flaw", value: "过度自责" },
          { traitId: "trait_secret", name: "secret", value: "十年前曾到过案发现场" },
          { traitId: "trait_voice", name: "voice_profile", value: "克制、短句、偏观察细节。" },
        ],
      });

      expect(created).toMatchObject({
        appearance: "旧风衣、随身旧笔记本，观察时会按住袖口。",
        arcEnd: "愿意公开旧案证据并承担代价。",
        arcStart: "逃避旧案，只想离开旧城。",
        arcTurn: "发现证人仍被追杀后决定回头。",
        firstAppearance: "第 1 章",
        genderAge: "女，27 岁",
        importance: "core",
        motivation: "查清旧信来源",
        narrativeFunction: "viewpoint",
        relationshipHook: "与钟楼守档人互相试探。",
        storyTask: "把旧信线索推进成主线调查，并把被掩盖的旧案逼出来。",
      });
      expect(repository.listCharacters("project_1")).toEqual([
        expect.objectContaining({
          id: "character_1",
          narrativeFunction: "viewpoint",
          storyTask: "把旧信线索推进成主线调查，并把被掩盖的旧案逼出来。",
        }),
      ]);

      const updated = repository.updateCharacter({
        arcEnd: "从逃避旧案的人，变成愿意公开档案的人。",
        characterId: "character_1",
        projectId: "project_1",
        storyTask: "保护证人并揭开档案伪造链条。",
        traits: [
          { traitId: "trait_need_updated", name: "need", value: "保护证人" },
          { traitId: "trait_secret_removed", name: "secret", value: "" },
        ],
      });

      expect(updated).toMatchObject({
        arcEnd: "从逃避旧案的人，变成愿意公开档案的人。",
        storyTask: "保护证人并揭开档案伪造链条。",
      });
      expect(updated.traits).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: "need", value: "保护证人" })]),
      );
      expect(updated.traits).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ name: "secret" })]),
      );
    } finally {
      projectDatabase.close();
    }
  });
});
