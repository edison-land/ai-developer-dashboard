import { SOURCE_LABELS, type SourceId } from "@ai-dashboard/core";
import {
  DEFAULT_FILTER,
  RECENCY_OPTIONS,
  SOURCE_OPTIONS,
  isDefaultFilter,
  type ProjectFilter,
  type RecencyFilter,
} from "../filter";

/** Toggle a source in the multi-select (OR semantics). */
function toggleSource(f: ProjectFilter, s: SourceId): ProjectFilter {
  const has = f.sources.includes(s);
  return { ...f, sources: has ? f.sources.filter((x) => x !== s) : [...f.sources, s] };
}

export function FilterBar({
  filter,
  onChange,
}: {
  filter: ProjectFilter;
  onChange: (f: ProjectFilter) => void;
}) {
  const showClear = !isDefaultFilter(filter);
  const matched = filter.sources.length;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2 text-xs">
      <div className="flex items-center gap-1.5">
        <span className="text-slate-500">来源</span>
        {SOURCE_OPTIONS.map((s) => {
          const active = filter.sources.includes(s);
          return (
            <button
              key={s}
              aria-pressed={active}
              onClick={() => onChange(toggleSource(filter, s))}
              className={
                "rounded-full px-2 py-0.5 transition-colors " +
                (active
                  ? "bg-sky-600 text-white"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200")
              }
            >
              {SOURCE_LABELS[s]}
            </button>
          );
        })}
        {matched > 0 && <span className="text-slate-600">·{matched}</span>}
      </div>

      <div className="flex items-center gap-1.5">
        <span className="text-slate-500">活跃</span>
        {RECENCY_OPTIONS.map((o) => {
          const active = filter.recency === o.value;
          return (
            <button
              key={o.value}
              aria-pressed={active}
              onClick={() => onChange({ ...filter, recency: o.value as RecencyFilter })}
              className={
                "rounded-full px-2 py-0.5 transition-colors " +
                (active
                  ? "bg-sky-600 text-white"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200")
              }
            >
              {o.label}
            </button>
          );
        })}
      </div>

      {showClear && (
        <button
          onClick={() => onChange(DEFAULT_FILTER)}
          className="ml-auto rounded px-2 py-0.5 text-slate-500 hover:bg-slate-800 hover:text-slate-300"
        >
          清除
        </button>
      )}
    </div>
  );
}
