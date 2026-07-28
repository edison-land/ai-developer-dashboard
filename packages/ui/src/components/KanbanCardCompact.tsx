import { SOURCE_LABELS, type UnifiedProject } from "@ai-dashboard/core";
import { formatRelative, truncate } from "../lib";

/**
 * Compact card for the kanban default state — one line of action, source chips,
 * relative time. The full detail (git, synth, stage controls) is shown only when
 * the column is hovered (see KanbanView's expanded overlay).
 */
export function KanbanCardCompact({ project, now }: { project: UnifiedProject; now: number }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/70 px-2.5 py-2">
      <div className="flex items-center justify-between gap-1.5">
        <h4 className="truncate text-xs font-semibold text-slate-200" title={project.displayPath}>
          {project.name}
        </h4>
        {project.liveStatus === "busy" && (
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" title="busy 会话" />
        )}
      </div>
      <div className="mt-0.5 flex items-center gap-1">
        <div className="flex min-w-0 items-center gap-1">
          {project.sources.map((s) => (
            <span key={s} className="rounded bg-slate-800 px-1 py-px text-[9px] text-slate-400">
              {SOURCE_LABELS[s]}
            </span>
          ))}
        </div>
        <span className="ml-auto shrink-0 text-[10px] text-slate-600">{formatRelative(project.lastActiveMs, now)}</span>
      </div>
      {project.lastActionOneLiner && (
        <p className="mt-1 truncate text-[11px] text-slate-400" title={project.lastActionOneLiner}>
          {truncate(project.lastActionOneLiner, 48)}
        </p>
      )}
    </div>
  );
}
