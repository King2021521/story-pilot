import {
  FakeModelProvider,
  ModelGateway,
  OpenAICompatibleProvider,
  type EmbedInput,
  type EmbedResult,
  type GenerateObjectInput,
  type GenerateObjectResult,
  type StreamTextInput,
  type ModelProvider,
  type ProviderEmbedResult,
  type ProviderObjectResult,
} from "@story-pilot/ai";
import type { z } from "zod";

export const MODEL_GATEWAY = "MODEL_GATEWAY";

export type EnvLike = Record<string, string | undefined>;

export function createModelGatewayFromEnv(
  env: EnvLike = process.env,
  fetchImpl?: (url: string, init?: RequestInit) => Promise<Response>,
): ModelGateway {
  const model = env.STORY_PILOT_LLM_MODEL ?? "gpt-5.5";
  const baseUrl = env.STORY_PILOT_LLM_BASE_URL;
  const apiKey = env.STORY_PILOT_LLM_API_KEY;
  const embeddingModel = env.STORY_PILOT_LLM_EMBEDDING_MODEL;
  const maxRetries = readPositiveInteger(env.STORY_PILOT_LLM_MAX_RETRIES);
  const timeoutMs = readPositiveInteger(env.STORY_PILOT_LLM_TIMEOUT_MS);

  if (baseUrl && apiKey) {
    return new ModelGateway(
      new OpenAICompatibleProvider({
        apiKey,
        baseUrl,
        ...(embeddingModel === undefined ? {} : { embeddingModel }),
        model,
        ...(fetchImpl === undefined ? {} : { fetch: fetchImpl }),
      }),
      {
        ...(maxRetries === undefined ? {} : { maxRetries }),
        ...(timeoutMs === undefined ? {} : { timeoutMs }),
      },
    );
  }

  if (env.STORY_PILOT_ALLOW_FAKE_MODEL !== "true") {
    return new ModelGateway(new UnconfiguredModelProvider());
  }

  const fakeCoreStoryText = buildFakeCoreStoryText("核心故事");

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
          emotionalAxes: ["悬疑", "反转"],
          logline: "主角从异常事件中发现更大的秩序裂缝。",
          mainConflict: "主角追求真相或力量时，必须对抗既有秩序制造的阻力。",
          mainGoal: "查清异常事件背后的真相，并打破维持压迫的旧秩序。",
          premise: "主角从异常事件中发现更大的秩序裂缝。",
          protagonistArc: "主角从被动卷入转为主动承担代价。",
          risks: ["设定堆叠过多会拖慢开篇。"],
          stakes: "失败会让主角失去关键关系、身份位置或改变命运的机会。",
          storyDriver: "mystery",
        },
        CoreStoryFieldCompletionOutput: {
          fields: {
            antagonistForce: fakeCoreStoryText,
            corePromise: fakeCoreStoryText,
            differentiators: [
              "把核心设定绑定人物选择，而不是只做背景装饰。",
              "每个阶段胜利都会引出新的代价或更深层真相。",
            ],
            emotionalAxes: ["悬疑", "反转"],
            logline:
              "主角从异常事件中发现更大的秩序裂缝，并在保护同伴、公开真相与重建秩序之间不断付出代价。",
            mainConflict: fakeCoreStoryText,
            mainGoal: fakeCoreStoryText,
            premise: fakeCoreStoryText,
            protagonistArc: fakeCoreStoryText,
            risks: ["开篇目标过散会削弱追读。"],
            stakes: fakeCoreStoryText,
            storyDriver: "mystery",
          },
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
        WorldbuildingFieldCompletionOutput: {
          fields: {
            coreConflict: buildFakeWorldbuildingDimension("核心矛盾"),
            culture: buildFakeWorldbuildingDimension("文化价值"),
            economy: buildFakeWorldbuildingDimension("资源经济"),
            factions: buildFakeWorldbuildingDimension("势力格局"),
            geography: buildFakeWorldbuildingDimension("空间地理"),
            history: buildFakeWorldbuildingDimension("历史背景"),
            powerOrder: buildFakeWorldbuildingDimension("权力体系"),
            powerSystem: buildFakeWorldbuildingDimension("力量体系"),
            rules: buildFakeWorldbuildingDimension("秩序规则"),
            socialStructure: buildFakeWorldbuildingDimension("社会结构"),
            specialMechanism: buildFakeWorldbuildingDimension("特殊机制"),
            worldBase: buildFakeWorldbuildingDimension("世界基底"),
          },
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
        BookPlanGenerateOutput: {
          bookPlan: {
            corePromise: "以持续升级的目标、代价和反转支撑长篇阅读期待。",
            endingDirection: "主角完成身份跃迁，同时偿还早期选择留下的代价。",
            targetWordCount: 3_000_000,
            title: "全书结构规划",
          },
          riskNotes: ["长篇规划需要在每卷结束后复盘，避免中段目标重复。"],
          volumePlans: [
            {
              arcs: [
                {
                  arcIndex: 1,
                  endChapterIndex: 30,
                  escalation: ["异常入局", "目标确立", "首次胜利暴露更大危机"],
                  purpose: "完成开篇承诺、核心角色绑定和第一轮冲突升级。",
                  startChapterIndex: 1,
                  title: "入局与承诺",
                },
              ],
              climax: "主角以明确代价赢下阶段胜利，但发现真正敌人尚未现身。",
              majorConflict: "主角追求阶段目标时，被既有秩序和信息差持续压制。",
              purpose: "建立世界规则、主角动机、爽点节奏和长期伏笔。",
              targetWordCount: 500_000,
              title: "第一卷：入局",
              volumeIndex: 1,
            },
          ],
        },
        RollingChapterPlanGenerateOutput: {
          chapterPlans: [
            {
              chapterGoal: "让主角主动进入下一轮事件，并获得一个可验证的新线索。",
              chapterIndex: 1,
              conflict: "主角想保留退路，但外部压力迫使其当场做出选择。",
              emotionalTurn: "从试探和迟疑转为明确下注。",
              hook: "新线索指向更高层级的隐藏规则。",
              informationGain: "确认异常事件不是偶发，而是有人刻意推动。",
              relatedCharacterIds: [],
              relatedForeshadowingIds: [],
              relatedPlotlineIds: [],
              scenes: [
                {
                  conflictTurn: "关键证据出现，但使用它会暴露主角的真实意图。",
                  memoryTargets: ["主角目标", "异常规则", "对立力量"],
                  outcome: "主角拿到线索，同时被对立方标记。",
                  sceneGoal: "完成本章行动目标并制造下一章追问。",
                  sceneIndex: 1,
                },
              ],
              targetWordCount: 3_000,
              title: "第 1 章：线索入手",
            },
          ],
          riskNotes: ["每批章纲生成后需要与已确认记忆做连续性复核。"],
        },
      },
    }),
  );
}

