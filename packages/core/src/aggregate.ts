import crypto from "node:crypto";
import type {
  RawSignals,
  RecencyBucket,
  SourceId,
  Stage,
  StatusSnapshot,
  SynthCacheEntry,
  UnifiedProject,
} from "./domain.js";
import { STALE_MS } from "./domain.js";
import { basename, displayPath, pathKey } from "./paths.js";

/** Source preference order for picking the representative canonical path + one-liner. */
const SOURCE_RANK: Record<SourceId, number> = { "claude-code": 0, codex: 1, git: 2 };
const SOURCE_ORDER: SourceId[] = ["claude-code", "codex", "git"];

/**
 * Content hash of the inputs that a synthesis depends on. When this matches the
 * hash stored with a cached SynthResult, the synthesis can be skipped entirely —
 * the core cost-control mechanism.
 */
export function computeInputHash(input: {
  lastActiveMs: number;
  git?: StatusSnapshot | null;
  lastActionOneLiner?: string;
}): string {
  const parts = [
    String(input.lastActiveMs ?? 0),
    input.git?.headSha ?? "",
    String(input.git?.dirtyFileCount ?? 0),
    input.lastActionOneLiner ?? "",
  ];
  return crypto.createHash("sha1").update(parts.join("|")).digest("hex");
}

export interface MergeContext {
  /** Manual stage overrides, keyed by pathKey. */
  overrides: Map<string, Stage>;
  /** Cached synthesis results, keyed by pathKey. */
  synthCache: Map<string, SynthCacheEntry>;
  /** Reference "now" (ms) for recency bucketing. */
  nowMs: number;
}

interface Group {
  canonicalPath: string;
  repSource: SourceId;
  signals: RawSignals[];
}

function pickBySource<T>(
  signals: RawSignals[],
  get: (s: RawSignals) => T | undefined,
): T | undefined {
  for (const src of SOURCE_ORDER) {
    for (const s of signals) {
      if (s.source === src) {
        const v = get(s);
        if (v !== undefined) return v;
      }
    }
  }
  return undefined;
}

function bucketFor(liveStatus: UnifiedProject["liveStatus"], lastActiveMs: number, nowMs: number): RecencyBucket {
  if (liveStatus === "busy") return "active-now";
  const age = nowMs - lastActiveMs;
  return age <= STALE_MS ? "today" : "stale";
}

/**
 * Merge per-source signals into unified project cards. Signals are grouped by
 * case-insensitive pathKey; a case-preserved representative canonical path is
 * chosen (Claude Code preferred). Git snapshots are attached but never invent
 * new projects on their own.
 */
export function mergeByCanonicalPath(
  signals: RawSignals[],
  gitByPath: Map<string, StatusSnapshot>,
  ctx: MergeContext,
): UnifiedProject[] {
  const groups = new Map<string, Group>();
  for (const s of signals) {
    const key = pathKey(s.canonicalPath);
    let g = groups.get(key);
    if (!g) {
      g = { canonicalPath: s.canonicalPath, repSource: s.source, signals: [] };
      groups.set(key, g);
    } else if (SOURCE_RANK[s.source] < SOURCE_RANK[g.repSource]) {
      g.canonicalPath = s.canonicalPath;
      g.repSource = s.source;
    }
    g.signals.push(s);
  }

  const out: UnifiedProject[] = [];
  for (const [key, g] of groups) {
    const signals = g.signals;
    const signalsBySource: UnifiedProject["signalsBySource"] = {};
    for (const s of signals) signalsBySource[s.source] = s;

    const git = gitByPath.get(key);

    const lastActiveMs = signals.reduce((m, s) => (s.lastActiveMs !== undefined ? Math.max(m, s.lastActiveMs) : m), 0);
    const liveStatus: UnifiedProject["liveStatus"] = signals.some((s) => s.liveStatus === "busy")
      ? "busy"
      : signals.some((s) => s.liveStatus === "idle")
        ? "idle"
        : "none";

    let lastActionOneLiner = pickBySource(signals, (s) => s.lastActionOneLiner);
    if (lastActionOneLiner === undefined) lastActionOneLiner = git?.headCommit?.subject;

    const sources: SourceId[] = SOURCE_ORDER.filter(
      (src) => signals.some((s) => s.source === src) || (src === "git" && git !== undefined),
    );

    const override = ctx.overrides.get(key);
    const cached = ctx.synthCache.get(key);
    const stage: Stage | undefined = override ?? cached?.result.stage;
    const stageSource: UnifiedProject["stageSource"] = override ? "override" : cached ? "synth" : undefined;

    const currentHash = computeInputHash({ lastActiveMs, git: git ?? null, lastActionOneLiner });
    const synthStale = cached ? cached.inputHash !== currentHash : false;

    out.push({
      canonicalPath: g.canonicalPath,
      displayPath: displayPath(g.canonicalPath),
      name: basename(g.canonicalPath),
      sources,
      lastActiveMs,
      recencyBucket: bucketFor(liveStatus, lastActiveMs, ctx.nowMs),
      liveStatus,
      lastActionOneLiner,
      git,
      stage,
      stageSource,
      synth: cached?.result,
      synthStale,
      signalsBySource,
    });
  }
  return out;
}

/** Sort for the triage view: bucket order first, then most-recent within a bucket. */
export function sortByRecency(projects: UnifiedProject[]): UnifiedProject[] {
  const rank: Record<RecencyBucket, number> = { "active-now": 0, today: 1, stale: 2 };
  return [...projects].sort((a, b) => {
    const r = rank[a.recencyBucket] - rank[b.recencyBucket];
    if (r !== 0) return r;
    return b.lastActiveMs - a.lastActiveMs;
  });
}

/**
 * Stamp each project with its archived-at ms (by case-insensitive pathKey).
 * Archived state is sticky and independent of the mechanical signals, so it's
 * applied after collect rather than threaded through the adapters. Returns new
 * objects (collect output is never mutated).
 */
export function withArchived(
  projects: UnifiedProject[],
  archived: Map<string, number>,
): UnifiedProject[] {
  if (archived.size === 0) return projects;
  return projects.map((p) => {
    const at = archived.get(pathKey(p.canonicalPath));
    return at !== undefined ? { ...p, archivedAtMs: at } : p;
  });
}
