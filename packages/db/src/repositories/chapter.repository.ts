import type { ProjectDatabase } from "../project-database.js";

export interface ChapterRecord {
  readonly id: string;
  readonly projectId: string;
  readonly workId: string;
  readonly volumeId: string | null;
  readonly title: string;
  readonly status: string;
  readonly position: number;
  readonly synopsis: string | null;
  readonly content: string;
  readonly wordCount: number;
  readonly version: number;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface ChapterVersionRecord {
  readonly id: string;
  readonly projectId: string;
  readonly chapterId: string;
  readonly version: number;
  readonly source: string;
  readonly content: string;
  readonly summary: string | null;
  readonly createdAt: number;
}

export interface CreateChapterRecordInput {
  readonly chapterId: string;
  readonly projectId: string;
  readonly volumeId: string;
  readonly title: string;
  readonly summary?: string;
  readonly position?: number;
  readonly now?: number;
}

export interface SaveChapterContentInput {
  readonly projectId: string;
  readonly chapterId: string;
  readonly versionId: string;
  readonly content: string;
  readonly baseVersion: number;
  readonly nextVersion: number;
  readonly source: "user" | "ai_artifact" | "restore";
  readonly now?: number;
}

interface VolumeRow {
  readonly id: string;
  readonly work_id: string;
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

interface ChapterVersionRow {
  readonly id: string;
  readonly project_id: string;
  readonly chapter_id: string;
  readonly version: number;
  readonly source: string;
  readonly content: string;
  readonly summary: string | null;
  readonly created_at: number;
}

export class ChapterRepository {
  constructor(private readonly projectDatabase: ProjectDatabase) {}

  createChapter(input: CreateChapterRecordInput): ChapterRecord {
    const now = input.now ?? Date.now();
    const volume = this.projectDatabase.client
      .prepare("select id, work_id from volumes where project_id = ? and id = ?")
      .get(input.projectId, input.volumeId) as VolumeRow | undefined;

    if (!volume) {
      throw new Error(`VOLUME_NOT_FOUND: ${input.volumeId}`);
    }

    const position =
      input.position ??
      ((this.projectDatabase.client
        .prepare("select coalesce(max(position), 0) + 1 as next_position from chapters where volume_id = ?")
        .get(input.volumeId) as { next_position: number }).next_position);

    this.projectDatabase.client
      .prepare(`
        insert into chapters (
          id, project_id, work_id, volume_id, title, status, position, synopsis,
          content, word_count, version, created_at, updated_at
        )
        values (
          @chapterId, @projectId, @workId, @volumeId, @title, 'draft', @position, @summary,
          '', 0, 0, @now, @now
        )
      `)
      .run({
        chapterId: input.chapterId,
        projectId: input.projectId,
        volumeId: input.volumeId,
        workId: volume.work_id,
        title: input.title,
        summary: input.summary ?? null,
        position,
        now,
      });

    const chapter = this.getById(input.projectId, input.chapterId);
    if (!chapter) {
      throw new Error(`CHAPTER_NOT_CREATED: ${input.chapterId}`);
    }

    return chapter;
  }

  getById(projectId: string, chapterId: string): ChapterRecord | undefined {
    const row = this.projectDatabase.client
      .prepare("select * from chapters where project_id = ? and id = ?")
      .get(projectId, chapterId) as ChapterRow | undefined;

    return row ? mapChapterRow(row) : undefined;
  }

  listChapters(input: {
    readonly projectId: string;
    readonly volumeId?: string;
  }): ChapterRecord[] {
    if (input.volumeId) {
      return this.projectDatabase.client
        .prepare(
          `
          select * from chapters
          where project_id = ? and volume_id = ?
          order by position asc, created_at asc
          `,
        )
        .all(input.projectId, input.volumeId)
        .map((row) => mapChapterRow(row as ChapterRow));
    }

    return this.projectDatabase.client
      .prepare(
        `
        select * from chapters
        where project_id = ?
        order by position asc, created_at asc
        `,
      )
      .all(input.projectId)
      .map((row) => mapChapterRow(row as ChapterRow));
  }

  saveContent(input: SaveChapterContentInput): ChapterRecord {
    const save = this.projectDatabase.client.transaction(() => {
      const chapter = this.getById(input.projectId, input.chapterId);
      if (!chapter) {
        throw new Error(`CHAPTER_NOT_FOUND: ${input.chapterId}`);
      }
      if (chapter.version !== input.baseVersion) {
        throw new Error(`CHAPTER_VERSION_CONFLICT: expected ${input.baseVersion}, got ${chapter.version}`);
      }

      const now = input.now ?? Date.now();
      const wordCount = countWords(input.content);

      this.projectDatabase.client
        .prepare(`
          update chapters
          set content = @content, word_count = @wordCount, version = @nextVersion, updated_at = @now
          where project_id = @projectId and id = @chapterId
        `)
        .run({
          chapterId: input.chapterId,
          content: input.content,
          nextVersion: input.nextVersion,
          now,
          projectId: input.projectId,
          wordCount,
        });

      this.projectDatabase.client
        .prepare(`
          insert into chapter_versions (
            id, project_id, chapter_id, version, source, content, created_at
          )
          values (
            @versionId, @projectId, @chapterId, @nextVersion, @source, @content, @now
          )
        `)
        .run({
          chapterId: input.chapterId,
          content: input.content,
          nextVersion: input.nextVersion,
          now,
          projectId: input.projectId,
          source: input.source,
          versionId: input.versionId,
        });
    });

    save();

    const saved = this.getById(input.projectId, input.chapterId);
    if (!saved) {
      throw new Error(`CHAPTER_NOT_FOUND: ${input.chapterId}`);
    }

    return saved;
  }

  listVersions(projectId: string, chapterId: string): ChapterVersionRecord[] {
    return this.projectDatabase.client
      .prepare(
        "select * from chapter_versions where project_id = ? and chapter_id = ? order by version asc",
      )
      .all(projectId, chapterId)
      .map((row) => mapChapterVersionRow(row as ChapterVersionRow));
  }

  getVersionById(projectId: string, versionId: string): ChapterVersionRecord | undefined {
    const row = this.projectDatabase.client
      .prepare("select * from chapter_versions where project_id = ? and id = ?")
      .get(projectId, versionId) as ChapterVersionRow | undefined;

    return row ? mapChapterVersionRow(row) : undefined;
  }
}

function countWords(content: string): number {
  return Array.from(content.trim()).filter((char) => !/\s/u.test(char)).length;
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

function mapChapterVersionRow(row: ChapterVersionRow): ChapterVersionRecord {
  return {
    chapterId: row.chapter_id,
    content: row.content,
    createdAt: row.created_at,
    id: row.id,
    projectId: row.project_id,
    source: row.source,
    summary: row.summary,
    version: row.version,
  };
}
