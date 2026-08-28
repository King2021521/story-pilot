import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Test } from "@nestjs/testing";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ProjectModule } from "../project/project.module.js";
import { ProjectService } from "../project/project.service.js";
import { PlotModule } from "./plot.module.js";
import { PlotlineService } from "./plotline.service.js";

describe("PlotlineService", () => {
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

  it("creates plotlines for organizing story threads", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "story-pilot-plotlines-"));
    tempDirs.push(rootDir);
    process.env.STORY_PILOT_PROJECTS_ROOT = rootDir;

    const moduleRef = await Test.createTestingModule({
      imports: [ProjectModule, PlotModule],
    }).compile();
    const projectService = moduleRef.get(ProjectService);
    const plotlineService = moduleRef.get(PlotlineService);

    const project = await projectService.createProject({ title: "长夜序章", genre: "悬疑" });
    const plotline = await plotlineService.createPlotline({
      projectId: project.id,
      title: "旧案主线",
      kind: "main",
      summary: "围绕十年前火灾旧案展开。",
      priority: 10,
    });

    expect(plotline).toMatchObject({
      name: "旧案主线",
      priority: 10,
      status: "planning",
      type: "main",
    });
  });
});
