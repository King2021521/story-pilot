import type { PromptCapability, PromptVersion } from "../prompts/prompt-registry.js";
import { PromptRegistry, buildPromptMessages } from "../prompts/prompt-registry.js";

export interface PromptEvalFixture {
  readonly id: string;
  readonly capability: PromptCapability;
  readonly version: PromptVersion;
  readonly requiredPhrases: readonly string[];
  readonly forbiddenPhrases?: readonly string[];
}

export interface PromptEvalCheckResult {
  readonly phrase: string;
  readonly kind: "required" | "forbidden";
  readonly passed: boolean;
}

export interface PromptEvalResult {
  readonly fixtureId: string;
  readonly capability: PromptCapability;
  readonly promptVersion: PromptVersion;
  readonly promptHash: string;
  readonly score: number;
  readonly passed: boolean;
  readonly checks: readonly PromptEvalCheckResult[];
}

export const DEFAULT_PROMPT_EVAL_FIXTURES: readonly PromptEvalFixture[] = [
  {
    capability: "blueprint_generate",
    id: "blueprint-longform-methodology",
    requiredPhrases: ["长篇", "读者承诺", "主冲突", "JSON"],
    version: "v1",
  },
  {
    capability: "chapter_draft",
    id: "chapter-canon-boundary",
    requiredPhrases: ["canon", "不得直接修改", "memoryCandidates", "JSON"],
    version: "v1",
  },
  {
    capability: "memory_extract",
    id: "memory-candidate-boundary",
    requiredPhrases: ["候选记忆", "不得写入正式 canon", "等待用户确认", "JSON"],
    version: "v1",
  },
  {
    capability: "outline_generate",
    id: "outline-before-draft",
    requiredPhrases: ["章节大纲", "因果", "钩子", "JSON"],
    version: "v1",
  },
];

export function runPromptEvals(
  fixtures: readonly PromptEvalFixture[] = DEFAULT_PROMPT_EVAL_FIXTURES,
): PromptEvalResult[] {
  return fixtures.map(evaluatePromptFixture);
}

export function evaluatePromptFixture(fixture: PromptEvalFixture): PromptEvalResult {
  const prompt = PromptRegistry.getPrompt(fixture.capability, fixture.version);
  const evaluatedContent = buildPromptMessages({
    capability: fixture.capability,
    context: "评测上下文：验证系统提示词拼装后的边界、方法论和输出契约。",
    instruction: "执行 prompt 质量静态评测。",
    version: fixture.version,
  })
    .map((message) => message.content)
    .join("\n\n");
  const requiredChecks = fixture.requiredPhrases.map((phrase) => ({
    kind: "required" as const,
    passed: evaluatedContent.includes(phrase),
    phrase,
  }));
  const forbiddenChecks = (fixture.forbiddenPhrases ?? []).map((phrase) => ({
    kind: "forbidden" as const,
    passed: !evaluatedContent.includes(phrase),
    phrase,
  }));
  const checks = [...requiredChecks, ...forbiddenChecks];
  const passedCount = checks.filter((check) => check.passed).length;
  const score = checks.length === 0 ? 100 : Math.round((passedCount / checks.length) * 100);

  return {
    capability: fixture.capability,
    checks,
    fixtureId: fixture.id,
    passed: score === 100,
    promptHash: prompt.contentHash,
    promptVersion: fixture.version,
    score,
  };
}
