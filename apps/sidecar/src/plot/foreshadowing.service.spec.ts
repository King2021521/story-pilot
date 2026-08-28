import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Test } from "@nestjs/testing";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ProjectModule } from "../project/project.module.js";
import { ProjectService } from "../project/project.service.js";
import { ForeshadowingService } from "./foreshadowing.service.js";
import { PlotModule } from "./plot.module.js";
import { StoryEventService } from "./story-event.service.js";

describe("ForeshadowingService", () => {
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

  it("links foreshadowing seeds and payoffs to story events", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "story-pilot-foreshadowings-"));
    tempDirs.push(rootDir);
    process.env.STORY_PILOT_PROJECTS_ROOT = rootDir;

    const moduleRef = await Test.createTestingModule({
      imports: [ProjectModule, PlotModule],
    }).compile();
    const projectService = moduleRef.get(ProjectService);
    const storyEventService = moduleRef.get(StoryEventService);
    const foreshadowingService = moduleRef.get(ForeshadowingService);

    const project = await projectService.createProject({ title: "长夜序章", genre: "悬疑" });
    const seedEvent = await storyEventService.createStoryEvent({
      projectId: project.id,
      title: "旧报纸日期",
      description: "门缝下的旧报纸露出十年前的日期。",
      eventType: "discovery",
    });
    const payoffEvent = await storyEventService.createStoryEvent({
      projectId: project.id,
      title: "火灾真相",
      description: "旧报纸日期对应伪造火灾报告的当天。",
      eventType: "reveal",
    });

    const foreshadowing = await foreshadowingService.createForeshadowing({
      projectId: project.id,
      title: "旧报纸日期",
      description: "用报纸日期埋下旧案时间线矛盾。",
      payoffExpectation: "揭示十年前的火灾不是事故。",
      seedEventId: seedEvent.id,
      payoffEventId: payoffEvent.id,
    });

    expect(foreshadowing.links).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ eventId: seedEvent.id, role: "seed" }),
        expect.objectContaining({ eventId: payoffEvent.id, role: "payoff" }),
      ]),
    );
  });
});
