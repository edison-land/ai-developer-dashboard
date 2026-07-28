import type { SourceId, UnifiedProject } from "@ai-dashboard/core";

const DAY = 24 * 60 * 60 * 1000;

/** R2 time presets — upper bounds on project age (except "older" = strictly > 30d). */
export type RecencyFilter = "all" | "today" | "week" | "month" | "older";

export interface ProjectFilter {
  /** Case-insensitive project name/path/summary search. */
  query: string;
  /** R1: selected sources. Empty = no source filter (match all). OR semantics. */
  sources: SourceId[];
  /** R2: time preset. */
  recency: RecencyFilter;
}

export const DEFAULT_FILTER: ProjectFilter = { query: "", sources: [], recency: "all" };

export const RECENCY_OPTIONS: { value: RecencyFilter; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "today", label: "今天" },
  { value: "week", label: "本周" },
  { value: "month", label: "本月" },
  { value: "older", label: "更早" },
];

export const SOURCE_OPTIONS: SourceId[] = ["claude-code", "codex", "git"];

/**
 * Apply the R1 (source) + R2 (time) filters. A project must pass BOTH:
 *   - source: it has at least one of the selected sources (OR); empty selection = all.
 *   - time: its age (now − lastActiveMs) falls in the selected preset.
 * Pure + framework-free so it's unit-testable once UI test infra exists.
 */
export function filterProjects(projects: UnifiedProject[], f: ProjectFilter, now: number): UnifiedProject[] {
  return projects.filter((p) => {
    const query = f.query.trim().toLocaleLowerCase();
    if (query) {
      const haystack = [
        p.name,
        p.displayPath,
        p.lastActionOneLiner,
        p.synth?.summary,
        p.synth?.nextStep,
      ]
        .filter(Boolean)
        .join("\n")
        .toLocaleLowerCase();
      if (!haystack.includes(query)) return false;
    }
    if (f.sources.length > 0 && !f.sources.some((s) => p.sources.includes(s))) return false;
    if (f.recency !== "all") {
      const age = Math.max(0, now - p.lastActiveMs);
      if (f.recency === "older") {
        if (age <= 30 * DAY) return false;
      } else {
        const bound = f.recency === "today" ? DAY : f.recency === "week" ? 7 * DAY : 30 * DAY;
        if (age > bound) return false;
      }
    }
    return true;
  });
}

/** Whether a filter differs from the default (drives the "清除" affordance). */
export function isDefaultFilter(f: ProjectFilter): boolean {
  return f.query.trim() === "" && f.sources.length === 0 && f.recency === "all";
}
