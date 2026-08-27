import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createGraphStore } from "./graph-store.js";
import { GraphProjector } from "./projector/graph-projector.js";
import { getNeighborhood } from "./queries/neighborhood.js";
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
          expect.objectContaining({ id: "foreshadowing_1", label: "旧报纸日期", type: "foreshadowing" }),
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
});
