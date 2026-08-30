import type { ModelMessage } from "../model-gateway/types.js";
import {
  PromptRegistry,
  type PromptCapability,
  type PromptDefinition,
  type PromptVersion,
} from "./prompt-registry.js";

export const PROMPT_TEMPLATE_IDS = ["worldbuilding.complete", "core-story.complete"] as const;

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
  "core-story.complete": {
    capability: "core_story_complete",
    defaultInstruction:
      "基于模板变量补全核心故事表单。保留用户已填写内容的核心含义，输出能支撑长篇创作契约的 JSON。",
    id: "core-story.complete",
    optionalVariables: ["brief", "worldbuildingProfile", "currentBlueprint"],
    requiredVariables: ["project", "currentFields"],
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
