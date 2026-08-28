import type { ProjectDatabase } from "../project-database.js";
import type { ChapterRecord } from "./chapter.repository.js";

export interface OutlineRecord {
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  readonly scope: string;
  readonly basis: Record<string, unknown>;
  readonly status: string;
  readonly version: number;
  readonly sourceArtifactId: string | null;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface VolumeOutlineRecord {
  readonly id: string;
  readonly outlineId: string;
  readonly volumeId: string | null;
  readonly title: string;
  readonly purpose: string;
  readonly majorConflict: string | null;
  readonly climax: string | null;
  readonly wordCountGoal: number | null;
  readonly sortOrder: number;
  readonly status: string;
}

export interface ChapterOutlineRecord {
  readonly id: string;
  readonly projectId: string;
  readonly outlineId: string;
  readonly volumeOutlineId: string | null;
  readonly chapterId: string | null;
  readonly title: string;
  readonly chapterGoal: string;
  readonly conflict: string | null;
  readonly informationGain: string | null;
  readonly emotionalTurn: string | null;
  readonly hook: string | null;
  readonly requiredCharacterIds: readonly string[];
  readonly requiredLocationIds: readonly string[];
  readonly relatedPlotlineNodeIds: readonly string[];
  readonly relatedForeshadowingIds: readonly string[];
  readonly targetWordCount: number | null;
  readonly sortOrder: number;
  readonly status: string;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface CreateOutlineWithChaptersInput {
  readonly outlineId: string;
  readonly volumeOutlineId: string;
  readonly projectId: string;
  readonly title: string;
  readonly scope: string;
  readonly basis?: Record<string, unknown>;
  readonly sourceArtifactId?: string;
  readonly chapters: readonly CreateChapterOutlineItem[];
  readonly now?: number;
}

export interface CreateChapterOutlineItem {
  readonly chapterOutlineId: string;
  readonly title: string;
  readonly chapterGoal: string;
  readonly conflict?: string;
  readonly informationGain?: string;
  readonly emotionalTurn?: string;
  readonly hook?: string;
  readonly targetWordCount?: number;
  readonly sortOrder: number;
}

export interface CreateOutlineWithChaptersResult {
  readonly outline: OutlineRecord;
  readonly volumeOutline: VolumeOutlineRecord;
  readonly chapterOutlines: readonly ChapterOutlineRecord[];
}

export interface ApplyChapterOutlineInput {
  readonly projectId: string;
  readonly chapterOutlineId: string;
  readonly chapterId: string;
  readonly now?: number;
}

export interface ApplyChapterOutlineResult {
  readonly chapter: ChapterRecord;
  readonly chapterOutline: ChapterOutlineRecord;
}

interface OutlineRow {
  readonly id: string;
  readonly project_id: string;
  readonly title: string;
  readonly scope: string;
  readonly basis_json: string;
  readonly status: string;
  readonly version: number;
  readonly source_artifact_id: string | null;
  readonly created_at: number;
  readonly updated_at: number;
}

interface VolumeOutlineRow {
  readonly id: string;
  readonly outline_id: string;
  readonly volume_id: string | null;
  readonly title: string;
  readonly purpose: string;
  readonly major_conflict: string | null;
  readonly climax: string | null;
  readonly word_count_goal: number | null;
  readonly sort_order: number;
  readonly status: string;
}

interface ChapterOutlineRow {
  readonly id: string;
  readonly project_id: string;
  readonly outline_id: string;
  readonly volume_outline_id: string | null;
  readonly chapter_id: string | null;
  readonly title: string;
  readonly chapter_goal: string;
  readonly conflict: string | null;
  readonly information_gain: string | null;
  readonly emotional_turn: string | null;
  readonly hook: string | null;
  readonly required_character_ids_json: string;
  readonly required_location_ids_json: string;
  readonly related_plotline_node_ids_json: string;
  readonly related_foreshadowing_ids_json: string;
  readonly target_word_count: number | null;
  readonly sort_order: number;
  readonly status: string;
  readonly created_at: number;
  readonly updated_at: number;
}

interface DefaultProjectStructureRow {
  readonly work_id: string;
  readonly volume_id: string;
}

interface ChapterRow {
  readonly id: string;
  readonly project_id: string;
  readonly work_id: string;
  readonly volume_id: string | null;
  readonly title: string;
  readonly status: string;
  readonly position: number;
  readonly synopsis: string | null;
  readonly content: string;
  readonly word_count: number;
  readonly version: number;
  readonly created_at: number;
  readonly updated_at: number;
}

export class OutlineRepository {
  constructor(private readonly projectDatabase: ProjectDatabase) {}

