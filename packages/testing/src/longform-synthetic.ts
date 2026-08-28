import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";

import {
  createProjectDatabase,
  PROJECT_DATABASE_FILE,
  ProjectRepository,
  runProjectMigrations,
} from "@story-pilot/db";

export interface SyntheticLongformOptions {
  readonly rootDir?: string;
  readonly seed?: string;
  readonly chapterCount?: number;
  readonly memoryCount?: number;
  readonly eventCount?: number;
  readonly foreshadowingCount?: number;
  readonly issueCount?: number;
}

export interface SyntheticLongformProject {
  readonly projectId: string;
  readonly rootDir: string;
  readonly databasePath: string;
}

export interface LongformVerificationExpectedCounts {
  readonly chapterCount: number;
  readonly memoryCount: number;
  readonly eventCount: number;
  readonly foreshadowingCount: number;
  readonly issueCount: number;
}

export interface LongformVerificationBudgets {
  readonly openProjectMs: number;
  readonly chapterListMs: number;
  readonly memorySearchMs: number;
  readonly reviewIssueQueryMs: number;
}

export interface LongformVerificationTiming {
  readonly name: string;
  readonly elapsedMs: number;
  readonly budgetMs: number;
  readonly ok: boolean;
}

export interface LongformVerificationReport {
  readonly ok: boolean;
  readonly projectId: string;
  readonly databasePath: string;
  readonly counts: {
    readonly chapters: number;
    readonly memories: number;
    readonly storyEvents: number;
    readonly foreshadowings: number;
    readonly reviewIssues: number;
  };
  readonly timings: readonly LongformVerificationTiming[];
  readonly failures: readonly string[];
}

const DEFAULT_COUNTS: LongformVerificationExpectedCounts = {
  chapterCount: 1_000,
  eventCount: 5_000,
  foreshadowingCount: 800,
  issueCount: 50,
  memoryCount: 10_000,
};

const DEFAULT_BUDGETS: LongformVerificationBudgets = {
  chapterListMs: 1_000,
  memorySearchMs: 800,
  openProjectMs: 5_000,
  reviewIssueQueryMs: 800,
};

