import type { GraphStore } from "./graph-store.js";
import { executeGraphQuery } from "./graph-store.js";

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
      PRIMARY KEY(id)
    )
    `,
  );
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
      strength DOUBLE
    )
    `,
  );
  await executeGraphQuery(
    store,
    `
    CREATE REL TABLE IF NOT EXISTS PARTICIPATES_IN(
      FROM Entity TO StoryEvent,
      role STRING
    )
    `,
  );
  await executeGraphQuery(
    store,
    `
    CREATE REL TABLE IF NOT EXISTS AFFECTS(
      FROM Memory TO Entity,
      predicate STRING
    )
    `,
  );
  await executeGraphQuery(
    store,
    `
    CREATE REL TABLE IF NOT EXISTS SEEDS(
      FROM Foreshadowing TO StoryEvent,
      note STRING
    )
    `,
  );
  await executeGraphQuery(
    store,
    `
    CREATE REL TABLE IF NOT EXISTS PAYS_OFF(
      FROM Foreshadowing TO StoryEvent,
      note STRING
    )
    `,
  );
}
