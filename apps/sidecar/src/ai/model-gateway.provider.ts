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

  return new ModelGateway(new FakeModelProvider());
}

export const modelGatewayProvider = {
  provide: MODEL_GATEWAY,
  useFactory: () => createModelGatewayFromEnv(),
};