  createOutlineWithChapters(
    input: CreateOutlineWithChaptersInput,
  ): CreateOutlineWithChaptersResult {
    const now = input.now ?? Date.now();
    const create = this.projectDatabase.client.transaction(() => {
      this.projectDatabase.client
        .prepare(
          `
          insert into outlines (
            id, project_id, title, scope, basis_json, status, version,
            source_artifact_id, created_at, updated_at
          )
          values (
            @outlineId, @projectId, @title, @scope, @basisJson, 'draft', 1,
            @sourceArtifactId, @now, @now
          )
        `,
        )
        .run({
          basisJson: JSON.stringify(input.basis ?? {}),
          outlineId: input.outlineId,
          projectId: input.projectId,
          scope: input.scope,
          sourceArtifactId: input.sourceArtifactId ?? null,
          title: input.title,
          now,
        });

      this.projectDatabase.client
        .prepare(
          `
          insert into volume_outlines (
            id, outline_id, title, purpose, major_conflict, climax,
            sort_order, status, created_at, updated_at
          )
          values (
            @volumeOutlineId, @outlineId, @title, @purpose, @majorConflict,
            @climax, 1, 'draft', @now, @now
          )
        `,
        )
        .run({
          climax: "完成第一轮高潮或关键反转。",
          majorConflict: "围绕主冲突完成首轮升级。",
          outlineId: input.outlineId,
          purpose: "承接创作蓝图，把剧情弧线落到可执行章节。",
          title: "第一卷",
          volumeOutlineId: input.volumeOutlineId,
          now,
        });

      const insertChapterOutline = this.projectDatabase.client.prepare(`
        insert into chapter_outlines (
          id, project_id, outline_id, volume_outline_id, title, chapter_goal,
          conflict, information_gain, emotional_turn, hook, target_word_count,
          sort_order, status, created_at, updated_at
        )
        values (
          @chapterOutlineId, @projectId, @outlineId, @volumeOutlineId, @title, @chapterGoal,
          @conflict, @informationGain, @emotionalTurn, @hook, @targetWordCount,
          @sortOrder, 'draft', @now, @now
        )
      `);

      for (const chapter of input.chapters) {
        insertChapterOutline.run({
          chapterGoal: chapter.chapterGoal,
          chapterOutlineId: chapter.chapterOutlineId,
          conflict: chapter.conflict ?? null,
          emotionalTurn: chapter.emotionalTurn ?? null,
          hook: chapter.hook ?? null,
          informationGain: chapter.informationGain ?? null,
          outlineId: input.outlineId,
          projectId: input.projectId,
          sortOrder: chapter.sortOrder,
          targetWordCount: chapter.targetWordCount ?? null,
          title: chapter.title,
          volumeOutlineId: input.volumeOutlineId,
          now,
        });
      }
    });

    create();

    const outline = this.getOutline(input.projectId, input.outlineId);
    const volumeOutline = this.getVolumeOutline(input.volumeOutlineId);
    if (!outline || !volumeOutline) {
      throw new Error(`OUTLINE_NOT_CREATED: ${input.outlineId}`);
    }

    return {
      chapterOutlines: this.listChapterOutlines(input.projectId, input.outlineId),
      outline,
      volumeOutline,
    };
  }

  listOutlines(projectId: string): OutlineRecord[] {
    return this.projectDatabase.client
      .prepare(
        "select * from outlines where project_id = ? order by updated_at desc, created_at desc",
      )
      .all(projectId)
      .map((row) => mapOutlineRow(row as OutlineRow));
  }