export async function createSyntheticLongformProject(
  input: SyntheticLongformOptions = {},
): Promise<SyntheticLongformProject> {
  const counts = resolveCounts(input);
  const seed = normalizeSeed(input.seed ?? "default");
  const projectId = `synthetic_${seed}`;
  const rootDir = input.rootDir ?? join(tmpdir(), `story-pilot-longform-${Date.now()}`);
  const projectRoot = join(rootDir, projectId);
  mkdirSync(projectRoot, { recursive: true });
  const databasePath = join(projectRoot, PROJECT_DATABASE_FILE);
  const projectDatabase = createProjectDatabase(databasePath);

  try {
    await runProjectMigrations(projectDatabase);
    const projectRepository = new ProjectRepository(projectDatabase);
    const project = projectRepository.createProject({
      defaultVolumeId: `volume_${seed}`,
      genre: "玄幻",
      projectId,
      rootPath: projectRoot,
      title: "Synthetic Longform",
      workId: `work_${seed}`,
    });
    const now = Date.now();
    const insertChapter = projectDatabase.client.prepare(
      `
      insert into chapters (
        id, project_id, work_id, volume_id, title, status, position, synopsis,
        content, word_count, version, created_at, updated_at
      )
      values (?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, 1, ?, ?)
      `,
    );
    const insertMemory = projectDatabase.client.prepare(
      `
      insert into memories (
        id, project_id, entity_type, entity_id, kind, content, scope,
        valid_from_chapter_index, valid_to_chapter_index, source_type, source_id,
        source_quote, evidence_json, source_candidate_id, confidence, status,
        supersedes_memory_id, contradiction_group_id, embedding_ref, created_at, updated_at
      )
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, null, ?, ?, null, ?, null, ?, ?)
      `,
    );
    const insertEvent = projectDatabase.client.prepare(
      `
      insert into story_events (
        id, project_id, title, event_type, event_time, position, summary,
        causal_importance, chapter_id, scene_id, status, created_at, updated_at
      )
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, null, 'canon', ?, ?)
      `,
    );
    const insertForeshadowing = projectDatabase.client.prepare(
      `
      insert into foreshadowings (
        id, project_id, title, status, seed_text, payoff_text, created_at, updated_at
      )
      values (?, ?, ?, ?, ?, ?, ?, ?)
      `,
    );
    const insertReviewIssue = projectDatabase.client.prepare(
      `
      insert into review_issues (
        id, project_id, target_type, target_id, issue_type, severity, message,
        evidence_json, suggested_fix_json, status, created_at, updated_at
      )
      values (?, ?, 'chapter', ?, ?, ?, ?, ?, ?, 'open', ?, ?)
      `,
    );

    const populate = projectDatabase.client.transaction(() => {
      for (let index = 1; index <= counts.chapterCount; index += 1) {
        insertChapter.run(
          `chapter_${seed}_${index}`,
          project.id,
          project.workId,
          project.defaultVolumeId,
          `第 ${index} 章 Synthetic Chapter`,
          index,
          `第 ${index} 章摘要，包含人物状态、事件推进和伏笔状态。`,
          `第 ${index} 章正文片段。主角推进第 ${index} 个目标。`,
          2_000,
          now + index,
          now + index,
        );
      }

      for (let index = 1; index <= counts.eventCount; index += 1) {
        const chapterIndex = wrapIndex(index, counts.chapterCount);
        insertEvent.run(
          `event_${seed}_${index}`,
          project.id,
          `Synthetic Event ${index}`,
          index % 5 === 0 ? "reveal" : "conflict",
          `day-${index}`,
          index,
          `第 ${chapterIndex} 章发生的事件 ${index}，影响后续因果链。`,
          0.5,
          `chapter_${seed}_${chapterIndex}`,
          now + index,
          now + index,
        );
      }

      for (let index = 1; index <= counts.foreshadowingCount; index += 1) {
        insertForeshadowing.run(
          `foreshadowing_${seed}_${index}`,
          project.id,
          `Synthetic Foreshadowing ${index}`,
          index % 4 === 0 ? "reinforced" : "seeded",
          `第 ${wrapIndex(index, counts.chapterCount)} 章埋下伏笔 ${index}`,
          index % 4 === 0 ? `第 ${wrapIndex(index + 80, counts.chapterCount)} 章回收` : null,
          now + index,
          now + index,
        );
      }

      for (let index = 1; index <= counts.memoryCount; index += 1) {
        const chapterIndex = wrapIndex(index, counts.chapterCount);
        insertMemory.run(
          `memory_${seed}_${index}`,
          project.id,
          index % 3 === 0 ? "world_rule" : "character",
          `entity_${wrapIndex(index, 300)}`,
          index % 3 === 0 ? "rule" : "state",
          `Synthetic 记忆 ${index}：第 ${chapterIndex} 章后的长期事实。`,
          index % 2 === 0 ? "chapter" : "project",
          chapterIndex,
          null,
          "chapter",
          `chapter_${seed}_${chapterIndex}`,
          `第 ${chapterIndex} 章证据片段`,
          JSON.stringify({ chapterIndex, seed }),
          0.8,
          index % 11 === 0 ? "hypothesis" : "canon",
          index % 97 === 0 ? `contradiction_${Math.floor(index / 97)}` : null,
          now + index,
          now + index,
        );
      }

      for (let index = 1; index <= counts.issueCount; index += 1) {
        const chapterIndex = wrapIndex(index * 7, counts.chapterCount);
        insertReviewIssue.run(
          `issue_${seed}_${index}`,
          project.id,
          `chapter_${seed}_${chapterIndex}`,
          index % 3 === 0 ? "foreshadowing" : "character_state",
          index % 2 === 0 ? "warning" : "error",
          `Synthetic continuity issue ${index}`,
          JSON.stringify({ chapterIndex, evidence: "synthetic seeded contradiction" }),
          JSON.stringify({ suggestion: "修复人物状态或调整伏笔顺序" }),
          now + index,
          now + index,
        );
      }
    });

    populate();

    return {
      databasePath,
      projectId: project.id,
      rootDir: projectRoot,
    };
  } finally {
    projectDatabase.close();
  }
}

