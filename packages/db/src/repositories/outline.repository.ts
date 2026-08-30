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

export interface SceneOutlineRecord {
  readonly id: string;
  readonly chapterOutlineId: string;
  readonly sceneId: string | null;
  readonly title: string;
  readonly purpose: string;
  readonly beatType: string;
  readonly povCharacterId: string | null;
  readonly locationId: string | null;
  readonly conflict: string | null;
  readonly entryState: string | null;
  readonly exitState: string | null;
  readonly sortOrder: number;
  readonly status: string;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface SaveOutlineDraftInput {
  readonly outlineId: string;
  readonly projectId: string;
  readonly title: string;
  readonly scope: string;
  readonly basis: Record<string, unknown>;
  readonly status: string;
  readonly now?: number;
}

export interface SaveVolumeOutlineInput {
  readonly volumeOutlineId: string;
  readonly projectId: string;
  readonly outlineId: string;
  readonly volumeId?: string | null;
  readonly title: string;
  readonly purpose: string;
  readonly majorConflict?: string | null;
  readonly climax?: string | null;
  readonly wordCountGoal?: number | null;
  readonly sortOrder: number;
  readonly status: string;
  readonly now?: number;
}

export interface SaveChapterOutlineInput {
  readonly chapterOutlineId: string;
  readonly projectId: string;
  readonly outlineId: string;
  readonly volumeOutlineId?: string | null;
  readonly chapterId?: string | null;
  readonly title: string;
  readonly chapterGoal: string;
  readonly conflict?: string | null;
  readonly informationGain?: string | null;
  readonly emotionalTurn?: string | null;
  readonly hook?: string | null;
  readonly requiredCharacterIds: readonly string[];
  readonly requiredLocationIds: readonly string[];
  readonly relatedPlotlineNodeIds: readonly string[];
  readonly relatedForeshadowingIds: readonly string[];
  readonly targetWordCount?: number | null;
  readonly sortOrder: number;
  readonly status: string;
  readonly now?: number;
}

export interface SaveSceneOutlineInput {
  readonly sceneOutlineId: string;
  readonly projectId: string;
  readonly chapterOutlineId: string;
  readonly sceneId?: string | null;
  readonly title: string;
  readonly purpose: string;
  readonly beatType: string;
  readonly povCharacterId?: string | null;
  readonly locationId?: string | null;
  readonly conflict?: string | null;
  readonly entryState?: string | null;
  readonly exitState?: string | null;
  readonly sortOrder: number;
  readonly status: string;
  readonly now?: number;
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

interface SceneOutlineRow {
  readonly id: string;
  readonly chapter_outline_id: string;
  readonly scene_id: string | null;
  readonly title: string;
  readonly purpose: string;
  readonly beat_type: string;
  readonly pov_character_id: string | null;
  readonly location_id: string | null;
  readonly conflict: string | null;
  readonly entry_state: string | null;
  readonly exit_state: string | null;
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
    const volumeOutline = this.getVolumeOutline(input.projectId, input.volumeOutlineId);
    if (!outline || !volumeOutline) {
      throw new Error(`OUTLINE_NOT_CREATED: ${input.outlineId}`);
    }

    return {
      chapterOutlines: this.listChapterOutlines(input.projectId, input.outlineId),
      outline,
      volumeOutline,
    };
  }

  saveOutlineDraft(input: SaveOutlineDraftInput): OutlineRecord {
    const now = input.now ?? Date.now();
    const existing = this.getOutline(input.projectId, input.outlineId);
    if (existing) {
      this.projectDatabase.client
        .prepare(
          `
          update outlines
          set title = @title,
              scope = @scope,
              basis_json = @basisJson,
              status = @status,
              version = version + 1,
              updated_at = @now
          where project_id = @projectId and id = @outlineId
          `,
        )
        .run({
          basisJson: JSON.stringify(input.basis),
          outlineId: input.outlineId,
          now,
          projectId: input.projectId,
          scope: input.scope,
          status: input.status,
          title: input.title,
        });
    } else {
      this.projectDatabase.client
        .prepare(
          `
          insert into outlines (
            id, project_id, title, scope, basis_json, status, version,
            source_artifact_id, created_at, updated_at
          )
          values (
            @outlineId, @projectId, @title, @scope, @basisJson, @status, 1,
            null, @now, @now
          )
          `,
        )
        .run({
          basisJson: JSON.stringify(input.basis),
          outlineId: input.outlineId,
          now,
          projectId: input.projectId,
          scope: input.scope,
          status: input.status,
          title: input.title,
        });
    }

    const outline = this.getOutline(input.projectId, input.outlineId);
    if (!outline) {
      throw new Error(`OUTLINE_NOT_FOUND: ${input.outlineId}`);
    }

    return outline;
  }

