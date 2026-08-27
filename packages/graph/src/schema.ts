import type { GraphStore } from "./graph-store.js";
import { executeGraphQuery } from "./graph-store.js";

const semanticNodeTables = [
  "Project",
  "Work",
  "Volume",
  "Chapter",
  "Scene",
  "Character",
  "Location",
  "Organization",
  "Item",
  "WorldRule",
  "Plotline",
  "PlotNode",
  "Artifact",
  "WorkOrder",
  "MemoryCandidate",
] as const;

export async function initializeGraphSchema(store: GraphStore): Promise<void> {
  await executeGraphQuery(
    store,
    `
    CREATE NODE TABLE IF NOT EXISTS Entity(
      id STRING,
      projectId STRING,
      entityType STRING,
      name STRING,
      metadata STRING,
      sourceTable STRING,
      sourceId STRING,
      sourceEventId STRING,
      PRIMARY KEY(id)
    )
    `,
  );

  for (const tableName of semanticNodeTables) {
    await executeGraphQuery(
      store,
      `
      CREATE NODE TABLE IF NOT EXISTS ${tableName}(
        id STRING,
        projectId STRING,
        label STRING,
        metadata STRING,
        sourceTable STRING,
        sourceId STRING,
        sourceEventId STRING,
        PRIMARY KEY(id)
      )
      `,
    );
  }

  await executeGraphQuery(
    store,
    `
    CREATE NODE TABLE IF NOT EXISTS StoryEvent(
      id STRING,
      projectId STRING,
      title STRING,
      eventType STRING,
      summary STRING,
      metadata STRING,
      sourceTable STRING,
      sourceId STRING,
      sourceEventId STRING,
      PRIMARY KEY(id)
    )
    `,
  );
  await executeGraphQuery(
    store,
    `
    CREATE NODE TABLE IF NOT EXISTS Memory(
      id STRING,
      projectId STRING,
      kind STRING,
      status STRING,
      content STRING,
      entityType STRING,
      entityId STRING,
      metadata STRING,
      sourceTable STRING,
      sourceId STRING,
      sourceEventId STRING,
      PRIMARY KEY(id)
    )
    `,
  );
  await executeGraphQuery(
    store,
    `
    CREATE NODE TABLE IF NOT EXISTS Foreshadowing(
      id STRING,
      projectId STRING,
      title STRING,
      status STRING,
      metadata STRING,
      sourceTable STRING,
      sourceId STRING,
      sourceEventId STRING,
      PRIMARY KEY(id)
    )
    `,
  );
  await executeGraphQuery(
    store,
    `
    CREATE REL TABLE IF NOT EXISTS RELATES(
      FROM Entity TO Entity,
      relationId STRING,
      relationType STRING,
      description STRING,
      polarity INT64,
      strength DOUBLE,
      sourceTable STRING,
      sourceId STRING,
      sourceEventId STRING
    )
    `,
  );
  await executeGraphQuery(
    store,
    `
    CREATE REL TABLE IF NOT EXISTS PARTICIPATES_IN(
      FROM Entity TO StoryEvent,
      role STRING,
      sourceTable STRING,
      sourceId STRING,
      sourceEventId STRING
    )
    `,
  );
  await executeGraphQuery(
    store,
    `
    CREATE REL TABLE IF NOT EXISTS OCCURS_IN(
      FROM StoryEvent TO Entity,
      scope STRING,
      sourceTable STRING,
      sourceId STRING,
      sourceEventId STRING
    )
    `,
  );
  await executeGraphQuery(
    store,
    `
    CREATE REL TABLE IF NOT EXISTS CAUSES(
      FROM StoryEvent TO StoryEvent,
      relationId STRING,
      relationType STRING,
      description STRING,
      sourceTable STRING,
      sourceId STRING,
      sourceEventId STRING
    )
    `,
  );
  await executeGraphQuery(
    store,
    `
    CREATE REL TABLE IF NOT EXISTS OCCURS_BEFORE(
      FROM StoryEvent TO StoryEvent,
      relationId STRING,
      relationType STRING,
      description STRING,
      sourceTable STRING,
      sourceId STRING,
      sourceEventId STRING
    )
    `,
  );
  await executeGraphQuery(
    store,
    `
    CREATE REL TABLE IF NOT EXISTS CONTRADICTS(
      FROM StoryEvent TO StoryEvent,
      relationId STRING,
      relationType STRING,
      description STRING,
      sourceTable STRING,
      sourceId STRING,
      sourceEventId STRING
    )
    `,
  );
  await executeGraphQuery(
    store,
    `
    CREATE REL TABLE IF NOT EXISTS CONSTRAINS(
      FROM Entity TO Entity,
      FROM Entity TO StoryEvent,
      relationId STRING,
      description STRING,
      sourceTable STRING,
      sourceId STRING,
      sourceEventId STRING
    )
    `,
  );
  await executeGraphQuery(
    store,
    `
    CREATE REL TABLE IF NOT EXISTS AFFECTS(
      FROM Memory TO Entity,
      predicate STRING,
      sourceTable STRING,
      sourceId STRING,
      sourceEventId STRING
    )
    `,
  );
  await executeGraphQuery(
    store,
    `
    CREATE REL TABLE IF NOT EXISTS SEEDED_IN(
      FROM Foreshadowing TO StoryEvent,
      note STRING,
      sourceTable STRING,
      sourceId STRING,
      sourceEventId STRING
    )
    `,
  );
  await executeGraphQuery(
    store,
    `
    CREATE REL TABLE IF NOT EXISTS REINFORCED_IN(
      FROM Foreshadowing TO StoryEvent,
      note STRING,
      sourceTable STRING,
      sourceId STRING,
      sourceEventId STRING
    )
    `,
  );
  await executeGraphQuery(
    store,
    `
    CREATE REL TABLE IF NOT EXISTS PAID_OFF_IN(
      FROM Foreshadowing TO StoryEvent,
      note STRING,
      sourceTable STRING,
      sourceId STRING,
      sourceEventId STRING
    )
    `,
  );
  await executeGraphQuery(
    store,
    `
    CREATE REL TABLE IF NOT EXISTS SUPPORTED_BY(
      FROM Memory TO Entity,
      sourceTable STRING,
      sourceId STRING,
      sourceEventId STRING
    )
    `,
  );
  await executeGraphQuery(
    store,
    `
    CREATE REL TABLE IF NOT EXISTS GENERATED(
      FROM Entity TO Entity,
      sourceTable STRING,
      sourceId STRING,
      sourceEventId STRING
    )
    `,
  );
}
