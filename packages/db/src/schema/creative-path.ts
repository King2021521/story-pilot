import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { chapters, scenes } from "./chapter.js";
import { characters } from "./character.js";
import { projects, volumes } from "./project.js";

export const creativeStages = sqliteTable(
  "creative_stages",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    stageKey: text("stage_key").notNull(),
    status: text("status").notNull().default("locked"),
    readinessScore: integer("readiness_score").notNull().default(0),
    gateReportJson: text("gate_report_json").notNull().default("{}"),
    currentWorkOrderId: text("current_work_order_id"),
    completedAt: integer("completed_at"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("creative_stages_project_id_idx").on(table.projectId),
    index("creative_stages_stage_key_idx").on(table.projectId, table.stageKey),
  ],
);

export const projectBriefs = sqliteTable(
  "project_briefs",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    genre: text("genre").notNull(),
    subgenresJson: text("subgenres_json").notNull().default("[]"),
    targetAudience: text("target_audience"),
    platformProfile: text("platform_profile"),
    lengthProfile: text("length_profile"),
    estimatedWordCount: integer("estimated_word_count"),
    estimatedChapterCount: integer("estimated_chapter_count"),
    narrativePov: text("narrative_pov"),
    emotionalRewardsJson: text("emotional_rewards_json").notNull().default("[]"),
    initialIdea: text("initial_idea"),
    forbiddenDirectionsJson: text("forbidden_directions_json").notNull().default("[]"),
    status: text("status").notNull().default("draft"),
    version: integer("version").notNull().default(1),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("project_briefs_project_id_idx").on(table.projectId),
    index("project_briefs_status_idx").on(table.projectId, table.status),
  ],
);

export const storyBlueprints = sqliteTable(
  "story_blueprints",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    premise: text("premise").notNull(),
    logline: text("logline").notNull(),
    corePromise: text("core_promise").notNull(),
    mainGoal: text("main_goal").notNull().default(""),
    mainConflict: text("main_conflict").notNull(),
    protagonistArc: text("protagonist_arc"),
    antagonistForce: text("antagonist_force"),
    stakes: text("stakes").notNull().default(""),
    storyDriver: text("story_driver").notNull().default("growth_reversal"),
    emotionalAxesJson: text("emotional_axes_json").notNull().default("[]"),
    differentiatorsJson: text("differentiators_json").notNull().default("[]"),
    risksJson: text("risks_json").notNull().default("[]"),
    status: text("status").notNull().default("draft"),
    version: integer("version").notNull().default(1),
    sourceArtifactId: text("source_artifact_id"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("story_blueprints_project_id_idx").on(table.projectId),
    index("story_blueprints_status_idx").on(table.projectId, table.status),
  ],
);

export const powerSystems = sqliteTable(
  "power_systems",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: text("kind").notNull().default("other"),
    source: text("source"),
    cost: text("cost"),
    levelsJson: text("levels_json").notNull().default("[]"),
    taboosJson: text("taboos_json").notNull().default("[]"),
    conflictHooksJson: text("conflict_hooks_json").notNull().default("[]"),
    status: text("status").notNull().default("draft"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("power_systems_project_id_idx").on(table.projectId),
    index("power_systems_kind_idx").on(table.projectId, table.kind),
  ],
);

