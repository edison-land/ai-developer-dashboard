import type { SourceId } from "@ai-dashboard/core";
import { useRef } from "react";
import {
  DEFAULT_FILTER,
  RECENCY_OPTIONS,
  SOURCE_OPTIONS,
  type ProjectFilter,
} from "../filter";
import { Icon } from "./Icons";
import { SourceMark } from "./SourceMark";

export type ProjectViewMode = "list" | "stage";

export function ProjectToolbar({
  filter,
  onFilterChange,
  viewMode,
  onViewModeChange,
  resultCount,
  onOpenArchive,
}: {
  filter: ProjectFilter;
  onFilterChange: (filter: ProjectFilter) => void;
  viewMode: ProjectViewMode;
  onViewModeChange: (view: ProjectViewMode) => void;
  resultCount: number;
  onOpenArchive: () => void;
}) {
  const toggleSource = (source: SourceId) => {
    const active = filter.sources.includes(source);
    onFilterChange({
      ...filter,
      sources: active
        ? filter.sources.filter((item) => item !== source)
        : [...filter.sources, source],
    });
  };
  const searchRef = useRef<HTMLInputElement>(null);
  const hasStructuredFilters =
    filter.sources.length > 0 || filter.recency !== "all";
  const clearSearch = () => {
    onFilterChange({ ...filter, query: "" });
    searchRef.current?.focus();
  };

  return (
    <div className="ui-panel flex flex-wrap items-center gap-2.5 p-2.5">
      <div className="relative w-full shrink-0 sm:w-[300px] xl:w-[340px]">
        <label htmlFor="project-search" className="sr-only">
          搜索项目
        </label>
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center ui-faint">
          <Icon name="search" size={15} />
        </span>
        <input
          ref={searchRef}
          id="project-search"
          value={filter.query}
          onChange={(event) => onFilterChange({ ...filter, query: event.target.value })}
          placeholder="搜索项目、路径或当前情况"
          className="ui-input pl-9 pr-9"
          aria-label="搜索项目"
        />
        {filter.query && (
          <button
            type="button"
            onClick={clearSearch}
            className="absolute right-1.5 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full ui-muted hover:bg-[var(--surface-soft)] hover:text-[var(--text)]"
            aria-label="清除搜索"
            title="清除搜索"
          >
            <Icon name="close" size={13} />
          </button>
        )}
      </div>

      <FilterGroup label="来源" ariaLabel="来源筛选">
        {SOURCE_OPTIONS.map((source) => {
          const active = filter.sources.includes(source);
          return (
            <button
              key={source}
              type="button"
              onClick={() => toggleSource(source)}
              className="filter-option"
              data-active={active || undefined}
              aria-pressed={active}
            >
              <SourceMark
                source={source}
                compact
                showLabel
                className={active ? "ui-accent" : "ui-muted"}
              />
            </button>
          );
        })}
      </FilterGroup>

      <FilterGroup label="活跃时间" ariaLabel="活跃时间筛选">
        {RECENCY_OPTIONS.map((option) => {
          const active = filter.recency === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onFilterChange({ ...filter, recency: option.value })}
              className="filter-option"
              data-active={active || undefined}
              aria-pressed={active}
            >
              {option.label}
            </button>
          );
        })}
      </FilterGroup>

      <div
        className="flex rounded-lg p-1"
        style={{ background: "var(--surface-soft)" }}
        aria-label="项目视图"
      >
        <ViewButton
          active={viewMode === "stage"}
          icon="board"
          label="阶段"
          onClick={() => onViewModeChange("stage")}
        />
        <ViewButton
          active={viewMode === "list"}
          icon="list"
          label="列表"
          onClick={() => onViewModeChange("list")}
        />
      </div>

      {hasStructuredFilters && (
        <button
          type="button"
          className="rounded-lg px-2.5 py-2 text-xs font-semibold ui-muted hover:bg-[var(--surface-hover)]"
          onClick={() =>
            onFilterChange({ ...DEFAULT_FILTER, query: filter.query })
          }
        >
          重置筛选
        </button>
      )}

      <span className="px-1 text-xs ui-faint">{resultCount} 个项目</span>

      <button type="button" className="ui-icon-button ml-auto" onClick={onOpenArchive} title="查看归档" aria-label="查看归档">
        <Icon name="archive" size={16} />
      </button>
    </div>
  );
}

function FilterGroup({
  label,
  ariaLabel,
  children,
}: {
  label: string;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="shrink-0 px-0.5 text-[11px] font-semibold ui-faint">
        {label}
      </span>
      <div
        className="flex items-center gap-0.5 rounded-lg p-1"
        style={{ background: "var(--surface-soft)" }}
        aria-label={ariaLabel}
      >
        {children}
      </div>
    </div>
  );
}

function ViewButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: "list" | "board";
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition"
      style={
        active
          ? {
              color: "var(--text)",
              background: "var(--surface-elevated)",
              boxShadow: "var(--shadow-soft)",
            }
          : { color: "var(--muted)" }
      }
      aria-pressed={active}
    >
      <Icon name={icon} size={13} />
      {label}
    </button>
  );
}
