import {
  filterActivityFeed,
  SOURCE_LABELS,
  type SourceId,
} from "@ai-dashboard/core";
import { useEffect, useMemo, useState } from "react";
import { ErrorBanner } from "../components/ErrorBanner";
import { SourceMark } from "../components/SourceMark";
import {
  ACTIVITY_FILTER_KEY,
  ACTIVITY_RANGE_OPTIONS,
  DEFAULT_ACTIVITY_FILTER,
  hasActivityFilter,
  loadActivityFilter,
  type ActivityFilterState,
} from "../activityFilter";
import { useActivity, useProjects } from "../hooks";
import { formatRelative, truncate } from "../lib";

const SOURCE_OPTIONS: SourceId[] = ["claude-code", "codex", "git"];

export function ActivityView() {
  const [filter, setFilter] = useState<ActivityFilterState>(loadActivityFilter);
  const activity = useActivity(filter);
  const projects = useProjects();
  const now = Date.now();
  const items = useMemo(
    () => filterActivityFeed(activity.data?.items ?? [], filter, now),
    [activity.data?.items, filter, now],
  );

  useEffect(() => {
    try {
      localStorage.setItem(ACTIVITY_FILTER_KEY, JSON.stringify(filter));
    } catch {
      // Filtering remains usable when storage is unavailable.
    }
  }, [filter]);

  const projectOptions = useMemo(() => {
    const byPath = new Map<string, { value: string; label: string }>();
    for (const project of projects.data?.projects ?? []) {
      byPath.set(project.canonicalPath, { value: project.canonicalPath, label: project.name });
    }
    for (const item of activity.data?.items ?? []) {
      if (!byPath.has(item.canonicalPath)) {
        byPath.set(item.canonicalPath, { value: item.canonicalPath, label: item.project });
      }
    }
    return [...byPath.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [activity.data?.items, projects.data?.projects]);

  if (activity.isError) {
    return <ErrorBanner error={activity.error} onRetry={() => activity.refetch()} />;
  }
  if (activity.isLoading && !activity.data) {
    return <p className="py-16 text-center text-sm ui-muted">正在整理最近动态…</p>;
  }

  return (
    <div className="page-rise mx-auto max-w-4xl">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] ui-accent">
          Activity stream
        </p>
        <h2 className="mt-1 text-2xl font-bold tracking-[-0.035em] ui-text">最近动态</h2>
        <p className="mt-1 text-sm ui-muted">
          Claude Code、Codex 与 Git 的最近动作，按时间合并。
        </p>
      </div>

      <div className="ui-panel mt-5 flex flex-wrap items-center gap-3 p-3">
        <div className="flex items-center gap-1.5">
          <span className="px-0.5 text-[11px] font-semibold ui-faint">来源</span>
          <div className="flex items-center gap-0.5 rounded-lg p-1" style={{ background: "var(--surface-soft)" }} aria-label="来源筛选">
            {SOURCE_OPTIONS.map((source) => {
              const active = filter.sources.includes(source);
              return (
                <button
                  key={source}
                  type="button"
                  className="filter-option"
                  data-active={active || undefined}
                  aria-pressed={active}
                  onClick={() =>
                    setFilter((current) => ({
                      ...current,
                      sources: active
                        ? current.sources.filter((item) => item !== source)
                        : [...current.sources, source],
                    }))
                  }
                >
                  <SourceMark source={source} compact showLabel className={active ? "ui-accent" : "ui-muted"} />
                </button>
              );
            })}
          </div>
        </div>

        <label className="flex items-center gap-1.5 text-[11px] font-semibold ui-faint" htmlFor="activity-project-filter">
          项目
          <select
            id="activity-project-filter"
            className="ui-input min-w-[150px] py-1.5 text-xs"
            value={filter.project}
            onChange={(event) => setFilter((current) => ({ ...current, project: event.target.value }))}
          >
            <option value="">全部项目</option>
            {projectOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-1.5">
          <span className="px-0.5 text-[11px] font-semibold ui-faint">时间</span>
          <div className="flex items-center gap-0.5 rounded-lg p-1" style={{ background: "var(--surface-soft)" }} aria-label="时间范围筛选">
            {ACTIVITY_RANGE_OPTIONS.map((option) => {
              const active = filter.range === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  className="filter-option"
                  data-active={active || undefined}
                  aria-pressed={active}
                  onClick={() => setFilter((current) => ({ ...current, range: option.value }))}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        {hasActivityFilter(filter) && (
          <button
            type="button"
            className="rounded-lg px-2.5 py-2 text-xs font-semibold ui-muted hover:bg-[var(--surface-hover)]"
            onClick={() => setFilter(DEFAULT_ACTIVITY_FILTER)}
          >
            清除筛选
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="ui-panel mt-6 px-6 py-14 text-center">
          <h3 className="text-base font-bold ui-text">还没有可展示的动态</h3>
          <p className="mt-2 text-sm ui-muted">
            {hasActivityFilter(filter)
              ? "当前筛选条件没有匹配动态，请调整来源、项目或时间范围。"
              : "打开开发工具运行一会，或提交代码后再刷新。"}
          </p>
        </div>
      ) : (
        <ol className="relative mt-7 space-y-3 before:absolute before:bottom-5 before:left-[18px] before:top-5 before:w-px before:bg-[var(--border)]">
          {items.map((item, index) => (
            <li
              key={`${item.canonicalPath}-${item.source}-${item.atMs}-${index}`}
              className="ui-panel relative ml-0 grid grid-cols-[36px_minmax(0,1fr)] gap-3 p-4"
            >
              <span
                className="relative z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border ui-divider"
                style={{ background: "var(--surface-elevated)" }}
              >
                <SourceMark source={item.source} />
              </span>
              <div className="min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold ui-text" title={item.canonicalPath}>
                      {item.project}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-sm leading-6 ui-text-soft">
                      {truncate(item.text, 220)}
                    </p>
                  </div>
                  <time className="shrink-0 text-xs ui-muted">
                    {formatRelative(item.atMs, now)}
                  </time>
                </div>
                <p className="mt-2 text-[11px] ui-faint">{SOURCE_LABELS[item.source]}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