  listChapterOutlines(projectId: string, outlineId?: string): ChapterOutlineRecord[] {
    if (outlineId) {
      return this.projectDatabase.client
        .prepare(
          "select * from chapter_outlines where project_id = ? and outline_id = ? order by sort_order asc, created_at asc",
        )
        .all(projectId, outlineId)
        .map((row) => mapChapterOutlineRow(row as ChapterOutlineRow));
    }

    return this.projectDatabase.client
      .prepare(
        "select * from chapter_outlines where project_id = ? order by sort_order asc, created_at asc",
      )
      .all(projectId)
      .map((row) => mapChapterOutlineRow(row as ChapterOutlineRow));
  }

  getChapterOutline(projectId: string, chapterOutlineId: string): ChapterOutlineRecord | null {
    const row = this.projectDatabase.client
      .prepare("select * from chapter_outlines where project_id = ? and id = ?")
      .get(projectId, chapterOutlineId) as ChapterOutlineRow | undefined;

    return row ? mapChapterOutlineRow(row) : null;
  }

  approveChapterOutline(
    projectId: string,
    chapterOutlineId: string,
    now = Date.now(),
  ): ChapterOutlineRecord {
    this.projectDatabase.client
      .prepare(
        `
        update chapter_outlines
        set status = 'approved', updated_at = ?
        where project_id = ? and id = ?
      `,
      )
      .run(now, projectId, chapterOutlineId);

    const chapterOutline = this.getChapterOutline(projectId, chapterOutlineId);
    if (!chapterOutline || chapterOutline.status !== "approved") {
      throw new Error(`CHAPTER_OUTLINE_NOT_FOUND: ${chapterOutlineId}`);
    }

    return chapterOutline;
  }

  applyChapterOutline(input: ApplyChapterOutlineInput): ApplyChapterOutlineResult {
    const now = input.now ?? Date.now();
    const apply = this.projectDatabase.client.transaction(() => {
      const chapterOutline = this.getChapterOutline(input.projectId, input.chapterOutlineId);
      if (!chapterOutline) {
        throw new Error(`CHAPTER_OUTLINE_NOT_FOUND: ${input.chapterOutlineId}`);
      }
      if (chapterOutline.status !== "approved" && chapterOutline.status !== "applied") {
        throw new Error(`CHAPTER_OUTLINE_NOT_APPROVED: ${input.chapterOutlineId}`);
      }

      let chapterId = chapterOutline.chapterId;
      if (!chapterId) {
        chapterId = input.chapterId;
        const structure = this.getDefaultProjectStructure(input.projectId);
        const position = this.getNextChapterPosition(structure.volume_id);
        this.projectDatabase.client
          .prepare(
            `
            insert into chapters (
              id, project_id, work_id, volume_id, title, status, position, synopsis,
              content, word_count, version, created_at, updated_at
            )
            values (
              @chapterId, @projectId, @workId, @volumeId, @title, 'draft', @position, @synopsis,
              '', 0, 0, @now, @now
            )
          `,
          )
          .run({
            chapterId,
            now,
            position,
            projectId: input.projectId,
            synopsis: chapterOutline.chapterGoal,
            title: chapterOutline.title,
            volumeId: structure.volume_id,
            workId: structure.work_id,
          });
      }

      this.projectDatabase.client
        .prepare(
          `
          update chapter_outlines
          set chapter_id = @chapterId, status = 'applied', updated_at = @now
          where project_id = @projectId and id = @chapterOutlineId
        `,
        )
        .run({
          chapterId,
          chapterOutlineId: input.chapterOutlineId,
          now,
          projectId: input.projectId,
        });
    });

    apply();

    const chapterOutline = this.getChapterOutline(input.projectId, input.chapterOutlineId);
    if (!chapterOutline?.chapterId) {
      throw new Error(`CHAPTER_OUTLINE_NOT_APPLIED: ${input.chapterOutlineId}`);
    }

    const chapter = this.getChapter(input.projectId, chapterOutline.chapterId);
    if (!chapter) {
      throw new Error(`CHAPTER_NOT_CREATED_FROM_OUTLINE: ${input.chapterOutlineId}`);
    }

    return { chapter, chapterOutline };
  }

  private getOutline(projectId: string, outlineId: string): OutlineRecord | null {
    const row = this.projectDatabase.client
      .prepare("select * from outlines where project_id = ? and id = ?")
      .get(projectId, outlineId) as OutlineRow | undefined;

    return row ? mapOutlineRow(row) : null;
  }

