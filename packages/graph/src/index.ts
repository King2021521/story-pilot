export const PROJECT_GRAPH_DIRECTORY = "graph.kuzu";

export type GraphProjectionStatus = "ok" | "rebuilding" | "failed";

export * from "./graph-store.js";
export * from "./projector/graph-projector.js";
export * from "./queries/neighborhood.js";
export * from "./schema.js";
