import type { ModelMessage } from "../model-gateway/types.js";
import {
  PromptRegistry,
  type PromptCapability,
  type PromptDefinition,
  type PromptVersion,
} from "./prompt-registry.js";

export const PROMPT_TEMPLATE_IDS = [
  "worldbuilding.complete",
  "core-story.complete",
  "book-plan.generate",
  "rolling-chapter-plan.generate",
  "chapter-execution-card.generate",
  "chapter-draft.generate",
  "chapter-review.generate",
  "story-state-delta.extract",
  "plot-debt.update",
  "serial-review.generate",
  "element-candidate.generate",
] as const;

export type PromptTemplateId = (typeof PROMPT_TEMPLATE_IDS)[number];

export interface PromptTemplateDefinition {
  readonly id: PromptTemplateId;
  readonly version: PromptVersion;
  readonly capability: PromptCapability;
  readonly requiredVariables: readonly string[];
  readonly optionalVariables: readonly string[];
  readonly defaultInstruction: string;
  readonly systemPrompt: PromptDefinition;
  readonly contentHash: string;
}

export interface BuildPromptTemplateMessagesInput {
  readonly templateId: PromptTemplateId;
  readonly version?: PromptVersion;
  readonly variables: Readonly<Record<string, unknown>>;
  readonly instruction?: string;
}

interface PromptTemplateMetadata {
  readonly id: PromptTemplateId;
  readonly capability: PromptCapability;
  readonly requiredVariables: readonly string[];
  readonly optionalVariables: readonly string[];
  readonly defaultInstruction: string;
}

const promptTemplateMetadata: Record<PromptTemplateId, PromptTemplateMetadata> = {
  "book-plan.generate": {
    capability: "book_plan_generate",
    defaultInstruction:
      "生成全书规划。围绕作品题材、世界观、核心故事契约和目标篇幅，输出可采纳的 Book/Volume/Arc JSON。",
    id: "book-plan.generate",
    optionalVariables: [
      "characters",
      "plotlines",
      "plotDebts",
      "conflicts",
      "contextPackage",
      "userInstruction",
    ],
    requiredVariables: ["project", "brief", "worldbuildingProfile", "blueprint"],
  },
  "chapter-draft.generate": {
    capability: "chapter_draft",
    defaultInstruction:
      "生成章节正文草稿。必须以章节执行卡和上下文包为核心，输出 artifact JSON，不直接覆盖正文。",
    id: "chapter-draft.generate",
    optionalVariables: ["recentChapters", "plotDebts", "characterStates", "userInstruction"],
    requiredVariables: ["project", "chapterExecutionCard", "contextPackage"],
  },
  "chapter-execution-card.generate": {
    capability: "chapter_execution_card_generate",
    defaultInstruction:
      "生成章节执行卡。把章节计划转成可约束正文的叙事目标、冲突、信息增量、情绪转折、读者回报、钩子和场景拆分 JSON。",
    id: "chapter-execution-card.generate",
    optionalVariables: [
      "brief",
      "worldbuildingProfile",
      "blueprint",
      "scenePlans",
      "characterStates",
      "plotDebts",
      "conflicts",
      "recentChapters",
      "contextPackage",
      "userInstruction",
    ],
    requiredVariables: ["project", "chapterPlan", "contextPackage"],
  },
  "chapter-review.generate": {
    capability: "chapter_review",
    defaultInstruction:
      "审阅章节草稿。逐项检查章节执行卡兑现度、连续性、冲突强度、信息增量、人物声音和章末钩子，输出审稿 JSON。",
    id: "chapter-review.generate",
    optionalVariables: [
      "chapter",
      "recentChapters",
      "plotDebts",
      "characterStates",
      "userInstruction",
    ],
    requiredVariables: ["project", "chapterExecutionCard", "currentArtifact", "contextPackage"],
  },
  "core-story.complete": {
    capability: "core_story_complete",
    defaultInstruction:
      "基于模板变量补全核心故事表单。保留用户已填写内容的核心含义，输出能支撑长篇创作契约的 JSON。",
    id: "core-story.complete",
    optionalVariables: ["brief", "worldbuildingProfile", "currentBlueprint"],
    requiredVariables: ["project", "currentFields"],
  },
  "element-candidate.generate": {
    capability: "element_generate",
    defaultInstruction:
      "生成创作要素候选。基于题材、世界观、用户描述和约束生成名称或元素候选 JSON，结果只作为候选。",
    id: "element-candidate.generate",
    optionalVariables: [
      "worldbuildingProfile",
      "blueprint",
      "characters",
      "plotlines",
      "plotDebts",
      "existingCanon",
      "userInstruction",
    ],
    requiredVariables: ["project", "brief", "generationRequest"],
  },
  "plot-debt.update": {
    capability: "plot_debt_update",
    defaultInstruction:
      "更新剧情债。根据已审阅产物和上下文包判断剧情债的创建、强化、回收、丢弃或风险升高，输出 JSON 候选。",
    id: "plot-debt.update",
    optionalVariables: ["plotDebts", "foreshadowings", "chapter", "userInstruction"],
    requiredVariables: ["project", "currentArtifact", "contextPackage"],
  },
  "rolling-chapter-plan.generate": {
    capability: "rolling_chapter_plan_generate",
    defaultInstruction:
      "生成滚动章节规划。基于长篇规划、当前状态和剧情债，输出未来一批章节与场景计划 JSON。",
    id: "rolling-chapter-plan.generate",
    optionalVariables: [
      "characters",
      "characterStates",
      "plotlines",
      "plotDebts",
      "conflicts",
      "recentChapters",
      "userInstruction",
    ],
    requiredVariables: ["project", "brief", "worldbuildingProfile", "blueprint", "longformPlans"],
  },
  "serial-review.generate": {
    capability: "retrospective_generate",
    defaultInstruction:
      "生成阶段复盘。诊断过去一批章节的承诺兑现、节奏、重复、人物停滞、剧情债风险，并给出下一步动作 JSON。",
    id: "serial-review.generate",
    optionalVariables: [
      "recentChapters",
      "plotDebts",
      "characterStates",
      "longformPlans",
      "userInstruction",
    ],
    requiredVariables: ["project", "reviewScope", "contextPackage"],
  },
  "story-state-delta.extract": {
    capability: "story_state_delta_extract",
    defaultInstruction:
      "抽取故事状态变化。只从已应用章节中抽取明确发生或强暗示的信息，输出故事状态、人物状态、剧情债和记忆候选 JSON。",
    id: "story-state-delta.extract",
    optionalVariables: [
      "chapterExecutionCard",
      "characters",
      "plotDebts",
      "currentStates",
      "userInstruction",
    ],
    requiredVariables: ["project", "chapter", "contextPackage"],
  },
  "worldbuilding.complete": {
    capability: "worldbuilding_generate",
    defaultInstruction:
      "基于模板变量补全 12 个世界观表单字段。保留用户已填写内容的核心含义，输出可直接填入表单的 JSON。",
    id: "worldbuilding.complete",
    optionalVariables: ["blueprint", "savedProfile", "existingCanon"],
    requiredVariables: ["project", "brief", "currentFields"],
  },
};

