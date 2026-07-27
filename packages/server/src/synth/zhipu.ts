import OpenAI from "openai";
import type { SynthOpts, SynthProvider, TokenUsage } from "@ai-dashboard/core";

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

export class ZhipuProvider implements SynthProvider {
  readonly id = "zhipu" as const;
  private readonly client: OpenAI;
  private readonly defaultModel: string;

  constructor(opts: ZhipuProviderOpts) {
    this.client = new OpenAI({ apiKey: opts.apiKey, baseURL: ZHIPU_BASE_URL });
    this.defaultModel = opts.defaultModel ?? "glm-4-flash-250414";
  }

  async run(
    systemPrompt: string,
    userPrompt: string,
    opts: SynthOpts,
  ): Promise<{ json: unknown; usage: TokenUsage; model: string }> {
    const model = opts.model ?? this.defaultModel;
    const res = await this.client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0,
      max_tokens: 1024,
    });

    const content = res.choices[0]?.message?.content ?? "";
    const u = res.usage;
    const cached = (u as { prompt_tokens_details?: { cached_tokens?: number } } | undefined | null)?.prompt_tokens_details?.cached_tokens;
    return {
      json: content, // raw text; parseSynthJson extracts + validates the JSON object
      model: res.model ?? model,
      usage: {
        input: u?.prompt_tokens ?? 0,
        output: u?.completion_tokens ?? 0,
        cachedRead: typeof cached === "number" ? cached : undefined,
      },
    };
  }
}
