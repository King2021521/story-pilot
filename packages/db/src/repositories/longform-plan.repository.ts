import type { ProjectDatabase } from "../project-database.js";

export interface BookPlanRecord {
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  readonly targetWordCount: number;
  readonly corePromise: string;
  readonly endingDirection: string | null;
  readonly mainPlotlineId: string | null;
  readonly status: string;
  readonly version: number;
  readonly sourceArtifactId: string | null;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface VolumePlanRecord {
  readonly id: string;
  readonly projectId: string;
  readonly bookPlanId: string;
  readonly title: string;
  readonly volumeIndex: number;
  readonly purpose: string;
  readonly majorConflict: string;
  readonly climax: string | null;
  readonly targetWordCount: number;
  readonly status: string;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface ArcPlanRecord {
  readonly id: string;
  readonly projectId: string;
  readonly volumePlanId: string;
  readonly title: string;
  readonly arcIndex: number;
  readonly plotlineId: string | null;
  readonly characterArcId: string | null;
  readonly startChapterIndex: number | null;
  readonly endChapterIndex: number | null;
  readonly purpose: string;
  readonly escalation: readonly string[];
  readonly status: string;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface ChapterPlanRecord {
  readonly id: string;
  readonly projectId: string;
  readonly arcPlanId: string | null;
  readonly chapterId: string | null;
  readonly chapterIndex: number;
  readonly title: string;
  readonly chapterGoal: string;
  readonly conflict: string;
  readonly informationGain: string;
  readonly emotionalTurn: string;
  readonly hook: string;
  readonly targetWordCount: number;
  readonly relatedPlotlineIds: readonly string[];
  readonly relatedCharacterIds: readonly string[];
  readonly relatedForeshadowingIds: readonly string[];
  readonly status: string;
  readonly version: number;
  readonly sourceArtifactId: string | null;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface ScenePlanRecord {
  readonly id: string;
  readonly projectId: string;
  readonly chapterPlanId: string;
  readonly sceneIndex: number;
  readonly povCharacterId: string | null;
  readonly locationId: string | null;
  readonly sceneGoal: string;
  readonly conflictTurn: string;
  readonly outcome: string;
  readonly memoryTargets: readonly string[];
  readonly status: string;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface CreateBookPlanHierarchyInput {
  readonly bookPlanId: string;
  readonly projectId: string;
  readonly title: string;
  readonly targetWordCount: number;
  readonly corePromise: string;
  readonly endingDirection?: string;
  readonly mainPlotlineId?: string;
  readonly sourceArtifactId?: string;
  readonly volumes: readonly CreateVolumePlanInput[];
  readonly now?: number;
}

export interface CreateVolumePlanInput {
  readonly volumePlanId: string;
  readonly title: string;
  readonly volumeIndex: number;
  readonly purpose: string;
  readonly majorConflict: string;
  readonly climax?: string;
  readonly targetWordCount: number;
  readonly arcs?: readonly CreateArcPlanInput[];
}

export interface CreateArcPlanInput {
  readonly arcPlanId: string;
  readonly title: string;
  readonly arcIndex: number;
  readonly plotlineId?: string;
  readonly characterArcId?: string;
  readonly startChapterIndex?: number;
  readonly endChapterIndex?: number;
  readonly purpose: string;
  readonly escalation: readonly string[];
}

export interface SaveBookPlanDraftInput {
  readonly bookPlanId: string;
  readonly projectId: string;
  readonly title: string;
  readonly targetWordCount: number;
  readonly corePromise: string;
  readonly endingDirection: string | null;
  readonly mainPlotlineId: string | null;
  readonly status: string;
  readonly now?: number;
}

export interface SaveVolumePlanInput {
  readonly volumePlanId: string;
  readonly projectId: string;
  readonly bookPlanId: string;
  readonly title: string;
  readonly volumeIndex: number;
  readonly purpose: string;
  readonly majorConflict: string;
  readonly climax: string | null;
  readonly targetWordCount: number;
  readonly status: string;
  readonly now?: number;
}

export interface SaveArcPlanInput {
  readonly arcPlanId: string;
  readonly projectId: string;
  readonly volumePlanId: string;
  readonly title: string;
  readonly arcIndex: number;
  readonly plotlineId: string | null;
  readonly characterArcId: string | null;
  readonly startChapterIndex: number | null;
  readonly endChapterIndex: number | null;
  readonly purpose: string;
  readonly escalation: readonly string[];
  readonly status: string;
  readonly now?: number;
}

export interface CreateBookPlanHierarchyResult {
  readonly bookPlan: BookPlanRecord;
  readonly volumePlans: readonly VolumePlanRecord[];
  readonly arcPlans: readonly ArcPlanRecord[];
}

export interface CreateChapterPlansInput {
  readonly projectId: string;
  readonly defaultArcPlanId?: string;
  readonly sourceArtifactId?: string;
  readonly chapterPlans: readonly CreateChapterPlanInput[];
  readonly now?: number;
}

export interface CreateChapterPlanInput {
  readonly chapterPlanId: string;
  readonly arcPlanId?: string;
  readonly chapterIndex: number;
  readonly title: string;
  readonly chapterGoal: string;
  readonly conflict: string;
  readonly informationGain: string;
  readonly emotionalTurn: string;
  readonly hook: string;
  readonly targetWordCount: number;
  readonly relatedPlotlineIds?: readonly string[];
  readonly relatedCharacterIds?: readonly string[];
  readonly relatedForeshadowingIds?: readonly string[];
  readonly scenes?: readonly CreateScenePlanInput[];
}

export interface CreateScenePlanInput {
  readonly scenePlanId: string;
  readonly sceneIndex: number;
  readonly povCharacterId?: string;
  readonly locationId?: string;
  readonly sceneGoal: string;
  readonly conflictTurn: string;
  readonly outcome: string;
  readonly memoryTargets?: readonly string[];
}

export interface CreateChapterPlansResult {
  readonly chapterPlans: readonly ChapterPlanRecord[];
  readonly scenePlans: readonly ScenePlanRecord[];
}

interface BookPlanRow {
  readonly id: string;
  readonly project_id: string;
  readonly title: string;
  readonly target_word_count: number;
  readonly core_promise: string;
  readonly ending_direction: string | null;
  readonly main_plotline_id: string | null;
  readonly status: string;
  readonly version: number;
  readonly source_artifact_id: string | null;
  readonly created_at: number;
  readonly updated_at: number;
}

interface VolumePlanRow {
  readonly id: string;
  readonly project_id: string;
  readonly book_plan_id: string;
  readonly title: string;
  readonly volume_index: number;
  readonly purpose: string;
  readonly major_conflict: string;
  readonly climax: string | null;
  readonly target_word_count: number;
  readonly status: string;
  readonly created_at: number;
  readonly updated_at: number;
}

interface ArcPlanRow {
  readonly id: string;
  readonly project_id: string;
  readonly volume_plan_id: string;
  readonly title: string;
  readonly arc_index: number;
  readonly plotline_id: string | null;
  readonly character_arc_id: string | null;
  readonly start_chapter_index: number | null;
  readonly end_chapter_index: number | null;
  readonly purpose: string;
  readonly escalation_json: string;
  readonly status: string;
  readonly created_at: number;
  readonly updated_at: number;
}

interface ChapterPlanRow {
  readonly id: string;
  readonly project_id: string;
  readonly arc_plan_id: string | null;
  readonly chapter_id: string | null;
  readonly chapter_index: number;
  readonly title: string;
  readonly chapter_goal: string;
  readonly conflict: string;
  readonly information_gain: string;
  readonly emotional_turn: string;
  readonly hook: string;
  readonly target_word_count: number;
  readonly related_plotline_ids_json: string;
  readonly related_character_ids_json: string;
  readonly related_foreshadowing_ids_json: string;
  readonly status: string;
  readonly version: number;
  readonly source_artifact_id: string | null;
  readonly created_at: number;
  readonly updated_at: number;
}

interface ScenePlanRow {
  readonly id: string;
  readonly project_id: string;
  readonly chapter_plan_id: string;
  readonly scene_index: number;
  readonly pov_character_id: string | null;
  readonly location_id: string | null;
  readonly scene_goal: string;
  readonly conflict_turn: string;
  readonly outcome: string;
  readonly memory_targets_json: string;
  readonly status: string;
  readonly created_at: number;
  readonly updated_at: number;
}

export class LongformPlanRepository {
  constructor(private readonly projectDatabase: ProjectDatabase) {}

  createBookPlanHierarchy(input: CreateBookPlanHierarchyInput): CreateBookPlanHierarchyResult {
    const now = input.now ?? Date.now();
    const create = this.projectDatabase.client.transaction(() => {
      this.projectDatabase.client
        .prepare(
          `
          insert into book_plans (
            id, project_id, title, target_word_count, core_promise, ending_direction,
            main_plotline_id, status, version, source_artifact_id, created_at, updated_at
          )
          values (
            @bookPlanId, @projectId, @title, @targetWordCount, @corePromise, @endingDirection,
            @mainPlotlineId, 'draft', 1, @sourceArtifactId, @now, @now
          )
        `,
        )
        .run({
          bookPlanId: input.bookPlanId,
          corePromise: input.corePromise,
          endingDirection: input.endingDirection ?? null,
          mainPlotlineId: input.mainPlotlineId ?? null,
          now,
          projectId: input.projectId,
          sourceArtifactId: input.sourceArtifactId ?? null,
          targetWordCount: input.targetWordCount,
          title: input.title,
        });

      const insertVolume = this.projectDatabase.client.prepare(
        `
        insert into volume_plans (
          id, project_id, book_plan_id, title, volume_index, purpose, major_conflict,
          climax, target_word_count, status, created_at, updated_at
        )
        values (
          @volumePlanId, @projectId, @bookPlanId, @title, @volumeIndex, @purpose, @majorConflict,
          @climax, @targetWordCount, 'draft', @now, @now
        )
      `,
      );
      const insertArc = this.projectDatabase.client.prepare(
        `
        insert into arc_plans (
          id, project_id, volume_plan_id, title, arc_index, plotline_id, character_arc_id,
          start_chapter_index, end_chapter_index, purpose, escalation_json,
          status, created_at, updated_at
        )
        values (
          @arcPlanId, @projectId, @volumePlanId, @title, @arcIndex, @plotlineId, @characterArcId,
          @startChapterIndex, @endChapterIndex, @purpose, @escalationJson,
          'draft', @now, @now
        )
      `,
      );

      for (const volume of input.volumes) {
        insertVolume.run({
          bookPlanId: input.bookPlanId,
          climax: volume.climax ?? null,
          majorConflict: volume.majorConflict,
          now,
          projectId: input.projectId,
          purpose: volume.purpose,
          targetWordCount: volume.targetWordCount,
          title: volume.title,
          volumeIndex: volume.volumeIndex,
          volumePlanId: volume.volumePlanId,
        });

        for (const arc of volume.arcs ?? []) {
          insertArc.run({
            arcIndex: arc.arcIndex,
            arcPlanId: arc.arcPlanId,
            characterArcId: arc.characterArcId ?? null,
            endChapterIndex: arc.endChapterIndex ?? null,
            escalationJson: JSON.stringify(arc.escalation),
            now,
            plotlineId: arc.plotlineId ?? null,
            projectId: input.projectId,
            purpose: arc.purpose,
            startChapterIndex: arc.startChapterIndex ?? null,
            title: arc.title,
            volumePlanId: volume.volumePlanId,
          });
        }
      }
    });

    create();

    const bookPlan = this.getBookPlan(input.projectId, input.bookPlanId);
    if (!bookPlan) {
      throw new Error(`BOOK_PLAN_NOT_CREATED: ${input.bookPlanId}`);
    }

    return {
      arcPlans: input.volumes.flatMap((volume) =>
        this.listArcPlans(input.projectId, volume.volumePlanId),
      ),
      bookPlan,
      volumePlans: this.listVolumePlans(input.projectId, bookPlan.id),
    };
  }

  saveBookPlanDraft(input: SaveBookPlanDraftInput): BookPlanRecord {
    const now = input.now ?? Date.now();
    const existing = this.getBookPlan(input.projectId, input.bookPlanId);
    if (existing) {
      this.projectDatabase.client
        .prepare(
          `
          update book_plans
          set title = @title,
              target_word_count = @targetWordCount,
              core_promise = @corePromise,
              ending_direction = @endingDirection,
              main_plotline_id = @mainPlotlineId,
              status = @status,
              version = version + 1,
              updated_at = @now
          where project_id = @projectId and id = @bookPlanId
        `,
        )
        .run({
          bookPlanId: input.bookPlanId,
          corePromise: input.corePromise,
          endingDirection: input.endingDirection,
          mainPlotlineId: input.mainPlotlineId,
          now,
          projectId: input.projectId,
          status: input.status,
          targetWordCount: input.targetWordCount,
          title: input.title,
        });
    } else {
      this.projectDatabase.client
        .prepare(
          `
          insert into book_plans (
            id, project_id, title, target_word_count, core_promise, ending_direction,
            main_plotline_id, status, version, source_artifact_id, created_at, updated_at
          )
          values (
            @bookPlanId, @projectId, @title, @targetWordCount, @corePromise, @endingDirection,
            @mainPlotlineId, @status, 1, null, @now, @now
          )
        `,
        )
        .run({
          bookPlanId: input.bookPlanId,
          corePromise: input.corePromise,
          endingDirection: input.endingDirection,
          mainPlotlineId: input.mainPlotlineId,
          now,
          projectId: input.projectId,
          status: input.status,
          targetWordCount: input.targetWordCount,
          title: input.title,
        });
    }

    const bookPlan = this.getBookPlan(input.projectId, input.bookPlanId);
    if (!bookPlan) {
      throw new Error(`BOOK_PLAN_NOT_FOUND: ${input.bookPlanId}`);
    }

    return bookPlan;
  }

  saveVolumePlan(input: SaveVolumePlanInput): VolumePlanRecord {
    const now = input.now ?? Date.now();
    const existing = this.getVolumePlan(input.projectId, input.volumePlanId);
    if (existing) {
      this.projectDatabase.client
        .prepare(
          `
          update volume_plans
          set book_plan_id = @bookPlanId,
              title = @title,
              volume_index = @volumeIndex,
              purpose = @purpose,
              major_conflict = @majorConflict,
              climax = @climax,
              target_word_count = @targetWordCount,
              status = @status,
              updated_at = @now
          where project_id = @projectId and id = @volumePlanId
        `,
        )
        .run({
          bookPlanId: input.bookPlanId,
          climax: input.climax,
          majorConflict: input.majorConflict,
          now,
          projectId: input.projectId,
          purpose: input.purpose,
          status: input.status,
          targetWordCount: input.targetWordCount,
          title: input.title,
          volumeIndex: input.volumeIndex,
          volumePlanId: input.volumePlanId,
        });
    } else {
      this.projectDatabase.client
        .prepare(
          `
          insert into volume_plans (
            id, project_id, book_plan_id, title, volume_index, purpose, major_conflict,
            climax, target_word_count, status, created_at, updated_at
          )
          values (
            @volumePlanId, @projectId, @bookPlanId, @title, @volumeIndex, @purpose,
            @majorConflict, @climax, @targetWordCount, @status, @now, @now
          )
        `,
        )
        .run({
          bookPlanId: input.bookPlanId,
          climax: input.climax,
          majorConflict: input.majorConflict,
          now,
          projectId: input.projectId,
          purpose: input.purpose,
          status: input.status,
          targetWordCount: input.targetWordCount,
          title: input.title,
          volumeIndex: input.volumeIndex,
          volumePlanId: input.volumePlanId,
        });
    }

    const volumePlan = this.getVolumePlan(input.projectId, input.volumePlanId);
    if (!volumePlan) {
      throw new Error(`VOLUME_PLAN_NOT_FOUND: ${input.volumePlanId}`);
    }

    return volumePlan;
  }

  saveArcPlan(input: SaveArcPlanInput): ArcPlanRecord {
    const now = input.now ?? Date.now();
    const existing = this.getArcPlan(input.projectId, input.arcPlanId);
    if (existing) {
      this.projectDatabase.client
        .prepare(
          `
          update arc_plans
          set volume_plan_id = @volumePlanId,
              title = @title,
              arc_index = @arcIndex,
              plotline_id = @plotlineId,
              character_arc_id = @characterArcId,
              start_chapter_index = @startChapterIndex,
              end_chapter_index = @endChapterIndex,
              purpose = @purpose,
              escalation_json = @escalationJson,
              status = @status,
              updated_at = @now
          where project_id = @projectId and id = @arcPlanId
        `,
        )
        .run({
          arcIndex: input.arcIndex,
          arcPlanId: input.arcPlanId,
          characterArcId: input.characterArcId,
          endChapterIndex: input.endChapterIndex,
          escalationJson: JSON.stringify(input.escalation),
          now,
          plotlineId: input.plotlineId,
          projectId: input.projectId,
          purpose: input.purpose,
          startChapterIndex: input.startChapterIndex,
          status: input.status,
          title: input.title,
          volumePlanId: input.volumePlanId,
        });
    } else {
      this.projectDatabase.client
        .prepare(
          `
          insert into arc_plans (
            id, project_id, volume_plan_id, title, arc_index, plotline_id, character_arc_id,
            start_chapter_index, end_chapter_index, purpose, escalation_json,
            status, created_at, updated_at
          )
          values (
            @arcPlanId, @projectId, @volumePlanId, @title, @arcIndex, @plotlineId,
            @characterArcId, @startChapterIndex, @endChapterIndex, @purpose,
            @escalationJson, @status, @now, @now
          )
        `,
        )
        .run({
          arcIndex: input.arcIndex,
          arcPlanId: input.arcPlanId,
          characterArcId: input.characterArcId,
          endChapterIndex: input.endChapterIndex,
          escalationJson: JSON.stringify(input.escalation),
          now,
          plotlineId: input.plotlineId,
          projectId: input.projectId,
          purpose: input.purpose,
          startChapterIndex: input.startChapterIndex,
          status: input.status,
          title: input.title,
          volumePlanId: input.volumePlanId,
        });
    }

    const arcPlan = this.getArcPlan(input.projectId, input.arcPlanId);
    if (!arcPlan) {
      throw new Error(`ARC_PLAN_NOT_FOUND: ${input.arcPlanId}`);
    }

    return arcPlan;
  }

  createChapterPlans(input: CreateChapterPlansInput): CreateChapterPlansResult {
    const now = input.now ?? Date.now();
    const create = this.projectDatabase.client.transaction(() => {
      const insertChapterPlan = this.projectDatabase.client.prepare(
        `
        insert into chapter_plans (
          id, project_id, arc_plan_id, chapter_index, title, chapter_goal,
          conflict, information_gain, emotional_turn, hook, target_word_count,
          related_plotline_ids_json, related_character_ids_json,
          related_foreshadowing_ids_json, status, version, source_artifact_id,
          created_at, updated_at
        )
        values (
          @chapterPlanId, @projectId, @arcPlanId, @chapterIndex, @title, @chapterGoal,
          @conflict, @informationGain, @emotionalTurn, @hook, @targetWordCount,
          @relatedPlotlineIdsJson, @relatedCharacterIdsJson,
          @relatedForeshadowingIdsJson, 'draft', 1, @sourceArtifactId,
          @now, @now
        )
      `,
      );
      const insertScenePlan = this.projectDatabase.client.prepare(
        `
        insert into scene_plans (
          id, project_id, chapter_plan_id, scene_index, pov_character_id, location_id,
          scene_goal, conflict_turn, outcome, memory_targets_json, status, created_at, updated_at
        )
        values (
          @scenePlanId, @projectId, @chapterPlanId, @sceneIndex, @povCharacterId, @locationId,
          @sceneGoal, @conflictTurn, @outcome, @memoryTargetsJson, 'draft', @now, @now
        )
      `,
      );

      for (const chapterPlan of input.chapterPlans) {
        insertChapterPlan.run({
          arcPlanId: chapterPlan.arcPlanId ?? input.defaultArcPlanId ?? null,
          chapterGoal: chapterPlan.chapterGoal,
          chapterIndex: chapterPlan.chapterIndex,
          chapterPlanId: chapterPlan.chapterPlanId,
          conflict: chapterPlan.conflict,
          emotionalTurn: chapterPlan.emotionalTurn,
          hook: chapterPlan.hook,
          informationGain: chapterPlan.informationGain,
          now,
          projectId: input.projectId,
          relatedCharacterIdsJson: JSON.stringify(chapterPlan.relatedCharacterIds ?? []),
          relatedForeshadowingIdsJson: JSON.stringify(chapterPlan.relatedForeshadowingIds ?? []),
          relatedPlotlineIdsJson: JSON.stringify(chapterPlan.relatedPlotlineIds ?? []),
          sourceArtifactId: input.sourceArtifactId ?? null,
          targetWordCount: chapterPlan.targetWordCount,
          title: chapterPlan.title,
        });

        for (const scene of chapterPlan.scenes ?? []) {
          insertScenePlan.run({
            chapterPlanId: chapterPlan.chapterPlanId,
            conflictTurn: scene.conflictTurn,
            locationId: scene.locationId ?? null,
            memoryTargetsJson: JSON.stringify(scene.memoryTargets ?? []),
            now,
            outcome: scene.outcome,
            povCharacterId: scene.povCharacterId ?? null,
            projectId: input.projectId,
            sceneGoal: scene.sceneGoal,
            sceneIndex: scene.sceneIndex,
            scenePlanId: scene.scenePlanId,
          });
        }
      }
    });

    create();

    const chapterPlanIds = new Set(
      input.chapterPlans.map((chapterPlan) => chapterPlan.chapterPlanId),
    );
    const chapterPlans = this.listChapterPlans(input.projectId).filter((chapterPlan) =>
      chapterPlanIds.has(chapterPlan.id),
    );
    const scenePlans = chapterPlans.flatMap((chapterPlan) =>
      this.listScenePlans(input.projectId, chapterPlan.id),
    );

    return { chapterPlans, scenePlans };
  }

  getBookPlan(projectId: string, bookPlanId: string): BookPlanRecord | null {
    const row = this.projectDatabase.client
      .prepare("select * from book_plans where project_id = ? and id = ?")
      .get(projectId, bookPlanId) as BookPlanRow | undefined;

    return row ? mapBookPlanRow(row) : null;
  }

  listBookPlans(projectId: string): BookPlanRecord[] {
    return this.projectDatabase.client
      .prepare("select * from book_plans where project_id = ? order by updated_at desc")
      .all(projectId)
      .map((row) => mapBookPlanRow(row as BookPlanRow));
  }

  listVolumePlans(projectId: string, bookPlanId?: string): VolumePlanRecord[] {
    const rows = bookPlanId
      ? this.projectDatabase.client
          .prepare(
            "select * from volume_plans where project_id = ? and book_plan_id = ? order by volume_index asc",
          )
          .all(projectId, bookPlanId)
      : this.projectDatabase.client
          .prepare("select * from volume_plans where project_id = ? order by volume_index asc")
          .all(projectId);

    return rows.map((row) => mapVolumePlanRow(row as VolumePlanRow));
  }

  getVolumePlan(projectId: string, volumePlanId: string): VolumePlanRecord | null {
    const row = this.projectDatabase.client
      .prepare("select * from volume_plans where project_id = ? and id = ?")
      .get(projectId, volumePlanId) as VolumePlanRow | undefined;

    return row ? mapVolumePlanRow(row) : null;
  }

  listArcPlans(projectId: string, volumePlanId?: string): ArcPlanRecord[] {
    const rows = volumePlanId
      ? this.projectDatabase.client
          .prepare(
            "select * from arc_plans where project_id = ? and volume_plan_id = ? order by arc_index asc",
          )
          .all(projectId, volumePlanId)
      : this.projectDatabase.client
          .prepare("select * from arc_plans where project_id = ? order by arc_index asc")
          .all(projectId);

    return rows.map((row) => mapArcPlanRow(row as ArcPlanRow));
  }

  getArcPlan(projectId: string, arcPlanId: string): ArcPlanRecord | null {
    const row = this.projectDatabase.client
      .prepare("select * from arc_plans where project_id = ? and id = ?")
      .get(projectId, arcPlanId) as ArcPlanRow | undefined;

    return row ? mapArcPlanRow(row) : null;
  }

  getChapterPlan(projectId: string, chapterPlanId: string): ChapterPlanRecord | null {
    const row = this.projectDatabase.client
      .prepare("select * from chapter_plans where project_id = ? and id = ?")
      .get(projectId, chapterPlanId) as ChapterPlanRow | undefined;

    return row ? mapChapterPlanRow(row) : null;
  }

  linkChapterPlanToChapter(input: {
    readonly projectId: string;
    readonly chapterPlanId: string;
    readonly chapterId: string;
    readonly now?: number;
  }): ChapterPlanRecord {
    const now = input.now ?? Date.now();
    this.projectDatabase.client
      .prepare(
        `
        update chapter_plans
        set chapter_id = ?, status = 'applied', updated_at = ?
        where project_id = ? and id = ?
        `,
      )
      .run(input.chapterId, now, input.projectId, input.chapterPlanId);

    const chapterPlan = this.getChapterPlan(input.projectId, input.chapterPlanId);
    if (!chapterPlan) {
      throw new Error(`CHAPTER_PLAN_NOT_FOUND: ${input.chapterPlanId}`);
    }

    return chapterPlan;
  }

  listChapterPlans(projectId: string): ChapterPlanRecord[] {
    return this.projectDatabase.client
      .prepare("select * from chapter_plans where project_id = ? order by chapter_index asc")
      .all(projectId)
      .map((row) => mapChapterPlanRow(row as ChapterPlanRow));
  }

  listScenePlans(projectId: string, chapterPlanId?: string): ScenePlanRecord[] {
    const rows = chapterPlanId
      ? this.projectDatabase.client
          .prepare(
            "select * from scene_plans where project_id = ? and chapter_plan_id = ? order by scene_index asc",
          )
          .all(projectId, chapterPlanId)
      : this.projectDatabase.client
          .prepare(
            "select * from scene_plans where project_id = ? order by chapter_plan_id, scene_index asc",
          )
          .all(projectId);

    return rows.map((row) => mapScenePlanRow(row as ScenePlanRow));
  }
}

function mapBookPlanRow(row: BookPlanRow): BookPlanRecord {
  return {
    corePromise: row.core_promise,
    createdAt: row.created_at,
    endingDirection: row.ending_direction,
    id: row.id,
    mainPlotlineId: row.main_plotline_id,
    projectId: row.project_id,
    sourceArtifactId: row.source_artifact_id,
    status: row.status,
    targetWordCount: row.target_word_count,
    title: row.title,
    updatedAt: row.updated_at,
    version: row.version,
  };
}

function mapVolumePlanRow(row: VolumePlanRow): VolumePlanRecord {
  return {
    bookPlanId: row.book_plan_id,
    climax: row.climax,
    createdAt: row.created_at,
    id: row.id,
    majorConflict: row.major_conflict,
    projectId: row.project_id,
    purpose: row.purpose,
    status: row.status,
    targetWordCount: row.target_word_count,
    title: row.title,
    updatedAt: row.updated_at,
    volumeIndex: row.volume_index,
  };
}

function mapArcPlanRow(row: ArcPlanRow): ArcPlanRecord {
  return {
    arcIndex: row.arc_index,
    characterArcId: row.character_arc_id,
    createdAt: row.created_at,
    endChapterIndex: row.end_chapter_index,
    escalation: parseStringArray(row.escalation_json),
    id: row.id,
    plotlineId: row.plotline_id,
    projectId: row.project_id,
    purpose: row.purpose,
    startChapterIndex: row.start_chapter_index,
    status: row.status,
    title: row.title,
    updatedAt: row.updated_at,
    volumePlanId: row.volume_plan_id,
  };
}

function mapChapterPlanRow(row: ChapterPlanRow): ChapterPlanRecord {
  return {
    arcPlanId: row.arc_plan_id,
    chapterGoal: row.chapter_goal,
    chapterId: row.chapter_id,
    chapterIndex: row.chapter_index,
    conflict: row.conflict,
    createdAt: row.created_at,
    emotionalTurn: row.emotional_turn,
    hook: row.hook,
    id: row.id,
    informationGain: row.information_gain,
    projectId: row.project_id,
    relatedCharacterIds: parseStringArray(row.related_character_ids_json),
    relatedForeshadowingIds: parseStringArray(row.related_foreshadowing_ids_json),
    relatedPlotlineIds: parseStringArray(row.related_plotline_ids_json),
    sourceArtifactId: row.source_artifact_id,
    status: row.status,
    targetWordCount: row.target_word_count,
    title: row.title,
    updatedAt: row.updated_at,
    version: row.version,
  };
}

function mapScenePlanRow(row: ScenePlanRow): ScenePlanRecord {
  return {
    chapterPlanId: row.chapter_plan_id,
    conflictTurn: row.conflict_turn,
    createdAt: row.created_at,
    id: row.id,
    locationId: row.location_id,
    memoryTargets: parseStringArray(row.memory_targets_json),
    outcome: row.outcome,
    povCharacterId: row.pov_character_id,
    projectId: row.project_id,
    sceneGoal: row.scene_goal,
    sceneIndex: row.scene_index,
    status: row.status,
    updatedAt: row.updated_at,
  };
}

function parseStringArray(value: string): string[] {
  const parsed = JSON.parse(value) as unknown;
  return Array.isArray(parsed)
    ? parsed.filter((item): item is string => typeof item === "string")
    : [];
}
