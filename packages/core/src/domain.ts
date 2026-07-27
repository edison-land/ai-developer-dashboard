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
/** Which AI provider backs synthesis. Zhipu is the default (OpenAI-compatible BigModel API). */
export type ProviderId = "zhipu" | "anthropic" | "openai";

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
  signalsBySource: Partial<Record<SourceId, RawSignals>>;
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
  model: string;
  hasAnthropicKey: boolean;
  hasOpenAIKey: boolean;
  hasZhipuKey: boolean;
  autoRefreshMins: number; // 0 = off
  synthOnRefresh: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  provider: "zhipu",
  model: "glm-4-flash-250414",
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
  /** All overrides, keyed by pathKey. */
  allOverrides(): Map<string, Stage>;
  /** All cached synth results, keyed by pathKey. */
  allSynth(): Map<string, SynthCacheEntry>;
  getSettings(): Settings;
  /** Patch settings. Key values are stored internally; never returned raw by the API. */
  setSettings(patch: Partial<Settings> & { anthropicApiKey?: string; openaiApiKey?: string; zhipuApiKey?: string }): void;
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