  saveVolumeOutline(input: SaveVolumeOutlineInput): VolumeOutlineRecord {
    const now = input.now ?? Date.now();
    const outline = this.getOutline(input.projectId, input.outlineId);
    if (!outline) {
      throw new Error(`OUTLINE_NOT_FOUND: ${input.outlineId}`);
    }

    const existing = this.getVolumeOutline(input.projectId, input.volumeOutlineId);
    if (existing) {
      this.projectDatabase.client
        .prepare(
          `
          update volume_outlines
          set outline_id = @outlineId,
              volume_id = @volumeId,
              title = @title,
              purpose = @purpose,
              major_conflict = @majorConflict,
              climax = @climax,
              word_count_goal = @wordCountGoal,
              sort_order = @sortOrder,
              status = @status,
              updated_at = @now
          where id = @volumeOutlineId
          `,
        )
        .run({
          climax: normalizeNullableText(input.climax),
          majorConflict: normalizeNullableText(input.majorConflict),
          outlineId: input.outlineId,
          now,
          purpose: input.purpose,
          sortOrder: input.sortOrder,
          status: input.status,
          title: input.title,
          volumeId: normalizeNullableText(input.volumeId),
          volumeOutlineId: input.volumeOutlineId,
          wordCountGoal: input.wordCountGoal ?? null,
        });
    } else {
      this.projectDatabase.client
        .prepare(
          `
          insert into volume_outlines (
            id, outline_id, volume_id, title, purpose, major_conflict, climax,
            word_count_goal, sort_order, status, created_at, updated_at
          )
          values (
            @volumeOutlineId, @outlineId, @volumeId, @title, @purpose, @majorConflict, @climax,
            @wordCountGoal, @sortOrder, @status, @now, @now
          )
          `,
        )
        .run({
          climax: normalizeNullableText(input.climax),
          majorConflict: normalizeNullableText(input.majorConflict),
          outlineId: input.outlineId,
          now,
          purpose: input.purpose,
          sortOrder: input.sortOrder,
          status: input.status,
          title: input.title,
          volumeId: normalizeNullableText(input.volumeId),
          volumeOutlineId: input.volumeOutlineId,
          wordCountGoal: input.wordCountGoal ?? null,
        });
    }

    const volumeOutline = this.getVolumeOutline(input.projectId, input.volumeOutlineId);
    if (!volumeOutline) {
      throw new Error(`VOLUME_OUTLINE_NOT_FOUND: ${input.volumeOutlineId}`);
    }

    return volumeOutline;
  }

