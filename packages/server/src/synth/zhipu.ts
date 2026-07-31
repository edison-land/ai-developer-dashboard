import { OpenAICompatibleProvider } from "./openaiCompatible.js";

/**
 * Zhipu (智谱) BigModel provider. The BigModel chat-completions API is
 * OpenAI-compatible — point the `openai` SDK at it with a custom baseURL and
 * the user's BigModel API key, and it speaks the same protocol.
 *
 * We deliberately do NOT send `response_format: { type: "json_object" }`: not
 * every GLM model (esp. free flash tiers) honors it, and an unsupported value
 * can make the API reject the whole request. The system prompt already demands
 * JSON, and `parseSynthJson` robustly extracts the object — so this stays
 * model-agnostic and fail-safe.
 */
const ZHIPU_BASE_URL = "https://open.bigmodel.cn/api/paas/v4/";

export interface ZhipuProviderOpts {
  apiKey: string;
  /** Fallback model if a call doesn't pass one (the dashboard passes the user's settings model). */
  defaultModel?: string;
}

export class ZhipuProvider extends OpenAICompatibleProvider {
  constructor(opts: ZhipuProviderOpts) {
    super({
      id: "zhipu",
      apiKey: opts.apiKey,
      requestUrl: ZHIPU_BASE_URL,
      defaultModel: opts.defaultModel ?? "glm-4-flash-250414",
    });
  }
}