  private getVolumeOutline(volumeOutlineId: string): VolumeOutlineRecord | null {
    const row = this.projectDatabase.client
      .prepare("select * from volume_outlines where id = ?")
      .get(volumeOutlineId) as VolumeOutlineRow | undefined;

    return row ? mapVolumeOutlineRow(row) : null;
  }

  private getDefaultProjectStructure(projectId: string): DefaultProjectStructureRow {
    const row = this.projectDatabase.client
      .prepare(
        `
        select w.id as work_id, v.id as volume_id
        from works w
        join volumes v on v.work_id = w.id
        where w.project_id = ?
        order by w.created_at asc, v.position asc
        limit 1
      `,
      )
      .get(projectId) as DefaultProjectStructureRow | undefined;

    if (!row) {
      throw new Error(`PROJECT_STRUCTURE_NOT_FOUND: ${projectId}`);
    }

    return row;
  }

  private getNextChapterPosition(volumeId: string): number {
    return (
      this.projectDatabase.client
        .prepare(
          "select coalesce(max(position), 0) + 1 as next_position from chapters where volume_id = ?",
        )
        .get(volumeId) as { next_position: number }
    ).next_position;
  }

  private getChapter(projectId: string, chapterId: string): ChapterRecord | null {
    const row = this.projectDatabase.client
      .prepare("select * from chapters where project_id = ? and id = ?")
      .get(projectId, chapterId) as ChapterRow | undefined;

    return row ? mapChapterRow(row) : null;
  }
}

function mapOutlineRow(row: OutlineRow): OutlineRecord {
  return {
    basis: parseJsonRecord(row.basis_json),
    createdAt: row.created_at,
    id: row.id,
    projectId: row.project_id,
    scope: row.scope,
    sourceArtifactId: row.source_artifact_id,
    status: row.status,
    title: row.title,
    updatedAt: row.updated_at,
    version: row.version,
  };
}

function mapVolumeOutlineRow(row: VolumeOutlineRow): VolumeOutlineRecord {
  return {
    climax: row.climax,
    id: row.id,
    majorConflict: row.major_conflict,
    outlineId: row.outline_id,
    purpose: row.purpose,
    sortOrder: row.sort_order,
    status: row.status,
    title: row.title,
    volumeId: row.volume_id,
    wordCountGoal: row.word_count_goal,
  };
}

function mapChapterOutlineRow(row: ChapterOutlineRow): ChapterOutlineRecord {
  return {
    chapterGoal: row.chapter_goal,
    chapterId: row.chapter_id,
    conflict: row.conflict,
    createdAt: row.created_at,
    emotionalTurn: row.emotional_turn,
    hook: row.hook,
    id: row.id,
    informationGain: row.information_gain,
    outlineId: row.outline_id,
    projectId: row.project_id,
    relatedForeshadowingIds: parseJsonArray(row.related_foreshadowing_ids_json),
    relatedPlotlineNodeIds: parseJsonArray(row.related_plotline_node_ids_json),
    requiredCharacterIds: parseJsonArray(row.required_character_ids_json),
    requiredLocationIds: parseJsonArray(row.required_location_ids_json),
    sortOrder: row.sort_order,
    status: row.status,
    targetWordCount: row.target_word_count,
    title: row.title,
    updatedAt: row.updated_at,
    volumeOutlineId: row.volume_outline_id,
  };
}

function mapChapterRow(row: ChapterRow): ChapterRecord {
  return {
    content: row.content,
    createdAt: row.created_at,
    id: row.id,
    position: row.position,
    projectId: row.project_id,
    status: row.status,
    synopsis: row.synopsis,
    title: row.title,
    updatedAt: row.updated_at,
    version: row.version,
    volumeId: row.volume_id,
    wordCount: row.word_count,
    workId: row.work_id,
  };
}

function parseJsonArray(value: string): readonly string[] {
  const parsed: unknown = JSON.parse(value || "[]");
  return Array.isArray(parsed)
    ? parsed.filter((item): item is string => typeof item === "string")
    : [];
}

function parseJsonRecord(value: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(value || "{}");
  return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : {};
}