export async function verifySyntheticLongformProject(input: {
  readonly databasePath: string;
  readonly expected?: Partial<LongformVerificationExpectedCounts>;
  readonly budgets?: Partial<LongformVerificationBudgets>;
}): Promise<LongformVerificationReport> {
  const expected = { ...DEFAULT_COUNTS, ...input.expected };
  const budgets = { ...DEFAULT_BUDGETS, ...input.budgets };
  const failures: string[] = [];
  const openTiming = await measure("open_project", budgets.openProjectMs, async () => {
    const database = createProjectDatabase(input.databasePath);
    database.close();
  });
  const database = createProjectDatabase(input.databasePath);

  try {
    const project = database.client
      .prepare("select id from projects order by created_at asc limit 1")
      .get() as { id: string } | undefined;
    if (!project) {
      throw new Error("SYNTHETIC_PROJECT_NOT_FOUND");
    }

    const chapterTiming = await measure("chapter_list", budgets.chapterListMs, async () => {
      database.client
        .prepare("select id, title from chapters where project_id = ? order by position asc")
        .all(project.id);
    });
    const memoryTiming = await measure("memory_search", budgets.memorySearchMs, async () => {
      database.client
        .prepare(
          "select id, content from memories where project_id = ? and status = 'canon' and content like ? limit 50",
        )
        .all(project.id, "%长期事实%");
    });
    const reviewIssueTiming = await measure(
      "review_issue_query",
      budgets.reviewIssueQueryMs,
      async () => {
        database.client
          .prepare(
            "select id, severity from review_issues where project_id = ? and status = 'open'",
          )
          .all(project.id);
      },
    );
    const counts = {
      chapters: countRows(database, "chapters", project.id),
      foreshadowings: countRows(database, "foreshadowings", project.id),
      memories: countRows(database, "memories", project.id),
      reviewIssues: countRows(database, "review_issues", project.id),
      storyEvents: countRows(database, "story_events", project.id),
    };

    if (counts.chapters !== expected.chapterCount) {
      failures.push(`chapters expected ${expected.chapterCount}, got ${counts.chapters}`);
    }
    if (counts.memories !== expected.memoryCount) {
      failures.push(`memories expected ${expected.memoryCount}, got ${counts.memories}`);
    }
    if (counts.storyEvents !== expected.eventCount) {
      failures.push(`story events expected ${expected.eventCount}, got ${counts.storyEvents}`);
    }
    if (counts.foreshadowings !== expected.foreshadowingCount) {
      failures.push(
        `foreshadowings expected ${expected.foreshadowingCount}, got ${counts.foreshadowings}`,
      );
    }
    if (counts.reviewIssues !== expected.issueCount) {
      failures.push(`issues expected ${expected.issueCount}, got ${counts.reviewIssues}`);
    }

    const timings = [openTiming, chapterTiming, memoryTiming, reviewIssueTiming];
    failures.push(
      ...timings
        .filter((timing) => !timing.ok)
        .map(
          (timing) =>
            `${timing.name} exceeded budget: ${timing.elapsedMs.toFixed(1)}ms > ${timing.budgetMs}ms`,
        ),
    );

    return {
      counts,
      databasePath: input.databasePath,
      failures,
      ok: failures.length === 0,
      projectId: project.id,
      timings,
    };
  } finally {
    database.close();
  }
}

function resolveCounts(input: SyntheticLongformOptions): LongformVerificationExpectedCounts {
  return {
    chapterCount: input.chapterCount ?? DEFAULT_COUNTS.chapterCount,
    eventCount: input.eventCount ?? DEFAULT_COUNTS.eventCount,
    foreshadowingCount: input.foreshadowingCount ?? DEFAULT_COUNTS.foreshadowingCount,
    issueCount: input.issueCount ?? DEFAULT_COUNTS.issueCount,
    memoryCount: input.memoryCount ?? DEFAULT_COUNTS.memoryCount,
  };
}

function wrapIndex(index: number, count: number): number {
  return ((index - 1) % count) + 1;
}

function normalizeSeed(seed: string): string {
  return seed.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 48) || "default";
}

async function measure(
  name: string,
  budgetMs: number,
  operation: () => void | Promise<void>,
): Promise<LongformVerificationTiming> {
  const start = performance.now();
  await operation();
  const elapsedMs = performance.now() - start;

  return {
    budgetMs,
    elapsedMs,
    name,
    ok: elapsedMs <= budgetMs,
  };
}

function countRows(
  database: ReturnType<typeof createProjectDatabase>,
  table: string,
  projectId: string,
): number {
  return (
    database.client
      .prepare(`select count(*) as count from ${table} where project_id = ?`)
      .get(projectId) as { count: number }
  ).count;
}
