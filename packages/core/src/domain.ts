/**
 * Domain model — the shared vocabulary between core, server, and ui.
 * Browser-safe: only types, labels, and constants. No node-only imports.
 */

// ── Stages (kanban columns) ────────────────────────────────────────────────
export const STAGE = ["idea", "building", "verifying", "done", "stalled"] as const;
export type Stage = (typeof STAGE)[number];
export const STAGE_ORDER: Stage[] = ["idea", "building", "verifying", "done", "stalled"];
export const STAGE_LABELS: Record<Stage, string> = {
  idea: "想法",
  building: "开发中",
  verifying: "待验证",
  done: "完成",
  stalled: "搁置",
};

// ── Recency buckets (triage home) ──────────────────────────────────────────
export const RECENCY_BUCKETS = ["active-now", "today", "stale"] as const;
export type RecencyBucket = (typeof RECENCY_BUCKETS)[number];
export const RECENCY_LABELS: Record<RecencyBucket, string> = {
  "active-now": "🔥 正在进行",
  today: "⏰ 最近活跃",
  stale: "❄ 需要关注",
};
/** A project is "stale" if untouched for longer than this (ms). */
export const STALE_MS = 3 * 24 * 60 * 60 * 1000;
/** A project is "today" (recently active) if touched within this (ms). */
export const TODAY_MS = STALE_MS;

// ── Sources ────────────────────────────────────────────────────────────────
export type SourceId = "claude-code" | "codex" | "git";
export const SOURCE_LABELS: Record<SourceId, string> = {
  "claude-code": "Claude Code",
  codex: "Codex",
  git: "Git",
};

// ── Adapter output ─────────────────────────────────────────────────────────
/** What ONE adapter contributes for ONE project (fields optional — partial is fine). */
export interface RawSignals {
  source: SourceId;
  /** Canonical forward-slash path — the merge key across adapters. */
  canonicalPath: string;
  lastActiveMs?: number;
  lastActionOneLiner?: string;
  /** Live "busy" signal — only Claude Code sessions provide this. */
  liveStatus?: "busy" | "idle";
  gitBranch?: string;
  gitSha?: string;
  gitOriginUrl?: string;
  tokensUsed?: number;
  costUsd?: number;
  /** Path to the session transcript jsonl, for lazy synth tail reading. */
  transcriptTailPath?: string;
  /** Free-form debug/inspection metadata — never shown to users by default. */
  rawMeta?: Record<string, unknown>;
}

// ── Git snapshot ───────────────────────────────────────────────────────────
export interface GitHeadCommit {
  subject: string;
  author: string;
  dateMs: number;
}
export interface StatusSnapshot {
  branch: string;
  headSha: string | null;
  headCommit: GitHeadCommit | null;
  dirtyFileCount: number;
  dirtySample?: string[];
  aheadBehind: { ahead: number; behind: number; hasUpstream: boolean };
  /** Not a repo / git missing / etc. Never thrown; surfaced as a muted line. */
  gitError?: string;
}

// ── Synthesis ──────────────────────────────────────────────────────────────
/** Which preset backs synthesis. Presets use the OpenAI Chat Completions shape. */
export type ProviderId =
  | "zhipu"
  | "openai"
  | "deepseek"
  | "kimi"
  | "siliconflow"
  | "openrouter"
  /** Retained for old cached results, but not treated as OpenAI-compatible. */
  | "anthropic"
  | "custom";

export interface ProviderPreset {
  id: ProviderId;
  label: string;
  requestUrl: string;
  recommendedModel: string;
  protocol: "openai-chat-completions" | "anthropic-messages";
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: "zhipu",
    label: "智谱 AI",
    requestUrl: "https://open.bigmodel.cn/api/paas/v4/",
    recommendedModel: "glm-4-flash-250414",
    protocol: "openai-chat-completions",
  },
  {
    id: "openai",
    label: "OpenAI GPT",
    requestUrl: "https://api.openai.com/v1/",
    recommendedModel: "gpt-4o-mini",
    protocol: "openai-chat-completions",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    requestUrl: "https://api.deepseek.com/",
    recommendedModel: "deepseek-chat",
    protocol: "openai-chat-completions",
  },
  {
    id: "kimi",
    label: "月之暗面 / Kimi",
    requestUrl: "https://api.moonshot.cn/v1/",
    recommendedModel: "moonshot-v1-8k",
    protocol: "openai-chat-completions",
  },
  {
    id: "siliconflow",
    label: "硅基流动",
    requestUrl: "https://api.siliconflow.cn/v1/",
    recommendedModel: "Qwen/Qwen2.5-7B-Instruct",
    protocol: "openai-chat-completions",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    requestUrl: "https://openrouter.ai/api/v1/",
    recommendedModel: "openai/gpt-4o-mini",
    protocol: "openai-chat-completions",
  },
  {
    id: "custom",
    label: "自定义 OpenAI 兼容接口",
    requestUrl: "",
    recommendedModel: "",
    protocol: "openai-chat-completions",
  },
  {
    id: "anthropic",
    label: "Anthropic Claude（协议暂不支持）",
    requestUrl: "https://api.anthropic.com/v1/",
    recommendedModel: "",
    protocol: "anthropic-messages",
  },
];

export function providerPreset(id: ProviderId): ProviderPreset | undefined {
  return PROVIDER_PRESETS.find((preset) => preset.id === id);
}
export const ATTENTION_KIND = ["user-action", "waiting", "none", "unknown"] as const;
export type AttentionKind = (typeof ATTENTION_KIND)[number];

