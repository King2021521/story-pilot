import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Test } from "@nestjs/testing";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CharacterModule } from "../character/character.module.js";
import { CharacterService } from "../character/character.service.js";
import { ProjectModule } from "../project/project.module.js";
import { ProjectService } from "../project/project.service.js";
import { PlotModule } from "./plot.module.js";
import { StoryEventService } from "./story-event.service.js";

describe("StoryEventService", () => {
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

  it("creates story events with participants", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "story-pilot-events-"));
    tempDirs.push(rootDir);
    process.env.STORY_PILOT_PROJECTS_ROOT = rootDir;

    const moduleRef = await Test.createTestingModule({
      imports: [ProjectModule, CharacterModule, PlotModule],
    }).compile();
    const projectService = moduleRef.get(ProjectService);
    const characterService = moduleRef.get(CharacterService);
    const storyEventService = moduleRef.get(StoryEventService);

    const project = await projectService.createProject({ title: "长夜序章", genre: "悬疑" });
    const character = await characterService.createCharacter({
      projectId: project.id,
      name: "林澈",
      role: "protagonist",
    });
    const event = await storyEventService.createStoryEvent({
      projectId: project.id,
      title: "雨夜来信",
      description: "林澈收到来自旧案现场的匿名信。",
      eventType: "discovery",
      participants: [
        {
          entityType: "character",
          entityId: character.id,
          role: "discoverer",
        },
      ],
    });

    expect(event.participants).toEqual([
      expect.objectContaining({
        entityId: character.id,
        entityType: "character",
        role: "discoverer",
      }),
    ]);
  });
});
