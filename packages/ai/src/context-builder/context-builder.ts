import { createHash } from "node:crypto";

export interface ContextChapter {
  readonly id: string;
  readonly title: string;
  readonly summary?: string | null;
  readonly content?: string;
  readonly version: number;
}

export interface ContextMemory {
  readonly id: string;
  readonly entityType: string;
  readonly entityId?: string | null;
  readonly kind: string;
  readonly content: string;
  readonly status: "canon" | "hypothesis" | string;
}

export interface ContextGraphNode {
  readonly id: string;
  readonly type: string;
  readonly label: string;
}

export interface ContextGraphEdge {
  readonly sourceId: string;
  readonly targetId: string;
  readonly label: string;
}

export interface ContextGraphNeighborhood {
  readonly nodes: readonly ContextGraphNode[];
  readonly edges: readonly ContextGraphEdge[];
}

export interface ContextPackageItem {
  readonly itemType: string;
  readonly itemId: string;
  readonly rank: number;
  readonly content: string;
  readonly metadata?: Record<string, unknown>;
}

export interface BuiltContextPackage {
  readonly purpose: "chapter_draft";
  readonly projectId: string;
  readonly targetType: "chapter";
  readonly targetId: string;
  readonly inputHash: string;
}

export interface BuiltChapterDraftContext {
  readonly package: BuiltContextPackage;
  readonly items: readonly ContextPackageItem[];
  readonly text: string;
}

export interface BuildChapterDraftContextInput {
  readonly projectId: string;
  readonly chapterId: string;
  readonly instruction: string;
  readonly relatedEntityIds?: readonly string[];
  readonly tokenBudget?: number;
}

export interface ContextBuilderReadModel {
  getChapter(projectId: string, chapterId: string): Promise<ContextChapter>;
  listMemories(input: {
    readonly projectId: string;
    readonly statuses: readonly string[];
    readonly limit: number;
  }): Promise<readonly ContextMemory[]>;
  getGraphNeighborhood(input: {
    readonly projectId: string;
    readonly entityId: string;
    readonly depth: number;
  }): Promise<ContextGraphNeighborhood>;
}

export class ContextBuilder {
  constructor(private readonly readModel: ContextBuilderReadModel) {}

  async buildChapterDraftContext(input: BuildChapterDraftContextInput): Promise<BuiltChapterDraftContext> {
    const chapter = await this.readModel.getChapter(input.projectId, input.chapterId);
    const memories = await this.readModel.listMemories({
      limit: 80,
      projectId: input.projectId,
      statuses: ["canon", "hypothesis"],
    });
    const neighborhoods = await Promise.all(
      [...new Set(input.relatedEntityIds ?? [])].map((entityId) =>
        this.readModel.getGraphNeighborhood({
          depth: 2,
          entityId,
          projectId: input.projectId,
        }),
      ),
    );

    const items = [
      buildChapterItem(chapter),
      ...memories
        .filter((memory) => memory.status === "canon")
        .map((memory, index) => buildMemoryItem(memory, index + 2)),
      ...memories
        .filter((memory) => memory.status === "hypothesis")
        .map((memory, index) => buildMemoryItem(memory, index + 200)),
      ...neighborhoods.map((neighborhood, index) => buildGraphItem(neighborhood, `graph_${index}`, index + 400)),
      {
        itemId: input.chapterId,
        itemType: "instruction",
        rank: 900,
        content: `instruction: ${input.instruction}`,
      },
    ];
    const budget = input.tokenBudget ?? 12_000;
    const sortedItems = items
      .filter((item) => item.content.trim().length > 0)
      .sort((left, right) => left.rank - right.rank);

    return {
      items: trimItems(sortedItems, budget),
      package: {
        inputHash: hashContextInput({
          chapterId: input.chapterId,
          instruction: input.instruction,
          projectId: input.projectId,
          relatedEntityIds: input.relatedEntityIds ?? [],
        }),
        projectId: input.projectId,
        purpose: "chapter_draft",
        targetId: input.chapterId,
        targetType: "chapter",
      },
      text: trimItems(sortedItems, budget)
        .map((item) => item.content)
        .join("\n\n"),
    };
  }
}

function buildChapterItem(chapter: ContextChapter): ContextPackageItem {
  return {
    itemId: chapter.id,
    itemType: "chapter",
    rank: 1,
    content: [
      `chapter: ${chapter.title}`,
      `version: ${chapter.version}`,
      chapter.summary ? `summary: ${chapter.summary}` : undefined,
      chapter.content ? `current content excerpt: ${chapter.content}` : undefined,
    ]
      .filter((line): line is string => line !== undefined)
      .join("\n"),
  };
}

function buildMemoryItem(memory: ContextMemory, rank: number): ContextPackageItem {
  return {
    itemId: memory.id,
    itemType: `${memory.status}_memory`,
    metadata: {
      entityId: memory.entityId,
      entityType: memory.entityType,
      kind: memory.kind,
      status: memory.status,
    },
    rank,
    content: `${memory.status} memory [${memory.kind}/${memory.entityType}]: ${memory.content}`,
  };
}

function buildGraphItem(
  neighborhood: ContextGraphNeighborhood,
  itemId: string,
  rank: number,
): ContextPackageItem {
  const nodeLabels = new Map(neighborhood.nodes.map((node) => [node.id, node.label]));
  const lines = neighborhood.edges.map((edge) => {
    const source = nodeLabels.get(edge.sourceId) ?? edge.sourceId;
    const target = nodeLabels.get(edge.targetId) ?? edge.targetId;
    return `${source} -[${edge.label}]-> ${target}`;
  });

  return {
    itemId,
    itemType: "graph_neighborhood",
    metadata: {
      edgeCount: neighborhood.edges.length,
      nodeCount: neighborhood.nodes.length,
    },
    rank,
    content: ["graph neighborhood:", ...lines].join("\n"),
  };
}

function hashContextInput(input: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

function trimItems(items: readonly ContextPackageItem[], tokenBudget: number): ContextPackageItem[] {
  const approximateCharBudget = Math.max(1_000, tokenBudget * 4);
  const kept: ContextPackageItem[] = [];
  let used = 0;

  for (const item of items) {
    const cost = item.content.length;
    if (used + cost > approximateCharBudget && kept.length > 0) {
      continue;
    }
    kept.push(item);
    used += cost;
  }

  return kept;
}