export const PromptTemplateRegistry = {
  getTemplate(
    templateId: PromptTemplateId,
    version: PromptVersion = "v1",
  ): PromptTemplateDefinition {
    const metadata = promptTemplateMetadata[templateId];
    const systemPrompt = PromptRegistry.getPrompt(metadata.capability, version);

    return {
      ...metadata,
      contentHash: systemPrompt.contentHash,
      systemPrompt,
      version,
    };
  },
};

export function buildPromptTemplateMessages(
  input: BuildPromptTemplateMessagesInput,
): ModelMessage[] {
  const template = PromptTemplateRegistry.getTemplate(input.templateId, input.version ?? "v1");
  const missingVariables = template.requiredVariables.filter(
    (name) => !Object.hasOwn(input.variables, name) || input.variables[name] === undefined,
  );

  if (missingVariables.length > 0) {
    throw new Error(
      `PROMPT_TEMPLATE_MISSING_VARIABLES: ${template.id}@${template.version} missing ${missingVariables.join(
        ", ",
      )}`,
    );
  }

  const sharedPrompts = [
    PromptRegistry.getPrompt("global_writer", template.version),
    PromptRegistry.getPrompt("canon_boundary", template.version),
    template.systemPrompt,
  ];
  const variableNames = [
    ...template.requiredVariables,
    ...template.optionalVariables.filter((name) => Object.hasOwn(input.variables, name)),
  ];
  const userContent = [
    `模板：${template.id}@${template.version}`,
    "模板变量：",
    ...variableNames.map((name) => renderVariableBlock(name, input.variables[name])),
    `任务指令：\n${input.instruction ?? template.defaultInstruction}`,
  ].join("\n\n");

  return [
    {
      role: "system",
      content: sharedPrompts.map((prompt) => prompt.content).join("\n\n"),
    },
    {
      role: "user",
      content: userContent,
    },
  ];
}

function renderVariableBlock(name: string, value: unknown): string {
  return `<${name}>\n${serializeVariable(value)}\n</${name}>`;
}

function serializeVariable(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value, null, 2);
}
