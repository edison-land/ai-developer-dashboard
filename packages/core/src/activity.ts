import type { ActivityItem, SourceId, UnifiedProject } from "./domain.js";

export const ACTIVITY_TIME_RANGES = ["today", "7d", "all"] as const;
export type ActivityTimeRange = (typeof ACTIVITY_TIME_RANGES)[number];

export interface ActivityFilter {
  /** Empty means all sources. */
  sources?: SourceId[];
  /** Matches either the project name or canonical path. */
  project?: string;
  range?: ActivityTimeRange;
}

export interface BuildActivityOpts {
  /** Cap the feed to the N most recent items. Default 100. */
  limit?: number;
}

/** Max items returned by buildActivityFeed when no limit is given. */
export const DEFAULT_ACTIVITY_LIMIT = 100;

/**
 * Derive a cross-project activity timeline from the already-collected project
 * list — no extra adapter work, no extra spawns. Each project contributes at
 * most one event per source it has signals for:
 *
 *   - Claude Code → its last action one-liner, timed by the CC session
 *   - Codex       → its last action one-liner (first_user_message), timed by the thread
 *   - Git         → the head commit subject, timed by the commit date
 *
 * (Multi-event-per-source — e.g. the last N commits or several Codex threads —
 * is a future enhancement; v1 surfaces the most recent event per source, which
 * is what answers "what happened recently, and where".) Sorted newest-first.
 */
export function buildActivityFeed(
  projects: UnifiedProject[],
  opts: BuildActivityOpts = {},
): ActivityItem[] {
  const limit = opts.limit ?? DEFAULT_ACTIVITY_LIMIT;
  const items: ActivityItem[] = [];

  for (const p of projects) {
    const cc = p.signalsBySource["claude-code"];
    if (cc?.lastActionOneLiner && cc.lastActiveMs) {
      items.push({
        source: "claude-code",
        canonicalPath: p.canonicalPath,
        project: p.name,
        atMs: cc.lastActiveMs,
        text: cc.lastActionOneLiner,
      });
    }
    const codex = p.signalsBySource["codex"];
    if (codex?.lastActionOneLiner && codex.lastActiveMs) {
      items.push({
        source: "codex",
        canonicalPath: p.canonicalPath,
        project: p.name,
        atMs: codex.lastActiveMs,
        text: codex.lastActionOneLiner,
      });
    }
    const head = p.git?.headCommit;
    if (head && head.subject && head.dateMs > 0) {
      items.push({
        source: "git",
        canonicalPath: p.canonicalPath,
        project: p.name,
        atMs: head.dateMs,
        text: head.subject,
      });
    }
  }

  items.sort((a, b) => b.atMs - a.atMs);
  return items.slice(0, Math.max(0, limit));
}

/** Apply the public activity-page filters to a derived feed. */
export function filterActivityFeed(
  items: ActivityItem[],
  filter: ActivityFilter = {},
  nowMs = Date.now(),
): ActivityItem[] {
  const sources = new Set(filter.sources ?? []);
  const project = filter.project?.trim().toLocaleLowerCase();
  const range = filter.range ?? "all";
  const fromMs =
    range === "today"
      ? new Date(new Date(nowMs).setHours(0, 0, 0, 0)).getTime()
      : range === "7d"
        ? nowMs - 7 * 24 * 60 * 60 * 1000
        : Number.NEGATIVE_INFINITY;

  return items.filter((item) => {
    if (sources.size > 0 && !sources.has(item.source)) return false;
    if (project) {
      const name = item.project.toLocaleLowerCase();
      const path = item.canonicalPath.toLocaleLowerCase();
      if (name !== project && path !== project) return false;
    }
    return item.atMs >= fromMs;
  });
}
