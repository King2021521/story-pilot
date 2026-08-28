import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  createSyntheticLongformProject,
  verifySyntheticLongformProject,
} from "./longform-synthetic.js";

describe("synthetic longform verification", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const tempDir of tempDirs.splice(0)) {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it("creates deterministic longform data and verifies count and query budgets", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "story-pilot-synthetic-longform-"));
    tempDirs.push(rootDir);

    const syntheticProject = await createSyntheticLongformProject({
      chapterCount: 12,
      eventCount: 30,
      foreshadowingCount: 8,
      issueCount: 5,
      memoryCount: 40,
      rootDir,
      seed: "unit",
    });
    const report = await verifySyntheticLongformProject({
      budgets: {
        chapterListMs: 500,
        memorySearchMs: 500,
        openProjectMs: 500,
        reviewIssueQueryMs: 500,
      },
      databasePath: syntheticProject.databasePath,
      expected: {
        chapterCount: 12,
        eventCount: 30,
        foreshadowingCount: 8,
        issueCount: 5,
        memoryCount: 40,
      },
    });

    expect(report.ok).toBe(true);
    expect(report.counts).toEqual({
      chapters: 12,
      foreshadowings: 8,
      memories: 40,
      reviewIssues: 5,
      storyEvents: 30,
    });
    expect(report.projectId).toBe(syntheticProject.projectId);
    expect(report.timings.every((timing) => timing.ok)).toBe(true);
  });
});
