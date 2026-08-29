export const INITIAL_PROJECT_SCHEMA_MIGRATION_ID = "0001_project_schema_v1";

export const WORLDBUILDING_PROFILE_SCHEMA_SQL = `
create table if not exists worldbuilding_profiles (
  project_id text primary key references projects(id) on delete cascade,
  world_base text not null default '',
  geography text not null default '',
  history text not null default '',
  power_system text not null default '',
  social_structure text not null default '',
  power_order text not null default '',
  factions text not null default '',
  economy text not null default '',
  culture text not null default '',
  rules text not null default '',
  special_mechanism text not null default '',
  core_conflict text not null default '',
  created_at integer not null,
  updated_at integer not null
);
`;

export const CREATIVE_PATH_SCHEMA_SQL = `
create table if not exists creative_stages (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  stage_key text not null,
  status text not null default 'locked',
  readiness_score integer not null default 0,
  gate_report_json text not null default '{}',
  current_work_order_id text,
  completed_at integer,
  created_at integer not null,
  updated_at integer not null,
  unique (project_id, stage_key)
);

create table if not exists project_briefs (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  genre text not null,
  subgenres_json text not null default '[]',
  target_audience text,
  platform_profile text,
  length_profile text,
  estimated_word_count integer,
  estimated_chapter_count integer,
  narrative_pov text,
  emotional_rewards_json text not null default '[]',
  initial_idea text,
  forbidden_directions_json text not null default '[]',
  status text not null default 'draft',
  version integer not null default 1,
  created_at integer not null,
  updated_at integer not null
);

create table if not exists story_blueprints (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  premise text not null,
  logline text not null,
  core_promise text not null,
  main_goal text not null default '',
  main_conflict text not null,
  protagonist_arc text,
  antagonist_force text,
  stakes text not null default '',
  story_driver text not null default 'growth_reversal',
  emotional_axes_json text not null default '[]',
  differentiators_json text not null default '[]',
  risks_json text not null default '[]',
  status text not null default 'draft',
  version integer not null default 1,
  source_artifact_id text,
  created_at integer not null,
  updated_at integer not null
);

create table if not exists power_systems (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  name text not null,
  kind text not null default 'other',
  source text,
  cost text,
  levels_json text not null default '[]',
  taboos_json text not null default '[]',
  conflict_hooks_json text not null default '[]',
  status text not null default 'draft',
  created_at integer not null,
  updated_at integer not null
);

create table if not exists character_relations (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  source_character_id text not null references characters(id) on delete cascade,
  target_character_id text not null references characters(id) on delete cascade,
  relation_type text not null,
  public_label text,
  hidden_label text,
  tension integer not null default 3,
  status text not null default 'draft',
  created_at integer not null,
  updated_at integer not null
);

create table if not exists character_arcs (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  character_id text not null references characters(id) on delete cascade,
  start_state text not null,
  false_belief text,
  desire text,
  need text,
  turning_points_json text not null default '[]',
  end_state text,
  status text not null default 'planned',
  created_at integer not null,
  updated_at integer not null
);

create table if not exists conflicts (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  title text not null,
  conflict_type text not null,
  opposing_forces_json text not null default '[]',
  stakes text not null,
  escalation_path_json text not null default '[]',
  related_plotline_id text,
  status text not null default 'planned',
  created_at integer not null,
  updated_at integer not null
);

create table if not exists outlines (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  title text not null,
  scope text not null default 'chapter_batch',
  basis_json text not null default '{}',
  status text not null default 'draft',
  version integer not null default 1,
  source_artifact_id text,
  created_at integer not null,
  updated_at integer not null
);

create table if not exists volume_outlines (
  id text primary key,
  outline_id text not null references outlines(id) on delete cascade,
  volume_id text references volumes(id) on delete set null,
  title text not null,
  purpose text not null,
  major_conflict text,
  climax text,
  word_count_goal integer,
  sort_order integer not null,
  status text not null default 'draft',
  created_at integer not null,
  updated_at integer not null
);

create table if not exists chapter_outlines (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  outline_id text not null references outlines(id) on delete cascade,
  volume_outline_id text references volume_outlines(id) on delete set null,
  chapter_id text references chapters(id) on delete set null,
  title text not null,
  chapter_goal text not null,
  conflict text,
  information_gain text,
  emotional_turn text,
  hook text,
  required_character_ids_json text not null default '[]',
  required_location_ids_json text not null default '[]',
  related_plotline_node_ids_json text not null default '[]',
  related_foreshadowing_ids_json text not null default '[]',
  target_word_count integer,
  sort_order integer not null,
  status text not null default 'draft',
  created_at integer not null,
  updated_at integer not null
);

create table if not exists scene_outlines (
  id text primary key,
  chapter_outline_id text not null references chapter_outlines(id) on delete cascade,
  scene_id text references scenes(id) on delete set null,
  title text not null,
  purpose text not null,
  beat_type text not null,
  pov_character_id text,
  location_id text,
  conflict text,
  entry_state text,
  exit_state text,
  sort_order integer not null,
  status text not null default 'draft',
  created_at integer not null,
  updated_at integer not null
);

create table if not exists book_plans (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  title text not null,
  target_word_count integer not null,
  core_promise text not null,
  ending_direction text,
  main_plotline_id text,
  status text not null default 'draft',
  version integer not null default 1,
  source_artifact_id text,
  created_at integer not null,
  updated_at integer not null
);

create table if not exists volume_plans (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  book_plan_id text not null references book_plans(id) on delete cascade,
  title text not null,
  volume_index integer not null,
  purpose text not null,
  major_conflict text not null,
  climax text,
  target_word_count integer not null,
  status text not null default 'draft',
  created_at integer not null,
  updated_at integer not null
);

create table if not exists arc_plans (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  volume_plan_id text not null references volume_plans(id) on delete cascade,
  title text not null,
  arc_index integer not null,
  plotline_id text,
  character_arc_id text,
  start_chapter_index integer,
  end_chapter_index integer,
  purpose text not null,
  escalation_json text not null default '[]',
  status text not null default 'draft',
  created_at integer not null,
  updated_at integer not null
);

create table if not exists chapter_plans (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  arc_plan_id text references arc_plans(id) on delete set null,
  chapter_id text references chapters(id) on delete set null,
  chapter_index integer not null,
  title text not null,
  chapter_goal text not null,
  conflict text not null,
  information_gain text not null,
  emotional_turn text not null,
  hook text not null,
  target_word_count integer not null,
  related_plotline_ids_json text not null default '[]',
  related_character_ids_json text not null default '[]',
  related_foreshadowing_ids_json text not null default '[]',
  status text not null default 'draft',
  version integer not null default 1,
  source_artifact_id text,
  created_at integer not null,
  updated_at integer not null
);

create table if not exists scene_plans (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  chapter_plan_id text not null references chapter_plans(id) on delete cascade,
  scene_index integer not null,
  pov_character_id text,
  location_id text,
  scene_goal text not null,
  conflict_turn text not null,
  outcome text not null,
  memory_targets_json text not null default '[]',
  status text not null default 'draft',
  created_at integer not null,
  updated_at integer not null
);

create table if not exists review_issues (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  target_type text not null,
  target_id text not null,
  issue_type text not null,
  severity text not null default 'info',
  message text not null,
  evidence_json text not null default '{}',
  suggested_fix_json text,
  status text not null default 'open',
  created_at integer not null,
  updated_at integer not null
);

create table if not exists retrospectives (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  scope text not null,
  scope_ref_json text not null default '{}',
  progress_summary text not null,
  deviation_report_json text not null default '{}',
  unresolved_items_json text not null default '[]',
  next_actions_json text not null default '[]',
  status text not null default 'draft',
  source_artifact_id text,
  created_at integer not null,
  updated_at integer not null
);

create index if not exists creative_stages_project_id_idx on creative_stages(project_id);
create index if not exists creative_stages_stage_key_idx on creative_stages(project_id, stage_key);
create index if not exists project_briefs_project_id_idx on project_briefs(project_id);
create index if not exists project_briefs_status_idx on project_briefs(project_id, status);
create index if not exists story_blueprints_project_id_idx on story_blueprints(project_id);
create index if not exists story_blueprints_status_idx on story_blueprints(project_id, status);
create index if not exists power_systems_project_id_idx on power_systems(project_id);
create index if not exists power_systems_kind_idx on power_systems(project_id, kind);
create index if not exists character_relations_project_id_idx on character_relations(project_id);
create index if not exists character_relations_source_idx on character_relations(source_character_id);
create index if not exists character_relations_target_idx on character_relations(target_character_id);
create index if not exists character_arcs_project_id_idx on character_arcs(project_id);
create index if not exists character_arcs_character_id_idx on character_arcs(character_id);
create index if not exists conflicts_project_id_idx on conflicts(project_id);
create index if not exists conflicts_status_idx on conflicts(project_id, status);
create index if not exists outlines_project_id_idx on outlines(project_id);
create index if not exists outlines_status_idx on outlines(project_id, status);
create index if not exists volume_outlines_outline_id_idx on volume_outlines(outline_id);
create index if not exists volume_outlines_sort_order_idx on volume_outlines(outline_id, sort_order);
create index if not exists chapter_outlines_project_id_idx on chapter_outlines(project_id);
create index if not exists chapter_outlines_outline_order_idx on chapter_outlines(outline_id, sort_order);
create index if not exists chapter_outlines_status_idx on chapter_outlines(project_id, status);
create index if not exists chapter_outlines_chapter_id_idx on chapter_outlines(chapter_id);
create index if not exists scene_outlines_chapter_outline_id_idx on scene_outlines(chapter_outline_id);
create index if not exists scene_outlines_sort_order_idx on scene_outlines(chapter_outline_id, sort_order);
create index if not exists book_plans_project_id_idx on book_plans(project_id);
create index if not exists book_plans_status_idx on book_plans(project_id, status);
create index if not exists volume_plans_project_id_idx on volume_plans(project_id);
create index if not exists volume_plans_book_plan_idx on volume_plans(book_plan_id, volume_index);
create index if not exists arc_plans_project_id_idx on arc_plans(project_id);
create index if not exists arc_plans_volume_plan_idx on arc_plans(volume_plan_id, arc_index);
create index if not exists chapter_plans_project_id_idx on chapter_plans(project_id);
create index if not exists chapter_plans_arc_plan_idx on chapter_plans(arc_plan_id, chapter_index);
create index if not exists chapter_plans_chapter_idx on chapter_plans(chapter_id);
create index if not exists chapter_plans_status_idx on chapter_plans(project_id, status);
create index if not exists scene_plans_project_id_idx on scene_plans(project_id);
create index if not exists scene_plans_chapter_plan_idx on scene_plans(chapter_plan_id, scene_index);
create index if not exists review_issues_project_id_idx on review_issues(project_id);
create index if not exists review_issues_target_idx on review_issues(target_type, target_id);
create index if not exists review_issues_status_idx on review_issues(project_id, status);
create index if not exists retrospectives_project_id_idx on retrospectives(project_id);
create index if not exists retrospectives_status_idx on retrospectives(project_id, status);
`;