  saveChapterOutline(input: SaveChapterOutlineInput): ChapterOutlineRecord {
    const now = input.now ?? Date.now();
    const outline = this.getOutline(input.projectId, input.outlineId);
    if (!outline) {
      throw new Error(`OUTLINE_NOT_FOUND: ${input.outlineId}`);
    }
    if (
      input.volumeOutlineId !== undefined &&
      input.volumeOutlineId !== null &&
      !this.getVolumeOutline(input.projectId, input.volumeOutlineId)
    ) {
      throw new Error(`VOLUME_OUTLINE_NOT_FOUND: ${input.volumeOutlineId}`);
    }

    const existing = this.getChapterOutline(input.projectId, input.chapterOutlineId);
    if (existing) {
      this.projectDatabase.client
        .prepare(
          `
          update chapter_outlines
          set outline_id = @outlineId,
              volume_outline_id = @volumeOutlineId,
              chapter_id = @chapterId,
              title = @title,
              chapter_goal = @chapterGoal,
              conflict = @conflict,
              information_gain = @informationGain,
              emotional_turn = @emotionalTurn,
              hook = @hook,
              required_character_ids_json = @requiredCharacterIdsJson,
              required_location_ids_json = @requiredLocationIdsJson,
              related_plotline_node_ids_json = @relatedPlotlineNodeIdsJson,
              related_foreshadowing_ids_json = @relatedForeshadowingIdsJson,
              target_word_count = @targetWordCount,
              sort_order = @sortOrder,
              status = @status,
              updated_at = @now
          where project_id = @projectId and id = @chapterOutlineId
          `,
        )
        .run({
          chapterGoal: input.chapterGoal,
          chapterId: normalizeNullableText(input.chapterId),
          chapterOutlineId: input.chapterOutlineId,
          conflict: normalizeNullableText(input.conflict),
          emotionalTurn: normalizeNullableText(input.emotionalTurn),
          hook: normalizeNullableText(input.hook),
          informationGain: normalizeNullableText(input.informationGain),
          outlineId: input.outlineId,
          now,
          projectId: input.projectId,
          relatedForeshadowingIdsJson: stringifyStringArray(input.relatedForeshadowingIds),
          relatedPlotlineNodeIdsJson: stringifyStringArray(input.relatedPlotlineNodeIds),
          requiredCharacterIdsJson: stringifyStringArray(input.requiredCharacterIds),
          requiredLocationIdsJson: stringifyStringArray(input.requiredLocationIds),
          sortOrder: input.sortOrder,
          status: input.status,
          targetWordCount: input.targetWordCount ?? null,
          title: input.title,
          volumeOutlineId: normalizeNullableText(input.volumeOutlineId),
        });
    } else {
      this.projectDatabase.client
        .prepare(
          `
          insert into chapter_outlines (
            id, project_id, outline_id, volume_outline_id, chapter_id, title, chapter_goal,
            conflict, information_gain, emotional_turn, hook,
            required_character_ids_json, required_location_ids_json,
            related_plotline_node_ids_json, related_foreshadowing_ids_json,
            target_word_count, sort_order, status, created_at, updated_at
          )
          values (
            @chapterOutlineId, @projectId, @outlineId, @volumeOutlineId, @chapterId, @title, @chapterGoal,
            @conflict, @informationGain, @emotionalTurn, @hook,
            @requiredCharacterIdsJson, @requiredLocationIdsJson,
            @relatedPlotlineNodeIdsJson, @relatedForeshadowingIdsJson,
            @targetWordCount, @sortOrder, @status, @now, @now
          )
          `,
        )
        .run({
          chapterGoal: input.chapterGoal,
          chapterId: normalizeNullableText(input.chapterId),
          chapterOutlineId: input.chapterOutlineId,
          conflict: normalizeNullableText(input.conflict),
          emotionalTurn: normalizeNullableText(input.emotionalTurn),
          hook: normalizeNullableText(input.hook),
          informationGain: normalizeNullableText(input.informationGain),
          outlineId: input.outlineId,
          now,
          projectId: input.projectId,
          relatedForeshadowingIdsJson: stringifyStringArray(input.relatedForeshadowingIds),
          relatedPlotlineNodeIdsJson: stringifyStringArray(input.relatedPlotlineNodeIds),
          requiredCharacterIdsJson: stringifyStringArray(input.requiredCharacterIds),
          requiredLocationIdsJson: stringifyStringArray(input.requiredLocationIds),
          sortOrder: input.sortOrder,
          status: input.status,
          targetWordCount: input.targetWordCount ?? null,
          title: input.title,
          volumeOutlineId: normalizeNullableText(input.volumeOutlineId),
        });
    }

    const chapterOutline = this.getChapterOutline(input.projectId, input.chapterOutlineId);
    if (!chapterOutline) {
      throw new Error(`CHAPTER_OUTLINE_NOT_FOUND: ${input.chapterOutlineId}`);
    }

    return chapterOutline;
  }

  saveSceneOutline(input: SaveSceneOutlineInput): SceneOutlineRecord {
    const now = input.now ?? Date.now();
    const chapterOutline = this.getChapterOutline(input.projectId, input.chapterOutlineId);
    if (!chapterOutline) {
      throw new Error(`CHAPTER_OUTLINE_NOT_FOUND: ${input.chapterOutlineId}`);
    }

    const existing = this.getSceneOutline(input.projectId, input.sceneOutlineId);
    if (existing) {
      this.projectDatabase.client
        .prepare(
          `
          update scene_outlines
          set chapter_outline_id = @chapterOutlineId,
              scene_id = @sceneId,
              title = @title,
              purpose = @purpose,
              beat_type = @beatType,
              pov_character_id = @povCharacterId,
              location_id = @locationId,
              conflict = @conflict,
              entry_state = @entryState,
              exit_state = @exitState,
              sort_order = @sortOrder,
              status = @status,
              updated_at = @now
          where id = @sceneOutlineId
          `,
        )
        .run({
          beatType: input.beatType,
          chapterOutlineId: input.chapterOutlineId,
          conflict: normalizeNullableText(input.conflict),
          entryState: normalizeNullableText(input.entryState),
          exitState: normalizeNullableText(input.exitState),
          locationId: normalizeNullableText(input.locationId),
          now,
          povCharacterId: normalizeNullableText(input.povCharacterId),
          purpose: input.purpose,
          sceneId: normalizeNullableText(input.sceneId),
          sceneOutlineId: input.sceneOutlineId,
          sortOrder: input.sortOrder,
          status: input.status,
          title: input.title,
        });
    } else {
      this.projectDatabase.client
        .prepare(
          `
          insert into scene_outlines (
            id, chapter_outline_id, scene_id, title, purpose, beat_type,
            pov_character_id, location_id, conflict, entry_state, exit_state,
            sort_order, status, created_at, updated_at
          )
          values (
            @sceneOutlineId, @chapterOutlineId, @sceneId, @title, @purpose, @beatType,
            @povCharacterId, @locationId, @conflict, @entryState, @exitState,
            @sortOrder, @status, @now, @now
          )
          `,
        )
        .run({
          beatType: input.beatType,
          chapterOutlineId: input.chapterOutlineId,
          conflict: normalizeNullableText(input.conflict),
          entryState: normalizeNullableText(input.entryState),
          exitState: normalizeNullableText(input.exitState),
          locationId: normalizeNullableText(input.locationId),
          now,
          povCharacterId: normalizeNullableText(input.povCharacterId),
          purpose: input.purpose,
          sceneId: normalizeNullableText(input.sceneId),
          sceneOutlineId: input.sceneOutlineId,
          sortOrder: input.sortOrder,
          status: input.status,
          title: input.title,
        });
    }

    const sceneOutline = this.getSceneOutline(input.projectId, input.sceneOutlineId);
    if (!sceneOutline) {
      throw new Error(`SCENE_OUTLINE_NOT_FOUND: ${input.sceneOutlineId}`);
    }

    return sceneOutline;
  }

