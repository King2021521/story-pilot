import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createProjectDatabase, PROJECT_DATABASE_FILE, runProjectMigrations } from "../index.js";
import { ProjectRepository } from "./project.repository.js";
import { ReviewIssueRepository } from "./review-issue.repository.js";

describe("ReviewIssueRepository", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const tempDir of tempDirs.splice(0)) {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it("persists continuity issues with target, evidence, and status transitions", async () => {
    const projectDatabase = await createProjectDatabaseWithProject(tempDirs);
    try {
      const repository = new ReviewIssueRepository(projectDatabase);
      const [issue] = repository.createMany({
        issues: [
          {
            evidence: { quote: "已死亡人物继续行动" },
            issueId: "issue_1",
            issueType: "character_state",
            message: "角色状态与后续行动冲突。",
            projectId: "project_1",
            severity: "error",
            suggestedFix: { action: "增加复活代价或改角色" },
            targetId: "chapter_9",
            targetType: "chapter",
          },
        ],
        projectId: "project_1",
      });

      expect(issue).toMatchObject({
        id: "issue_1",
        issueType: "character_state",
        message: "角色状态与后续行动冲突。",
        projectId: "project_1",
        severity: "error",
        status: "open",
        targetId: "chapter_9",
        targetType: "chapter",
      });
      expect(issue?.evidence).toEqual({ quote: "已死亡人物继续行动" });
      expect(repository.listByProject({ projectId: "project_1" })).toHaveLength(1);
      expect(repository.listByProject({ projectId: "project_1", status: "resolved" })).toEqual([]);

      const resolved = repository.updateStatus({
        issueId: "issue_1",
        projectId: "project_1",
        status: "resolved",
      });

      expect(resolved).toMatchObject({
        id: "issue_1",
        status: "resolved",
      });
      expect(repository.listByProject({ projectId: "project_1", status: "open" })).toEqual([]);
    } finally {
      projectDatabase.close();
    }
  });
});

async function createProjectDatabaseWithProject(tempDirs: string[]) {
  const tempDir = mkdtempSync(join(tmpdir(), "story-pilot-review-issue-"));
  tempDirs.push(tempDir);
  const projectDatabase = createProjectDatabase(join(tempDir, PROJECT_DATABASE_FILE));
  await runProjectMigrations(projectDatabase);
  new ProjectRepository(projectDatabase).createProject({
    defaultVolumeId: "volume_1",
    genre: "玄幻",
    projectId: "project_1",
    rootPath: join(tempDir, "project_1"),
    title: "星潮纪",
    workId: "work_1",
  });

  return projectDatabase;
}
