import { FakeModelProvider, ModelGateway, OpenAICompatibleProvider } from "@story-pilot/ai";

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

  return new ModelGateway(
    new FakeModelProvider({
      embedding: [0, 0, 0],
      objectResponses: {
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
      },
    }),
  );
}

export const modelGatewayProvider = {
  provide: MODEL_GATEWAY,
  useFactory: () => createModelGatewayFromEnv(),
};
