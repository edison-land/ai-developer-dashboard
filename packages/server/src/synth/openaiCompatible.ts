import OpenAI from "openai";
import type { ProviderId, SynthOpts, SynthProvider, TokenUsage } from "@ai-dashboard/core";

export interface OpenAICompatibleProviderOpts {
  id: ProviderId;
  apiKey: string;
  requestUrl: string;
  defaultModel?: string;
}

/** One provider adapter for every OpenAI-compatible Chat Completions service. */
export class OpenAICompatibleProvider implements SynthProvider {
  readonly id: ProviderId;
  private readonly client: OpenAI;
  private readonly defaultModel: string;

  constructor(opts: OpenAICompatibleProviderOpts) {
    this.id = opts.id;
    this.client = new OpenAI({ apiKey: opts.apiKey, baseURL: opts.requestUrl });
    this.defaultModel = opts.defaultModel ?? "gpt-4o-mini";
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
    const usage = res.usage;
    const cached =
      (usage as { prompt_tokens_details?: { cached_tokens?: number } } | undefined | null)
        ?.prompt_tokens_details?.cached_tokens;
    return {
      json: content,
      model: res.model ?? model,
      usage: {
        input: usage?.prompt_tokens ?? 0,
        output: usage?.completion_tokens ?? 0,
        cachedRead: typeof cached === "number" ? cached : undefined,
      },
    };
  }
}
