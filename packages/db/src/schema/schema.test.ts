import { describe, expect, it } from "vitest";

import { schemaTableNames } from "./index.js";

describe("project schema", () => {
  it("contains the MVP source tables", () => {
    expect(schemaTableNames).toEqual(
      expect.arrayContaining([
        "projects",
        "works",
        "volumes",
        "chapters",
        "chapter_versions",
        "scenes",
        "characters",
        "character_traits",
        "entity_relations",
        "worldbuilding_profiles",
        "world_rules",
        "locations",
        "organizations",
        "items",
        "plotlines",
        "plotline_nodes",
        "story_events",
        "event_participants",
        "event_relations",
        "foreshadowings",
        "foreshadowing_events",
        "work_orders",
        "workflow_runs",
        "workflow_steps",
        "artifacts",
        "ai_capabilities",
        "prompt_versions",
        "quality_reports",
        "ai_eval_runs",
        "memory_candidates",
        "memories",
        "model_calls",
        "context_packages",
        "context_package_items",
        "files",
        "domain_events",
        "projection_checkpoints",
        "creative_stages",
        "project_briefs",
        "story_blueprints",
        "power_systems",
        "character_relations",
        "character_arcs",
        "conflicts",
        "outlines",
        "volume_outlines",
        "chapter_outlines",
        "scene_outlines",
        "book_plans",
        "volume_plans",
        "arc_plans",
        "chapter_plans",
        "scene_plans",
        "review_issues",
        "retrospectives",
      ]),
    );
  });

  it("does not expose duplicate table names", () => {
    expect(new Set(schemaTableNames).size).toBe(schemaTableNames.length);
  });
});
