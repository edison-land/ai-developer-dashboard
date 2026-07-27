import { z } from "zod";
import { STAGE } from "../domain.js";

/**
 * The strict JSON shape every synthesis result must satisfy. The provider is
 * told to emit exactly this; we still validate, because models occasionally
 * drift. Length caps keep the card readable and the bundle cheap.
 */
export const SynthSchema = z.object({
  stage: z.enum(STAGE),
  summary: z.string().min(1).max(280),
  nextStep: z.string().min(1).max(200),
  blockers: z.array(z.string().max(120)).max(5).default([]),
});

export type SynthPayload = z.infer<typeof SynthSchema>;

export type ParseResult = { ok: true; value: SynthPayload } | { ok: false; error: string };

/**
 * Pull a JSON object out of an arbitrary model response: strips ```json fences
 * and extracts the outermost `{ ... }`. We don't rely on the provider's JSON
 * mode (some models reject `response_format`), so the prompt asks for JSON and
 * this recovers it robustly. Returns null if no parseable object is present.
 */
function extractJsonObject(s: string): unknown {
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1]! : s;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  const slice = start !== -1 && end > start ? candidate.slice(start, end + 1) : candidate;
  try {
    return JSON.parse(slice);
  } catch {
    return null;
  }
}

/**
 * Validate an LLM response (already-parsed object OR raw text) against the
 * schema. Never throws — returns an error string on any failure so the caller
 * can fall back to a cached result instead of crashing the UI.
 */
export function parseSynthJson(raw: unknown): ParseResult {
  let obj: unknown = raw;
  if (typeof raw === "string") {
    obj = extractJsonObject(raw);
    if (obj === null) return { ok: false, error: "响应不是合法 JSON" };
  }
  const parsed = SynthSchema.safeParse(obj);
  if (!parsed.success) {
    const error = parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
    return { ok: false, error };
  }
  return { ok: true, value: parsed.data };
}