export const characterRelations = sqliteTable(
  "character_relations",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    sourceCharacterId: text("source_character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    targetCharacterId: text("target_character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    relationType: text("relation_type").notNull(),
    publicLabel: text("public_label"),
    hiddenLabel: text("hidden_label"),
    tension: integer("tension").notNull().default(3),
    status: text("status").notNull().default("draft"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("character_relations_project_id_idx").on(table.projectId),
    index("character_relations_source_idx").on(table.sourceCharacterId),
    index("character_relations_target_idx").on(table.targetCharacterId),
  ],
);

export const characterArcs = sqliteTable(
  "character_arcs",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    characterId: text("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    startState: text("start_state").notNull(),
    falseBelief: text("false_belief"),
    desire: text("desire"),
    need: text("need"),
    turningPointsJson: text("turning_points_json").notNull().default("[]"),
    endState: text("end_state"),
    status: text("status").notNull().default("planned"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("character_arcs_project_id_idx").on(table.projectId),
    index("character_arcs_character_id_idx").on(table.characterId),
  ],
);

export const conflicts = sqliteTable(
  "conflicts",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    conflictType: text("conflict_type").notNull(),
    opposingForcesJson: text("opposing_forces_json").notNull().default("[]"),
    stakes: text("stakes").notNull(),
    escalationPathJson: text("escalation_path_json").notNull().default("[]"),
    relatedPlotlineId: text("related_plotline_id"),
    status: text("status").notNull().default("planned"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("conflicts_project_id_idx").on(table.projectId),
    index("conflicts_status_idx").on(table.projectId, table.status),
  ],
);

export const outlines = sqliteTable(
  "outlines",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    scope: text("scope").notNull().default("chapter_batch"),
    basisJson: text("basis_json").notNull().default("{}"),
    status: text("status").notNull().default("draft"),
    version: integer("version").notNull().default(1),
    sourceArtifactId: text("source_artifact_id"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("outlines_project_id_idx").on(table.projectId),
    index("outlines_status_idx").on(table.projectId, table.status),
  ],
);

export const volumeOutlines = sqliteTable(
  "volume_outlines",
  {
    id: text("id").primaryKey(),
    outlineId: text("outline_id")
      .notNull()
      .references(() => outlines.id, { onDelete: "cascade" }),
    volumeId: text("volume_id").references(() => volumes.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    purpose: text("purpose").notNull(),
    majorConflict: text("major_conflict"),
    climax: text("climax"),
    wordCountGoal: integer("word_count_goal"),
    sortOrder: integer("sort_order").notNull(),
    status: text("status").notNull().default("draft"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("volume_outlines_outline_id_idx").on(table.outlineId),
    index("volume_outlines_sort_order_idx").on(table.outlineId, table.sortOrder),
  ],
);

export const chapterOutlines = sqliteTable(
  "chapter_outlines",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    outlineId: text("outline_id")
      .notNull()
      .references(() => outlines.id, { onDelete: "cascade" }),
    volumeOutlineId: text("volume_outline_id").references(() => volumeOutlines.id, {
      onDelete: "set null",
    }),
    chapterId: text("chapter_id").references(() => chapters.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    chapterGoal: text("chapter_goal").notNull(),
    conflict: text("conflict"),
    informationGain: text("information_gain"),
    emotionalTurn: text("emotional_turn"),
    hook: text("hook"),
    requiredCharacterIdsJson: text("required_character_ids_json").notNull().default("[]"),
    requiredLocationIdsJson: text("required_location_ids_json").notNull().default("[]"),
    relatedPlotlineNodeIdsJson: text("related_plotline_node_ids_json").notNull().default("[]"),
    relatedForeshadowingIdsJson: text("related_foreshadowing_ids_json").notNull().default("[]"),
    targetWordCount: integer("target_word_count"),
    sortOrder: integer("sort_order").notNull(),
    status: text("status").notNull().default("draft"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("chapter_outlines_project_id_idx").on(table.projectId),
    index("chapter_outlines_outline_order_idx").on(table.outlineId, table.sortOrder),
    index("chapter_outlines_status_idx").on(table.projectId, table.status),
    index("chapter_outlines_chapter_id_idx").on(table.chapterId),
  ],
);

export const sceneOutlines = sqliteTable(
  "scene_outlines",
  {
    id: text("id").primaryKey(),
    chapterOutlineId: text("chapter_outline_id")
      .notNull()
      .references(() => chapterOutlines.id, { onDelete: "cascade" }),
    sceneId: text("scene_id").references(() => scenes.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    purpose: text("purpose").notNull(),
    beatType: text("beat_type").notNull(),
    povCharacterId: text("pov_character_id"),
    locationId: text("location_id"),
    conflict: text("conflict"),
    entryState: text("entry_state"),
    exitState: text("exit_state"),
    sortOrder: integer("sort_order").notNull(),
    status: text("status").notNull().default("draft"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("scene_outlines_chapter_outline_id_idx").on(table.chapterOutlineId),
    index("scene_outlines_sort_order_idx").on(table.chapterOutlineId, table.sortOrder),
  ],
);

export const bookPlans = sqliteTable(
  "book_plans",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    targetWordCount: integer("target_word_count").notNull(),
    corePromise: text("core_promise").notNull(),
    endingDirection: text("ending_direction"),
    mainPlotlineId: text("main_plotline_id"),
    status: text("status").notNull().default("draft"),
    version: integer("version").notNull().default(1),
    sourceArtifactId: text("source_artifact_id"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("book_plans_project_id_idx").on(table.projectId),
    index("book_plans_status_idx").on(table.projectId, table.status),
  ],
);

export const volumePlans = sqliteTable(
  "volume_plans",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    bookPlanId: text("book_plan_id")
      .notNull()
      .references(() => bookPlans.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    volumeIndex: integer("volume_index").notNull(),
    purpose: text("purpose").notNull(),
    majorConflict: text("major_conflict").notNull(),
    climax: text("climax"),
    targetWordCount: integer("target_word_count").notNull(),
    status: text("status").notNull().default("draft"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("volume_plans_project_id_idx").on(table.projectId),
    index("volume_plans_book_plan_idx").on(table.bookPlanId, table.volumeIndex),
  ],
);

export const arcPlans = sqliteTable(
  "arc_plans",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    volumePlanId: text("volume_plan_id")
      .notNull()
      .references(() => volumePlans.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    arcIndex: integer("arc_index").notNull(),
    plotlineId: text("plotline_id"),
    characterArcId: text("character_arc_id"),
    startChapterIndex: integer("start_chapter_index"),
    endChapterIndex: integer("end_chapter_index"),
    purpose: text("purpose").notNull(),
    escalationJson: text("escalation_json").notNull().default("[]"),
    status: text("status").notNull().default("draft"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("arc_plans_project_id_idx").on(table.projectId),
    index("arc_plans_volume_plan_idx").on(table.volumePlanId, table.arcIndex),
  ],
);

export const chapterPlans = sqliteTable(
  "chapter_plans",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    arcPlanId: text("arc_plan_id").references(() => arcPlans.id, { onDelete: "set null" }),
    chapterId: text("chapter_id").references(() => chapters.id, { onDelete: "set null" }),
    chapterIndex: integer("chapter_index").notNull(),
    title: text("title").notNull(),
    chapterGoal: text("chapter_goal").notNull(),
    conflict: text("conflict").notNull(),
    informationGain: text("information_gain").notNull(),
    emotionalTurn: text("emotional_turn").notNull(),
    hook: text("hook").notNull(),
    targetWordCount: integer("target_word_count").notNull(),
    relatedPlotlineIdsJson: text("related_plotline_ids_json").notNull().default("[]"),
    relatedCharacterIdsJson: text("related_character_ids_json").notNull().default("[]"),
    relatedForeshadowingIdsJson: text("related_foreshadowing_ids_json").notNull().default("[]"),
    status: text("status").notNull().default("draft"),
    version: integer("version").notNull().default(1),
    sourceArtifactId: text("source_artifact_id"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("chapter_plans_project_id_idx").on(table.projectId),
    index("chapter_plans_arc_plan_idx").on(table.arcPlanId, table.chapterIndex),
    index("chapter_plans_chapter_idx").on(table.chapterId),
    index("chapter_plans_status_idx").on(table.projectId, table.status),
  ],
);

export const chapterExecutionCards = sqliteTable(
  "chapter_execution_cards",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    chapterPlanId: text("chapter_plan_id")
      .notNull()
      .references(() => chapterPlans.id, { onDelete: "cascade" }),
    chapterId: text("chapter_id").references(() => chapters.id, { onDelete: "set null" }),
    chapterIndex: integer("chapter_index").notNull(),
    title: text("title").notNull(),
    narrativeGoal: text("narrative_goal").notNull(),
    coreConflict: text("core_conflict").notNull(),
    informationGain: text("information_gain").notNull(),
    emotionalTurn: text("emotional_turn").notNull(),
    readerReward: text("reader_reward").notNull(),
    hook: text("hook").notNull(),
    povCharacterId: text("pov_character_id"),
    requiredCharacterIdsJson: text("required_character_ids_json").notNull().default("[]"),
    requiredLocationIdsJson: text("required_location_ids_json").notNull().default("[]"),
    relatedPlotlineIdsJson: text("related_plotline_ids_json").notNull().default("[]"),
    relatedForeshadowingIdsJson: text("related_foreshadowing_ids_json").notNull().default("[]"),
    relatedPlotDebtIdsJson: text("related_plot_debt_ids_json").notNull().default("[]"),
    sceneBriefJson: text("scene_brief_json").notNull().default("[]"),
    forbiddenMovesJson: text("forbidden_moves_json").notNull().default("[]"),
    targetWordCount: integer("target_word_count").notNull(),
    status: text("status").notNull().default("draft"),
    version: integer("version").notNull().default(1),
    sourceArtifactId: text("source_artifact_id"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("chapter_execution_cards_project_id_idx").on(table.projectId),
    index("chapter_execution_cards_chapter_plan_idx").on(table.chapterPlanId),
    index("chapter_execution_cards_chapter_idx").on(table.chapterId),
    index("chapter_execution_cards_status_idx").on(table.projectId, table.status),
  ],
);

export const storyStateSnapshots = sqliteTable(
  "story_state_snapshots",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    chapterId: text("chapter_id").references(() => chapters.id, { onDelete: "set null" }),
    chapterIndex: integer("chapter_index").notNull(),
    storyTime: text("story_time"),
    currentVolumeId: text("current_volume_id"),
    currentArcPlanId: text("current_arc_plan_id"),
    globalSituation: text("global_situation").notNull(),
    activeConflictsJson: text("active_conflicts_json").notNull().default("[]"),
    openQuestionsJson: text("open_questions_json").notNull().default("[]"),
    revealedInformationJson: text("revealed_information_json").notNull().default("[]"),
    hiddenInformationJson: text("hidden_information_json").notNull().default("[]"),
    resourceStateJson: text("resource_state_json").notNull().default("{}"),
    locationStateJson: text("location_state_json").notNull().default("{}"),
    organizationStateJson: text("organization_state_json").notNull().default("{}"),
    sourceChapterVersion: integer("source_chapter_version"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("story_state_snapshots_project_id_idx").on(table.projectId),
    index("story_state_snapshots_chapter_idx").on(table.projectId, table.chapterIndex),
  ],
);

export const characterStateSnapshots = sqliteTable(
  "character_state_snapshots",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    characterId: text("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    chapterId: text("chapter_id").references(() => chapters.id, { onDelete: "set null" }),
    chapterIndex: integer("chapter_index").notNull(),
    externalGoal: text("external_goal").notNull().default(""),
    internalNeed: text("internal_need").notNull().default(""),
    physicalState: text("physical_state").notNull().default(""),
    emotionalState: text("emotional_state").notNull().default(""),
    knowledgeState: text("knowledge_state").notNull().default(""),
    relationshipStateJson: text("relationship_state_json").notNull().default("{}"),
    resourceStateJson: text("resource_state_json").notNull().default("{}"),
    secretsJson: text("secrets_json").notNull().default("[]"),
    position: text("position").notNull().default(""),
    riskFlagsJson: text("risk_flags_json").notNull().default("[]"),
    sourceType: text("source_type").notNull(),
    sourceId: text("source_id").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("character_state_snapshots_project_id_idx").on(table.projectId),
    index("character_state_snapshots_character_idx").on(
      table.projectId,
      table.characterId,
      table.chapterIndex,
    ),
  ],
);

export const plotDebts = sqliteTable(
  "plot_debts",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    debtType: text("debt_type").notNull(),
    promise: text("promise").notNull(),
    seedChapterIndex: integer("seed_chapter_index"),
    expectedPayoffChapterIndex: integer("expected_payoff_chapter_index"),
    actualPayoffChapterIndex: integer("actual_payoff_chapter_index"),
    status: text("status").notNull().default("open"),
    riskLevel: text("risk_level").notNull().default("medium"),
    relatedPlotlineId: text("related_plotline_id"),
    relatedCharacterIdsJson: text("related_character_ids_json").notNull().default("[]"),
    relatedForeshadowingId: text("related_foreshadowing_id"),
    relatedWorldRuleIdsJson: text("related_world_rule_ids_json").notNull().default("[]"),
    lifecycleNotesJson: text("lifecycle_notes_json").notNull().default("[]"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("plot_debts_project_id_idx").on(table.projectId),
    index("plot_debts_status_idx").on(table.projectId, table.status),
    index("plot_debts_risk_idx").on(table.projectId, table.riskLevel),
  ],
);

export const serialReviews = sqliteTable(
  "serial_reviews",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    scope: text("scope").notNull(),
    startChapterIndex: integer("start_chapter_index").notNull(),
    endChapterIndex: integer("end_chapter_index").notNull(),
    progressSummary: text("progress_summary").notNull(),
    promiseDeliveryJson: text("promise_delivery_json").notNull().default("[]"),
    rhythmReportJson: text("rhythm_report_json").notNull().default("{}"),
    repetitionRisksJson: text("repetition_risks_json").notNull().default("[]"),
    characterStagnationJson: text("character_stagnation_json").notNull().default("[]"),
    plotDebtRisksJson: text("plot_debt_risks_json").notNull().default("[]"),
    nextActionsJson: text("next_actions_json").notNull().default("[]"),
    status: text("status").notNull().default("applied"),
    sourceArtifactId: text("source_artifact_id"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("serial_reviews_project_id_idx").on(table.projectId),
    index("serial_reviews_scope_idx").on(table.projectId, table.scope),
    index("serial_reviews_chapter_range_idx").on(
      table.projectId,
      table.startChapterIndex,
      table.endChapterIndex,
    ),
    index("serial_reviews_status_idx").on(table.projectId, table.status),
  ],
);

export const scenePlans = sqliteTable(
  "scene_plans",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    chapterPlanId: text("chapter_plan_id")
      .notNull()
      .references(() => chapterPlans.id, { onDelete: "cascade" }),
    sceneIndex: integer("scene_index").notNull(),
    povCharacterId: text("pov_character_id"),
    locationId: text("location_id"),
    sceneGoal: text("scene_goal").notNull(),
    conflictTurn: text("conflict_turn").notNull(),
    outcome: text("outcome").notNull(),
    memoryTargetsJson: text("memory_targets_json").notNull().default("[]"),
    status: text("status").notNull().default("draft"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("scene_plans_project_id_idx").on(table.projectId),
    index("scene_plans_chapter_plan_idx").on(table.chapterPlanId, table.sceneIndex),
  ],
);

export const reviewIssues = sqliteTable(
  "review_issues",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    issueType: text("issue_type").notNull(),
    severity: text("severity").notNull().default("info"),
    message: text("message").notNull(),
    evidenceJson: text("evidence_json").notNull().default("{}"),
    suggestedFixJson: text("suggested_fix_json"),
    status: text("status").notNull().default("open"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("review_issues_project_id_idx").on(table.projectId),
    index("review_issues_target_idx").on(table.targetType, table.targetId),
    index("review_issues_status_idx").on(table.projectId, table.status),
  ],
);

export const retrospectives = sqliteTable(
  "retrospectives",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    scope: text("scope").notNull(),
    scopeRefJson: text("scope_ref_json").notNull().default("{}"),
    progressSummary: text("progress_summary").notNull(),
    deviationReportJson: text("deviation_report_json").notNull().default("{}"),
    unresolvedItemsJson: text("unresolved_items_json").notNull().default("[]"),
    nextActionsJson: text("next_actions_json").notNull().default("[]"),
    status: text("status").notNull().default("draft"),
    sourceArtifactId: text("source_artifact_id"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("retrospectives_project_id_idx").on(table.projectId),
    index("retrospectives_status_idx").on(table.projectId, table.status),
  ],
);
