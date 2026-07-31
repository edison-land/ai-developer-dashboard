import type { ActivityTimeRange, SourceId } from "@ai-dashboard/core";

export const ACTIVITY_FILTER_KEY = "ai-dashboard:activity-filter";

export interface ActivityFilterState {
  sources: SourceId[];
  project: string;
  range: ActivityTimeRange;
}

export const DEFAULT_ACTIVITY_FILTER: ActivityFilterState = {
  sources: [],
  project: "",
  range: "all",
};

export const ACTIVITY_RANGE_OPTIONS: { value: ActivityTimeRange; label: string }[] = [
  { value: "today", label: "今天" },
  { value: "7d", label: "最近 7 天" },
  { value: "all", label: "全部时间" },
];

export function loadActivityFilter(): ActivityFilterState {
  try {
    const raw = localStorage.getItem(ACTIVITY_FILTER_KEY);
    if (!raw) return DEFAULT_ACTIVITY_FILTER;
    const parsed = JSON.parse(raw) as Partial<ActivityFilterState>;
    const sources = Array.isArray(parsed.sources)
      ? parsed.sources.filter(
          (source): source is SourceId =>
            source === "claude-code" || source === "codex" || source === "git",
        )
      : [];
    const range = parsed.range === "today" || parsed.range === "7d" ? parsed.range : "all";
    return {
      sources,
      project: typeof parsed.project === "string" ? parsed.project : "",
      range,
    };
  } catch {
    return DEFAULT_ACTIVITY_FILTER;
  }
}

export function hasActivityFilter(filter: ActivityFilterState): boolean {
  return filter.sources.length > 0 || filter.project.length > 0 || filter.range !== "all";
}
