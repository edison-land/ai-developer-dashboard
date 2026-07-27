import { computeInputHash } from "../aggregate.js";
import type { Store, SynthOutcome, SynthProvider, SynthResult, TailReader, UnifiedProject } from "../domain.js";
import { buildSynthBundle } from "./bundle.js";
import { parseSynthJson } from "./schema.js";

export interface SynthesizeDeps {
  provider: SynthProvider;
  tailReader: TailReader;
  store: Store;
  model: string;
  nowMs?: number;
}

/**
 * On-demand synthesis with input-hash caching — the core cost-control path.
 *
 * 1. Compute the input hash from the project's mechanical signals (reuses
 *    `computeInputHash`, the same hash the merge layer uses to mark `synthStale`).
 * 2. If a cached result with a matching hash exists, return it immediately and
 *    skip the API entirely (provider-agnostic — the main cost lever).
 * 3. Otherwise build a bounded bundle, call the provider, validate with zod,
 *    persist, and return the fresh result.
 *
 * Never throws: provider/parse failures return `{ok:false, error, cached?}` so
 * the card can fall back to a prior cached result (or just show the error).
 */
export async function synthesize(project: UnifiedProject, deps: SynthesizeDeps): Promise<SynthOutcome> {
  const inputHash = computeInputHash({
    lastActiveMs: project.lastActiveMs,
    git: project.git ?? null,
    lastActionOneLiner: project.lastActionOneLiner,
  });

  const cached = deps.store.getSynth(project.canonicalPath);
  if (cached && cached.inputHash === inputHash) {
    return { ok: true, result: cached.result, fromCache: true };
  }

  const bundle = buildSynthBundle(project, deps.tailReader);

  let raw: { json: unknown; usage: { input: number; output: number; cachedRead?: number }; model: string };
  try {
    raw = await deps.provider.run(bundle.systemPrompt, bundle.userPrompt, { model: deps.model });
  } catch (e) {
    return { ok: false, error: `模型调用失败：${e instanceof Error ? e.message : String(e)}`, cached: cached?.result };
  }

  const parsed = parseSynthJson(raw.json);
  if (!parsed.ok) {
    return { ok: false, error: `解析失败：${parsed.error}`, cached: cached?.result };
  }

  const result: SynthResult = {
    ...parsed.value,
    model: raw.model,
    provider: deps.provider.id,
    generatedAtMs: deps.nowMs ?? Date.now(),
    inputHash,
    tokenUsage: raw.usage,
  };
  deps.store.setSynth(project.canonicalPath, result);
  return { ok: true, result, fromCache: false };
}