export const INITIAL_PROJECT_SCHEMA_SQL = `
create table if not exists projects (
  id text primary key,
  title text not null,
  genre text not null,
  style text,
  status text not null default 'planning',
  summary text,
  root_path text not null,
  created_at integer not null,
  updated_at integer not null,
  opened_at integer
);

create table if not exists works (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  title text not null,
  genre text not null,
  style text,
  target_length integer,
  status text not null default 'planning',
  logline text,
  created_at integer not null,
  updated_at integer not null
);

create table if not exists volumes (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  work_id text not null references works(id) on delete cascade,
  title text not null,
  position integer not null,
  summary text,
  created_at integer not null,
  updated_at integer not null
);

create table if not exists chapters (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  work_id text not null references works(id) on delete cascade,
  volume_id text references volumes(id) on delete set null,
  title text not null,
  status text not null default 'draft',
  position integer not null,
  synopsis text,
  content text not null default '',
  word_count integer not null default 0,
  version integer not null default 0,
  created_at integer not null,
  updated_at integer not null
);

create table if not exists chapter_versions (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  chapter_id text not null references chapters(id) on delete cascade,
  version integer not null,
  source text not null,
  artifact_id text references artifacts(id) on delete set null,
  content text not null,
  summary text,
  created_at integer not null,
  unique (chapter_id, version)
);

create table if not exists scenes (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  chapter_id text not null references chapters(id) on delete cascade,
  title text not null,
  position integer not null,
  pov_character_id text,
  location_id text,
  summary text,
  status text not null default 'planned',
  created_at integer not null,
  updated_at integer not null
);

create table if not exists characters (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  display_name text not null,
  role text not null default 'supporting',
  archetype text,
  gender_age text,
  importance text,
  first_appearance text,
  narrative_function text,
  story_task text,
  relationship_hook text,
  status text not null default 'active',
  profile text,
  appearance text,
  arc_start text,
  arc_turn text,
  arc_end text,
  motivation text,
  created_at integer not null,
  updated_at integer not null
);

create table if not exists character_traits (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  character_id text not null references characters(id) on delete cascade,
  name text not null,
  value text not null,
  evidence text,
  confidence real not null default 1,
  created_at integer not null,
  updated_at integer not null
);

create table if not exists entity_relations (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  source_entity_type text not null,
  source_entity_id text not null,
  relation_type text not null,
  target_entity_type text not null,
  target_entity_id text not null,
  description text,
  polarity integer not null default 0,
  strength real not null default 0.5,
  status text not null default 'confirmed',
  evidence text,
  created_at integer not null,
  updated_at integer not null
);

${WORLDBUILDING_PROFILE_SCHEMA_SQL}

create table if not exists world_rules (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  category text not null,
  title text not null,
  content text not null,
  status text not null default 'canon',
  source text,
  created_at integer not null,
  updated_at integer not null
);

create table if not exists locations (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  name text not null,
  type text not null default 'place',
  description text,
  status text not null default 'active',
  created_at integer not null,
  updated_at integer not null
);

create table if not exists organizations (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  name text not null,
  type text not null default 'organization',
  description text,
  status text not null default 'active',
  created_at integer not null,
  updated_at integer not null
);

create table if not exists items (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  name text not null,
  type text not null default 'item',
  description text,
  owner_entity_type text,
  owner_entity_id text,
  status text not null default 'active',
  created_at integer not null,
  updated_at integer not null
);

create table if not exists plotlines (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  name text not null,
  type text not null default 'main',
  status text not null default 'planning',
  narrative_role text not null default 'main_drive',
  importance text not null default 'major',
  summary text,
  central_question text,
  driver text,
  start_state text,
  mid_escalation text,
  payoff_plan text,
  emotional_promise text,
  related_character_ids_json text not null default '[]',
  related_world_rule_ids_json text not null default '[]',
  related_foreshadowing_ids_json text not null default '[]',
  related_story_event_ids_json text not null default '[]',
  priority integer not null default 0,
  created_at integer not null,
  updated_at integer not null
);

create table if not exists plotline_nodes (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  plotline_id text not null references plotlines(id) on delete cascade,
  title text not null,
  position integer not null,
  kind text not null default 'beat',
  status text not null default 'planned',
  description text,
  chapter_hint text,
  target_chapter_id text references chapters(id) on delete set null,
  created_at integer not null,
  updated_at integer not null
);

create table if not exists story_events (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  title text not null,
  event_type text not null default 'plot',
  event_time text,
  position integer not null default 0,
  summary text not null,
  causal_importance real not null default 0.5,
  chapter_id text references chapters(id) on delete set null,
  scene_id text references scenes(id) on delete set null,
  status text not null default 'canon',
  created_at integer not null,
  updated_at integer not null
);

create table if not exists event_participants (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  event_id text not null references story_events(id) on delete cascade,
  entity_type text not null,
  entity_id text not null,
  role text not null default 'participant',
  created_at integer not null
);

create table if not exists event_relations (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  source_event_id text not null references story_events(id) on delete cascade,
  relation_type text not null,
  target_event_id text not null references story_events(id) on delete cascade,
  description text,
  created_at integer not null
);

create table if not exists foreshadowings (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  title text not null,
  status text not null default 'seeded',
  seed_text text,
  payoff_text text,
  created_at integer not null,
  updated_at integer not null
);

create table if not exists foreshadowing_events (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  foreshadowing_id text not null references foreshadowings(id) on delete cascade,
  event_id text not null references story_events(id) on delete cascade,
  role text not null,
  note text,
  created_at integer not null
);

create table if not exists work_orders (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  type text not null,
  status text not null default 'queued',
  title text not null,
  description text,
  created_by text not null default 'user',
  created_at integer not null,
  updated_at integer not null
);

create table if not exists workflow_runs (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  work_order_id text references work_orders(id) on delete set null,
  workflow_name text not null,
  status text not null default 'queued',
  input text,
  output text,
  error text,
  started_at integer,
  completed_at integer,
  created_at integer not null,
  updated_at integer not null
);

create table if not exists workflow_steps (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  workflow_run_id text not null references workflow_runs(id) on delete cascade,
  name text not null,
  status text not null default 'queued',
  input text,
  output text,
  error text,
  started_at integer,
  completed_at integer,
  created_at integer not null
);

create table if not exists artifacts (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  work_order_id text references work_orders(id) on delete set null,
  workflow_run_id text references workflow_runs(id) on delete set null,
  kind text not null,
  target_type text,
  target_id text,
  status text not null default 'pending',
  title text not null,
  body text not null,
  metadata text,
  created_at integer not null,
  updated_at integer not null,
  applied_at integer
);

create table if not exists model_calls (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  workflow_run_id text references workflow_runs(id) on delete set null,
  step_id text references workflow_steps(id) on delete set null,
  provider text not null,
  model text not null,
  purpose text not null,
  prompt_version text,
  request text not null,
  response text,
  usage text,
  status text not null default 'completed',
  error text,
  latency_ms integer,
  created_at integer not null
);

create table if not exists ai_capabilities (
  key text primary key,
  display_name text not null,
  status text not null default 'active',
  default_prompt_version text not null,
  output_schema_name text not null,
  created_at integer not null,
  updated_at integer not null
);

create table if not exists prompt_versions (
  id text primary key,
  capability_key text not null,
  version text not null,
  prompt_hash text not null,
  content text not null,
  status text not null default 'active',
  created_at integer not null
);

create table if not exists quality_reports (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  target_type text not null,
  target_id text not null,
  score integer not null,
  dimensions_json text not null,
  issues_json text not null,
  model_call_id text references model_calls(id) on delete set null,
  created_at integer not null
);

create table if not exists ai_eval_runs (
  id text primary key,
  capability_key text not null,
  prompt_version text not null,
  fixture_id text not null,
  score integer not null,
  result_json text not null,
  created_at integer not null
);

create table if not exists memory_candidates (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  source_type text not null,
  source_id text not null,
  entity_type text not null,
  entity_id text,
  kind text not null,
  content text not null,
  confidence real not null default 0.5,
  status text not null default 'pending',
  proposed_relations text,
  model_call_id text references model_calls(id) on delete set null,
  created_at integer not null,
  resolved_at integer
);

create table if not exists memories (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  entity_type text not null,
  entity_id text,
  kind text not null,
  content text not null,
  scope text not null default 'project',
  valid_from_chapter_index integer,
  valid_to_chapter_index integer,
  source_type text,
  source_id text,
  source_quote text,
  evidence_json text not null default '{}',
  source_candidate_id text references memory_candidates(id) on delete set null,
  confidence real not null default 1,
  status text not null default 'canon',
  supersedes_memory_id text,
  contradiction_group_id text,
  embedding_ref text,
  created_at integer not null,
  updated_at integer not null
);

create table if not exists context_packages (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  purpose text not null,
  target_type text,
  target_id text,
  input_hash text not null,
  created_at integer not null
);

create table if not exists context_package_items (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  context_package_id text not null references context_packages(id) on delete cascade,
  item_type text not null,
  item_id text not null,
  rank integer not null default 0,
  content text not null,
  metadata text
);

create table if not exists files (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  role text not null,
  relative_path text not null,
  mime_type text,
  size_bytes integer,
  checksum text,
  created_at integer not null,
  updated_at integer not null
);

create table if not exists domain_events (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  aggregate_type text not null,
  aggregate_id text not null,
  event_type text not null,
  payload text not null,
  created_at integer not null
);

create table if not exists projection_checkpoints (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  projection_name text not null,
  last_domain_event_id text,
  rebuilt_at integer,
  updated_at integer not null
);

${CREATIVE_PATH_SCHEMA_SQL}

create index if not exists projects_status_idx on projects(status);
create index if not exists projects_opened_at_idx on projects(opened_at);
create index if not exists works_project_id_idx on works(project_id);
create index if not exists volumes_work_position_idx on volumes(work_id, position);
create index if not exists chapters_work_position_idx on chapters(work_id, position);
create index if not exists chapter_versions_project_id_idx on chapter_versions(project_id);
create index if not exists scenes_chapter_position_idx on scenes(chapter_id, position);
create index if not exists characters_display_name_idx on characters(display_name);
create index if not exists character_traits_character_id_idx on character_traits(character_id);
create index if not exists entity_relations_source_idx on entity_relations(source_entity_type, source_entity_id);
create index if not exists entity_relations_target_idx on entity_relations(target_entity_type, target_entity_id);
create index if not exists world_rules_category_idx on world_rules(category);
create index if not exists locations_name_idx on locations(name);
create index if not exists organizations_name_idx on organizations(name);
create index if not exists items_name_idx on items(name);
create index if not exists plotlines_status_idx on plotlines(status);
create index if not exists plotline_nodes_plotline_position_idx on plotline_nodes(plotline_id, position);
create index if not exists story_events_position_idx on story_events(project_id, position);
create index if not exists event_participants_entity_idx on event_participants(entity_type, entity_id);
create index if not exists event_relations_source_idx on event_relations(source_event_id);
create index if not exists event_relations_target_idx on event_relations(target_event_id);
create index if not exists foreshadowings_status_idx on foreshadowings(status);
create index if not exists work_orders_status_idx on work_orders(status);
create index if not exists workflow_runs_status_idx on workflow_runs(status);
create index if not exists artifacts_target_idx on artifacts(target_type, target_id);
create index if not exists artifacts_status_idx on artifacts(status);
create index if not exists model_calls_purpose_idx on model_calls(purpose);
create index if not exists ai_capabilities_status_idx on ai_capabilities(status);
create index if not exists prompt_versions_capability_idx on prompt_versions(capability_key);
create index if not exists prompt_versions_hash_idx on prompt_versions(prompt_hash);
create index if not exists quality_reports_project_id_idx on quality_reports(project_id);
create index if not exists quality_reports_target_idx on quality_reports(target_type, target_id);
create index if not exists ai_eval_runs_capability_idx on ai_eval_runs(capability_key);
create index if not exists ai_eval_runs_fixture_idx on ai_eval_runs(fixture_id);
create index if not exists memory_candidates_status_idx on memory_candidates(status);
create index if not exists memory_candidates_entity_idx on memory_candidates(entity_type, entity_id);
create index if not exists memories_entity_idx on memories(entity_type, entity_id);
create index if not exists memories_kind_idx on memories(kind);
create index if not exists context_packages_target_idx on context_packages(target_type, target_id);
create index if not exists context_package_items_package_id_idx on context_package_items(context_package_id);
create index if not exists files_role_idx on files(role);
create index if not exists domain_events_aggregate_idx on domain_events(aggregate_type, aggregate_id);
create index if not exists domain_events_event_type_idx on domain_events(event_type);
create index if not exists projection_checkpoints_projection_name_idx on projection_checkpoints(projection_name);
`;