export interface TokenUsage {
  input: number;
  output: number;
  cachedRead?: number;
}
export interface SynthResult {
  stage: Stage;
  summary: string; // 1-2 sentences
  nextStep: string; // 1 sentence
  blockers: string[]; // 0-N
  /** Whether a blocker needs the user's action now, is merely waiting on an
   * external condition, or is absent. Optional so older cache rows remain
   * readable; consumers treat a missing value as "unknown". */
  attention?: AttentionKind;
  model: string;
  provider: ProviderId;
  generatedAtMs: number;
  inputHash: string;
  tokenUsage?: TokenUsage;
}

/** Outcome of an on-demand synthesis attempt: cache hit, fresh result, or failure. */
export type SynthOutcome =
  | { ok: true; result: SynthResult; fromCache: boolean }
  | { ok: false; error: string; cached?: SynthResult };

// ── Unified card (what the UI renders) ─────────────────────────────────────
export interface UnifiedProject {
  canonicalPath: string;
  displayPath: string;
  name: string;
  sources: SourceId[];
  lastActiveMs: number;
  recencyBucket: RecencyBucket;
  liveStatus: "busy" | "idle" | "none";
  lastActionOneLiner?: string;
  git?: StatusSnapshot;
  stage?: Stage;
  stageSource?: "synth" | "override";
  synth?: SynthResult;
  /** True when underlying inputs changed since the cached synth was generated. */
  synthStale: boolean;
  /** Present (archived-at ms) when the user archived this project. Sticky: a new
   *  burst of activity does NOT clear it — only an explicit restore does. */
  archivedAtMs?: number;
  signalsBySource: Partial<Record<SourceId, RawSignals>>;
}

// ── Today's focus ──────────────────────────────────────────────────────────
export const FOCUS_REASON = ["pinned", "running", "needs-action", "recent"] as const;
export type FocusReason = (typeof FOCUS_REASON)[number];

export interface FocusPreferences {
  /** Ordered, user-pinned canonical paths. At most three are persisted. */
  pinnedPaths: string[];
  /** Canonical paths dismissed from automatic suggestions for `localDate`. */
  dismissedPaths: string[];
  /** Local calendar date in YYYY-MM-DD form. */
  localDate: string;
}

export interface FocusSelection {
  project: UnifiedProject;
  reason: FocusReason;
  pinned: boolean;
}

// ── Activity feed ──────────────────────────────────────────────────────────
export interface ActivityItem {
  source: SourceId;
  canonicalPath: string;
  project: string;
  atMs: number;
  text: string;
}

// ── Settings (public shape — never contains raw API keys) ──────────────────
export interface Settings {
  provider: ProviderId;
  /** OpenAI-compatible Chat Completions request base URL. */
  requestUrl: string;
  model: string;
  /** Public boolean only; the raw key is never returned by the API. */
  hasApiKey: boolean;
  hasAnthropicKey: boolean;
  hasOpenAIKey: boolean;
  hasZhipuKey: boolean;
  autoRefreshMins: number; // 0 = off
  synthOnRefresh: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  provider: "zhipu",
  requestUrl: "https://open.bigmodel.cn/api/paas/v4/",
  model: "glm-4-flash-250414",
  hasApiKey: false,
  hasAnthropicKey: false,
  hasOpenAIKey: false,
  hasZhipuKey: false,
  autoRefreshMins: 0,
  synthOnRefresh: false,
};

// ── DI seams (interfaces only; concrete impls live in /node and /server) ───
export interface SynthCacheEntry {
  result: SynthResult;
  inputHash: string;
}
export interface Store {
  getSynth(canonicalPath: string): SynthCacheEntry | undefined;
  setSynth(canonicalPath: string, result: SynthResult): void;
  getStageOverride(canonicalPath: string): Stage | undefined;
  setStageOverride(canonicalPath: string, stage: Stage): void;
  clearStageOverride(canonicalPath: string): void;
  /** Archive a project (sticky upsert). atMs = when archived. */
  archive(canonicalPath: string, atMs: number): void;
  /** Restore an archived project (no-op if not archived). */
  unarchive(canonicalPath: string): void;
  /** All overrides, keyed by pathKey. */
  allOverrides(): Map<string, Stage>;
  /** All archived projects, keyed by pathKey → archived-at ms. */
  allArchived(): Map<string, number>;
  /** All cached synth results, keyed by pathKey. */
  allSynth(): Map<string, SynthCacheEntry>;
  /** Ordered focus pins + dismissals for a local calendar date. */
  getFocusPreferences(localDate: string): FocusPreferences;
  /** Replace the complete focus preference state atomically. */
  setFocusPreferences(preferences: FocusPreferences): void;
  /** Remove one project's pin/dismiss state (used when archiving/completing). */
  clearFocusPreference(canonicalPath: string): void;
  getSettings(): Settings;
  /** Patch settings. Key values are stored internally; never returned raw by the API. */
  setSettings(
    patch: Partial<Settings> & {
      apiKey?: string;
      anthropicApiKey?: string;
      openaiApiKey?: string;
      zhipuApiKey?: string;
    },
  ): void;
  getApiKey(provider: ProviderId): string | undefined;
}

export interface SynthOpts {
  model?: string;
}
export interface SynthProvider {
  id: ProviderId;
  run(
    systemPrompt: string,
    userPrompt: string,
    opts: SynthOpts,
  ): Promise<{ json: unknown; usage: TokenUsage; model: string }>;
}

export interface TailRecord {
  role: "user" | "assistant";
  text: string;
}
export interface TailReader {
  /** Read the last N user/assistant records from a Claude Code session jsonl. */
  readTail(jsonPath: string, maxRecords: number): TailRecord[];
}