  listOutlines(projectId: string): OutlineRecord[] {
    return this.projectDatabase.client
      .prepare(
        "select * from outlines where project_id = ? order by updated_at desc, created_at desc",
      )
      .all(projectId)
      .map((row) => mapOutlineRow(row as OutlineRow));
  }

  listVolumeOutlines(projectId: string, outlineId?: string): VolumeOutlineRecord[] {
    const rows = outlineId
      ? this.projectDatabase.client
          .prepare(
            `
            select vo.*
            from volume_outlines vo
            join outlines o on o.id = vo.outline_id
            where o.project_id = ? and vo.outline_id = ?
            order by vo.sort_order asc, vo.created_at asc
            `,
          )
          .all(projectId, outlineId)
      : this.projectDatabase.client
          .prepare(
            `
            select vo.*
            from volume_outlines vo
            join outlines o on o.id = vo.outline_id
            where o.project_id = ?
            order by vo.sort_order asc, vo.created_at asc
            `,
          )
          .all(projectId);

    return rows.map((row) => mapVolumeOutlineRow(row as VolumeOutlineRow));
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

  listSceneOutlines(projectId: string, chapterOutlineId?: string): SceneOutlineRecord[] {
    const rows = chapterOutlineId
      ? this.projectDatabase.client
          .prepare(
            `
            select so.*
            from scene_outlines so
            join chapter_outlines co on co.id = so.chapter_outline_id
            where co.project_id = ? and so.chapter_outline_id = ?
            order by so.sort_order asc, so.created_at asc
            `,
          )
          .all(projectId, chapterOutlineId)
      : this.projectDatabase.client
          .prepare(
            `
            select so.*
            from scene_outlines so
            join chapter_outlines co on co.id = so.chapter_outline_id
            where co.project_id = ?
            order by co.sort_order asc, so.sort_order asc, so.created_at asc
            `,
          )
          .all(projectId);

    return rows.map((row) => mapSceneOutlineRow(row as SceneOutlineRow));
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

  getOutline(projectId: string, outlineId: string): OutlineRecord | null {
    const row = this.projectDatabase.client
      .prepare("select * from outlines where project_id = ? and id = ?")
      .get(projectId, outlineId) as OutlineRow | undefined;

    return row ? mapOutlineRow(row) : null;
  }

  getVolumeOutline(projectId: string, volumeOutlineId: string): VolumeOutlineRecord | null {
    const row = this.projectDatabase.client
      .prepare(
        `
        select vo.*
        from volume_outlines vo
        join outlines o on o.id = vo.outline_id
        where o.project_id = ? and vo.id = ?
        `,
      )
      .get(projectId, volumeOutlineId) as VolumeOutlineRow | undefined;

    return row ? mapVolumeOutlineRow(row) : null;
  }

  getSceneOutline(projectId: string, sceneOutlineId: string): SceneOutlineRecord | null {
    const row = this.projectDatabase.client
      .prepare(
        `
        select so.*
        from scene_outlines so
        join chapter_outlines co on co.id = so.chapter_outline_id
        where co.project_id = ? and so.id = ?
        `,
      )
      .get(projectId, sceneOutlineId) as SceneOutlineRow | undefined;

    return row ? mapSceneOutlineRow(row) : null;
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

function mapSceneOutlineRow(row: SceneOutlineRow): SceneOutlineRecord {
  return {
    beatType: row.beat_type,
    chapterOutlineId: row.chapter_outline_id,
    conflict: row.conflict,
    createdAt: row.created_at,
    entryState: row.entry_state,
    exitState: row.exit_state,
    id: row.id,
    locationId: row.location_id,
    povCharacterId: row.pov_character_id,
    purpose: row.purpose,
    sceneId: row.scene_id,
    sortOrder: row.sort_order,
    status: row.status,
    title: row.title,
    updatedAt: row.updated_at,
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

function normalizeNullableText(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function stringifyStringArray(values: readonly string[]): string {
  return JSON.stringify(Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))));
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
