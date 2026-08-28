import {
  FakeModelProvider,
  ModelGateway,
  OpenAICompatibleProvider,
  type ModelProvider,
  type ProviderEmbedResult,
  type ProviderObjectResult,
} from "@story-pilot/ai";

export const MODEL_GATEWAY = "MODEL_GATEWAY";

export type EnvLike = Record<string, string | undefined>;

export function createModelGatewayFromEnv(
  env: EnvLike = process.env,
  fetchImpl?: (url: string, init?: RequestInit) => Promise<Response>,
): ModelGateway {
  const model = env.STORY_PILOT_LLM_MODEL ?? "gpt-5.5";
  const baseUrl = env.STORY_PILOT_LLM_BASE_URL;
  const apiKey = env.STORY_PILOT_LLM_API_KEY;

  if (baseUrl && apiKey) {
    return new ModelGateway(
      new OpenAICompatibleProvider({
        apiKey,
        baseUrl,
        model,
        ...(fetchImpl === undefined ? {} : { fetch: fetchImpl }),
      }),
    );
  }

  if (env.STORY_PILOT_ALLOW_FAKE_MODEL !== "true") {
    return new ModelGateway(new UnconfiguredModelProvider());
  }

  return new ModelGateway(
    new FakeModelProvider({
      embedding: [0, 0, 0],
      objectResponses: {
        BlueprintGenerateOutput: {
          antagonistForce: "隐藏真相或垄断关键资源的对立力量。",
          corePromise: "持续提供冲突升级、线索推进和阶段回报。",
          differentiators: [
            "把核心设定绑定人物选择，而不是只做背景装饰。",
            "每一卷至少保留一个可追踪的伏笔回收链。",
          ],
          logline: "主角从异常事件中发现更大的秩序裂缝。",
          mainConflict: "主角追求真相或力量时，必须对抗既有秩序制造的阻力。",
          premise: "主角从异常事件中发现更大的秩序裂缝。",
          protagonistArc: "主角从被动卷入转为主动承担代价。",
          risks: ["设定堆叠过多会拖慢开篇。"],
        },
        ChapterDraftOutput: {
          draft: {
            body: "雨夜里，林鸢从门缝下抽出一封来历异常的旧信。",
            summary: "林鸢发现旧信，旧案线索被重新打开。",
            title: "雨夜来信",
          },
          memoryCandidates: [
            {
              confidence: 0.8,
              content: "林鸢发现一封来历异常的旧信。",
              entityId: "char_linyuan",
              entityType: "character",
              kind: "event",
              proposedRelations: [],
            },
          ],
          reviewNotes: ["旧信来源仍需用户确认后再进入 canon。"],
        },
        ContinuityReviewOutput: {
          issues: [
            {
              evidence: "Fake provider 未发现硬性冲突，仅提示继续核对 canon。",
              issueType: "info",
              relatedEntityIds: [],
              severity: "info",
              suggestion: "在应用 AI 产物前由用户复核上下文。",
            },
          ],
          summary: "连续性审阅完成，未发现 fake 数据中的硬性矛盾。",
        },
        ForeshadowingPlanOutput: {
          suggestions: [
            {
              action: "reinforce",
              priority: 3,
              proposedText: "在下一章保留一个可被读者回忆的细节回声。",
              rationale: "Fake provider 默认建议强化已有伏笔而不直接回收。",
            },
          ],
          summary: "建议强化既有伏笔，等待用户确认后再落入正文。",
        },
        MemoryExtractOutput: {
          conflictNotes: [],
          memoryCandidates: [
            {
              confidence: 0.7,
              content: "文本中出现了需要长期追踪的剧情事实。",
              entityType: "story_event",
              kind: "event",
              proposedRelations: [],
              sourceSummary: "Fake provider 根据输入文本生成的待确认候选。",
            },
          ],
        },
        ElementCandidateOutput: {
          items: [
            {
              description: "受星轨潮汐影响的刀器，潮声越近锋芒越亮。",
              name: "潮汐断星刃",
              rationale: "贴合当前题材和世界观规则，可直接用于角色成长或关键战斗。",
              tags: ["武器", "星轨", "潮汐"],
              type: "weapon",
            },
          ],
        },
        OutlineGenerateOutput: {
          chapterOutlines: [
            {
              chapterGoal: "建立异常事件和主角行动目标。",
              conflict: "主角想回避风险，外部压力迫使其行动。",
              emotionalTurn: "从平静到被迫卷入。",
              hook: "以一个更大的未解问题收束。",
              informationGain: "新增一条与主冲突相关的信息。",
              targetWordCount: 3000,
              title: "第 1 章：开局钩子",
            },
          ],
          outline: {
            basis: {},
            scope: "chapter_batch",
            title: "前 10 章章纲",
          },
          riskNotes: [],
        },
      },
    }),
  );
}

class UnconfiguredModelProvider implements ModelProvider {
  readonly model = "unconfigured";
  readonly name = "unconfigured";

  generateObject(): Promise<ProviderObjectResult> {
    return Promise.reject(createUnconfiguredModelError());
  }

  streamText(): AsyncIterable<string> {
    throw createUnconfiguredModelError();
  }

  embed(): Promise<ProviderEmbedResult> {
    return Promise.reject(createUnconfiguredModelError());
  }
}

function createUnconfiguredModelError(): Error {
  return new Error("AI_MODEL_NOT_CONFIGURED: setting.json model.apiKey/baseUrl/model required");
}

export const modelGatewayProvider = {
  provide: MODEL_GATEWAY,
  useFactory: () => createModelGatewayFromEnv(),
};