function buildFakeCoreStoryText(label: string): string {
  return [
    `${label}围绕主角目标、读者期待和长期阻力建立清晰契约：主角不是被动等待事件发生，而是被一个必须解决的问题推向行动。`,
    "每次行动都要带来可见收益，也留下新的代价，包括关系裂痕、信息暴露、资源损耗和对手升级。",
    "对抗力量拥有自己的利益逻辑和组织资源，能够持续制造阻碍，而不是只在关键章出现。",
    "阶段胜利必须兑现情绪回报，同时打开更高层级的问题，让长篇连载始终保持目标递进、冲突升级和人物变化。",
    "这种契约要求每一卷都有清晰目标、明确阻力、可见收益和难以逃避的后果，让读者始终知道主角正在向哪里推进，也知道任何胜利都不会免费。",
  ].join("");
}

function buildFakeWorldbuildingDimension(label: string): string {
  return [
    `${label}围绕资源、身份和旧秩序形成稳定规则：核心资源不能凭空出现，任何组织想获得安全都必须交出劳动、情报、技术或关系信用。`,
    "运行规则上，每个决定都会改变资源、通行、信任和防线四类状态，短期收益会留下长期后果，不能用万能能力直接抹平冲突。",
    "叙事冲突来自掌控资源者与改写规则者的拉扯，主角每次破局都会暴露位置、损耗盟友、激化外部势力或触发旧制度反扑。",
    "代价限制保证设定不会变成背景装饰，剧情接口则可以连接地点争夺、人物站队、制度审判、技术升级和卷末反转，并与其他世界观维度互相闭环。",
    "该维度还要解释人物为什么会相信、服从或反抗这些规则，使后续章节能自然展开选择、误判、交易、背叛和回收。",
    "因此每次新增设定都应能反过来改变角色选择。",
  ].join("");
}

function readPositiveInteger(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
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
  useFactory: () => new RuntimeModelGateway(),
};

class RuntimeModelGateway extends ModelGateway {
  constructor() {
    super(new UnconfiguredModelProvider());
  }

  override generateObject<TSchema extends z.ZodType>(
    input: GenerateObjectInput<TSchema>,
  ): Promise<GenerateObjectResult<z.infer<TSchema>>> {
    return createModelGatewayFromEnv().generateObject(input);
  }

  override streamText(input: StreamTextInput): AsyncIterable<string> {
    return createModelGatewayFromEnv().streamText(input);
  }

  override embed(input: EmbedInput): Promise<EmbedResult> {
    return createModelGatewayFromEnv().embed(input);
  }
}
