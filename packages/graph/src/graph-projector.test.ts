import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createGraphStore } from "./graph-store.js";
import { GraphProjector } from "./projector/graph-projector.js";
import {
  getNeighborhood,
  listArtifactMemoryCandidates,
  listContradictions,
  listEventCauses,
  listOpenForeshadowings,
  listWorldRuleImpacts,
} from "./queries/neighborhood.js";
import { initializeGraphSchema } from "./schema.js";

describe("GraphProjector", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const tempDir of tempDirs.splice(0)) {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it("projects characters and confirmed relations into graph neighborhoods", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "story-pilot-graph-"));
    tempDirs.push(tempDir);
    const store = await createGraphStore(join(tempDir, "graph.kuzu"));

    try {
      await initializeGraphSchema(store);
      const projector = new GraphProjector(store);

      await projector.project({
        id: "event_1",
        projectId: "project_1",
        aggregateType: "character",
        aggregateId: "char_lc",
        eventType: "character.created",
        payload: {
          name: "林澈",
          role: "protagonist",
        },
      });
      await projector.project({
        id: "event_2",
        projectId: "project_1",
        aggregateType: "character",
        aggregateId: "char_zq",
        eventType: "character.created",
        payload: {
          name: "周潜",
          role: "antagonist",
        },
      });
      await projector.project({
        id: "event_3",
        projectId: "project_1",
        aggregateType: "entity_relation",
        aggregateId: "rel_1",
        eventType: "entity_relation.confirmed",
        payload: {
          sourceEntityId: "char_lc",
          sourceEntityType: "character",
          relationType: "suspects",
          targetEntityId: "char_zq",
          targetEntityType: "character",
        },
      });

      const neighborhood = await getNeighborhood(store, {
        projectId: "project_1",
        entityId: "char_lc",
      });

      expect(neighborhood.nodes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: "char_lc", label: "林澈", type: "character" }),
          expect.objectContaining({ id: "char_zq", label: "周潜", type: "character" }),
        ]),
      );
      expect(neighborhood.edges).toEqual([
        expect.objectContaining({
          label: "suspects",
          sourceId: "char_lc",
          targetId: "char_zq",
        }),
      ]);
    } finally {
      await store.close();
    }
  });

  it("projects foreshadowing seed and payoff links", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "story-pilot-graph-"));
    tempDirs.push(tempDir);
    const store = await createGraphStore(join(tempDir, "graph.kuzu"));

    try {
      await initializeGraphSchema(store);
      const projector = new GraphProjector(store);

      await projector.project({
        id: "event_1",
        projectId: "project_1",
        aggregateType: "story_event",
        aggregateId: "seed_event",
        eventType: "story_event.created",
        payload: {
          title: "旧报纸日期",
          eventType: "discovery",
          summary: "门缝下露出的旧报纸日期。",
        },
      });
      await projector.project({
        id: "event_2",
        projectId: "project_1",
        aggregateType: "story_event",
        aggregateId: "payoff_event",
        eventType: "story_event.created",
        payload: {
          title: "火灾真相",
          eventType: "reveal",
          summary: "旧报纸日期对应伪造报告当天。",
        },
      });
      await projector.project({
        id: "event_3",
        projectId: "project_1",
        aggregateType: "foreshadowing",
        aggregateId: "foreshadowing_1",
        eventType: "foreshadowing.seeded",
        payload: {
          title: "旧报纸日期",
          links: [
            { eventId: "seed_event", role: "seed" },
            { eventId: "payoff_event", role: "payoff" },
          ],
        },
      });

      const neighborhood = await getNeighborhood(store, {
        projectId: "project_1",
        entityId: "foreshadowing_1",
      });

      expect(neighborhood.nodes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "foreshadowing_1",
            label: "旧报纸日期",
            type: "foreshadowing",
          }),
          expect.objectContaining({ id: "seed_event", label: "旧报纸日期", type: "story_event" }),
          expect.objectContaining({ id: "payoff_event", label: "火灾真相", type: "story_event" }),
        ]),
      );
      expect(neighborhood.edges).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ label: "seeds", targetId: "seed_event" }),
          expect.objectContaining({ label: "pays_off", targetId: "payoff_event" }),
        ]),
      );
    } finally {
      await store.close();
    }
  });

  it("projects confirmed canon memories into entity neighborhoods", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "story-pilot-graph-"));
    tempDirs.push(tempDir);
    const store = await createGraphStore(join(tempDir, "graph.kuzu"));

    try {
      await initializeGraphSchema(store);
      const projector = new GraphProjector(store);

      await projector.project({
        aggregateId: "memory_1",
        aggregateType: "memory",
        eventType: "memory.confirmed",
        id: "event_1",
        payload: {
          content: "林鸢发现一封来自十年前的旧信。",
          entityId: "char_linyuan",
          entityType: "character",
          kind: "event",
          memoryId: "memory_1",
          status: "canon",
        },
        projectId: "project_1",
      });

      const neighborhood = await getNeighborhood(store, {
        entityId: "char_linyuan",
        projectId: "project_1",
      });

      expect(neighborhood.nodes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: "char_linyuan", type: "character" }),
          expect.objectContaining({
            id: "memory_1",
            label: "林鸢发现一封来自十年前的旧信。",
            type: "memory",
          }),
        ]),
      );
      expect(neighborhood.edges).toEqual([
        expect.objectContaining({
          label: "event",
          sourceId: "memory_1",
          targetId: "char_linyuan",
        }),
      ]);
    } finally {
      await store.close();
    }
  });

  it("returns two-hop character relationships", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "story-pilot-graph-"));
    tempDirs.push(tempDir);
    const store = await createGraphStore(join(tempDir, "graph.kuzu"));

    try {
      await initializeGraphSchema(store);
      const projector = new GraphProjector(store);

      for (const character of [
        ["char_a", "林鸢"],
        ["char_b", "顾晏"],
        ["char_c", "周潜"],
      ] as const) {
        await projector.project({
          aggregateId: character[0],
          aggregateType: "character",
          eventType: "character.created",
          id: `event_${character[0]}`,
          payload: { name: character[1], role: "support" },
          projectId: "project_1",
        });
      }
      await projector.project({
        aggregateId: "rel_ab",
        aggregateType: "entity_relation",
        eventType: "entity_relation.confirmed",
        id: "event_rel_ab",
        payload: {
          relationType: "knows",
          sourceEntityId: "char_a",
          sourceEntityType: "character",
          targetEntityId: "char_b",
          targetEntityType: "character",
        },
        projectId: "project_1",
      });
      await projector.project({
        aggregateId: "rel_bc",
        aggregateType: "entity_relation",
        eventType: "entity_relation.confirmed",
        id: "event_rel_bc",
        payload: {
          relationType: "protects",
          sourceEntityId: "char_b",
          sourceEntityType: "character",
          targetEntityId: "char_c",
          targetEntityType: "character",
        },
        projectId: "project_1",
      });

      const oneHop = await getNeighborhood(store, {
        depth: 1,
        entityId: "char_a",
        projectId: "project_1",
      });
      const twoHop = await getNeighborhood(store, {
        depth: 2,
        entityId: "char_a",
        projectId: "project_1",
      });

      expect(oneHop.nodes.map((node) => node.id)).not.toContain("char_c");
      expect(twoHop.nodes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: "char_a", type: "character" }),
          expect.objectContaining({ id: "char_b", type: "character" }),
          expect.objectContaining({ id: "char_c", type: "character" }),
        ]),
      );
      expect(twoHop.edges).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ label: "knows", sourceId: "char_a", targetId: "char_b" }),
          expect.objectContaining({ label: "protects", sourceId: "char_b", targetId: "char_c" }),
        ]),
      );
    } finally {
      await store.close();
    }
  });

  it("projects chapter elements, event causality, open foreshadowings, rule impacts and artifact candidates", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "story-pilot-graph-"));
    tempDirs.push(tempDir);
    const store = await createGraphStore(join(tempDir, "graph.kuzu"));

    try {
      await initializeGraphSchema(store);
      const projector = new GraphProjector(store);

      await projector.project({
        aggregateId: "chapter_1",
        aggregateType: "chapter",
        eventType: "chapter.created",
        id: "event_chapter_1",
        payload: { title: "第一章 雨夜来信" },
        projectId: "project_1",
      });
      await projector.project({
        aggregateId: "char_linyuan",
        aggregateType: "character",
        eventType: "character.created",
        id: "event_character_1",
        payload: { name: "林鸢", role: "protagonist" },
        projectId: "project_1",
      });
      await projector.project({
        aggregateId: "event_seed",
        aggregateType: "story_event",
        eventType: "story_event.created",
        id: "event_story_1",
        payload: {
          chapterId: "chapter_1",
          eventType: "discovery",
          locationId: "location_archive",
          locationName: "档案室",
          participants: [{ entityId: "char_linyuan", entityType: "character", role: "actor" }],
          summary: "林鸢在档案室发现旧报纸。",
          title: "旧报纸日期",
        },
        projectId: "project_1",
      });
      await projector.project({
        aggregateId: "event_cause",
        aggregateType: "story_event",
        eventType: "story_event.created",
        id: "event_story_2",
        payload: {
          eventType: "betrayal",
          summary: "顾晏十年前伪造报告。",
          title: "伪造报告",
        },
        projectId: "project_1",
      });
      await projector.project({
        aggregateId: "event_relation_1",
        aggregateType: "event_relation",
        eventType: "event_relation.confirmed",
        id: "event_causality_1",
        payload: {
          description: "伪造报告导致旧报纸日期成为线索。",
          relationType: "causes",
          sourceEventId: "event_cause",
          targetEventId: "event_seed",
        },
        projectId: "project_1",
      });
      await projector.project({
        aggregateId: "event_relation_2",
        aggregateType: "event_relation",
        eventType: "event_relation.confirmed",
        id: "event_causality_2",
        payload: {
          description: "旧报纸日期与伪造报告日期存在表面冲突。",
          relationType: "contradicts",
          sourceEventId: "event_seed",
          targetEventId: "event_cause",
        },
        projectId: "project_1",
      });
      await projector.project({
        aggregateId: "foreshadowing_1",
        aggregateType: "foreshadowing",
        eventType: "foreshadowing.seeded",
        id: "event_foreshadowing_1",
        payload: {
          links: [{ eventId: "event_seed", role: "seed" }],
          status: "seeded",
          title: "旧报纸日期",
        },
        projectId: "project_1",
      });
      await projector.project({
        aggregateId: "rule_1",
        aggregateType: "world_rule",
        eventType: "world_rule.created",
        id: "event_rule_1",
        payload: {
          category: "society",
          impactChapterIds: ["chapter_1"],
          impactEventIds: ["event_seed"],
          statement: "档案室只能在雨夜开放。",
          title: "档案室开放规则",
        },
        projectId: "project_1",
      });
      await projector.project({
        aggregateId: "artifact_1",
        aggregateType: "artifact",
        eventType: "artifact.created",
        id: "event_artifact_1",
        payload: {
          kind: "chapter_draft",
          title: "AI 第一章草稿",
        },
        projectId: "project_1",
      });
      await projector.project({
        aggregateId: "candidate_1",
        aggregateType: "memory_candidate",
        eventType: "memory_candidate.created",
        id: "event_candidate_1",
        payload: {
          artifactId: "artifact_1",
          content: "林鸢发现旧报纸日期。",
          entityId: "char_linyuan",
          entityType: "character",
          kind: "event",
        },
        projectId: "project_1",
      });

      const chapterNeighborhood = await getNeighborhood(store, {
        depth: 2,
        entityId: "chapter_1",
        projectId: "project_1",
      });
      expect(chapterNeighborhood.nodes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: "chapter_1", type: "chapter" }),
          expect.objectContaining({ id: "event_seed", type: "story_event" }),
          expect.objectContaining({ id: "char_linyuan", type: "character" }),
          expect.objectContaining({ id: "location_archive", type: "location" }),
          expect.objectContaining({ id: "foreshadowing_1", type: "foreshadowing" }),
        ]),
      );

      await expect(listOpenForeshadowings(store, { projectId: "project_1" })).resolves.toEqual([
        expect.objectContaining({ id: "foreshadowing_1", status: "seeded" }),
      ]);
      await expect(
        listEventCauses(store, { eventId: "event_seed", projectId: "project_1" }),
      ).resolves.toEqual([
        expect.objectContaining({
          sourceId: "event_cause",
          targetId: "event_seed",
          label: "causes",
        }),
      ]);
      await expect(listContradictions(store, { projectId: "project_1" })).resolves.toEqual([
        expect.objectContaining({
          sourceId: "event_seed",
          targetId: "event_cause",
          label: "contradicts",
        }),
      ]);
      await expect(
        listWorldRuleImpacts(store, { projectId: "project_1", worldRuleId: "rule_1" }),
      ).resolves.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ targetId: "chapter_1", targetType: "chapter" }),
          expect.objectContaining({ targetId: "event_seed", targetType: "story_event" }),
        ]),
      );
      await expect(
        listArtifactMemoryCandidates(store, { artifactId: "artifact_1", projectId: "project_1" }),
      ).resolves.toEqual([
        expect.objectContaining({ id: "candidate_1", type: "memory_candidate" }),
      ]);
    } finally {
      await store.close();
    }
  });
});
