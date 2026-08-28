import kuzu from "kuzu";
import type { KuzuValue, QueryResult } from "kuzu";

export interface GraphStore {
  readonly path: string;
  readonly database: kuzu.Database;
  readonly connection: kuzu.Connection;
  close(): Promise<void>;
}

export type GraphQueryParams = Record<string, KuzuValue>;

export async function createGraphStore(path: string): Promise<GraphStore> {
  const database = new kuzu.Database(path);
  const connection = new kuzu.Connection(database);
  await database.init();
  await connection.init();

  return {
    path,
    database,
    connection,
    async close(): Promise<void> {
      await connection.close();
      await database.close();
    },
  };
}

export async function executeGraphQuery(
  store: GraphStore,
  statement: string,
  params: GraphQueryParams = {},
): Promise<Record<string, KuzuValue>[]> {
  const prepared = await store.connection.prepare(statement).catch((error: unknown) => {
    throw new Error(`KUZU_PREPARE_FAILED: ${summarizeStatement(statement)}`, { cause: error });
  });
  if (!prepared.isSuccess()) {
    throw new Error(`KUZU_PREPARE_FAILED: ${prepared.getErrorMessage()}`);
  }

  const result = await store.connection.execute(prepared, params).catch((error: unknown) => {
    throw new Error(`KUZU_EXECUTE_FAILED: ${summarizeStatement(statement)}`, { cause: error });
  });
  return collectRows(result);
}

async function collectRows(
  result: QueryResult | QueryResult[],
): Promise<Record<string, KuzuValue>[]> {
  if (Array.isArray(result)) {
    const rows: Record<string, KuzuValue>[] = [];
    for (const partial of result) {
      rows.push(...(await collectSingleResultRows(partial)));
    }
    return rows;
  }

  return collectSingleResultRows(result);
}

async function collectSingleResultRows(result: QueryResult): Promise<Record<string, KuzuValue>[]> {
  try {
    return await result.getAll();
  } finally {
    result.close();
  }
}

function summarizeStatement(statement: string): string {
  return statement.replace(/\s+/g, " ").trim();
}
