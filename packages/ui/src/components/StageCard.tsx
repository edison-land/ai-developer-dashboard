import type { UnifiedProject } from "@ai-dashboard/core";
import { formatRelative } from "../lib";
import { SourceMark } from "./SourceMark";

export function StageCard({
  project,
  now,
  onOpen,
}: {
  project: UnifiedProject;
  now: number;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="stage-card group w-full rounded-xl border p-3 text-left transition hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-soft)] ui-divider"
      style={{ background: "var(--surface-elevated)" }}
    >
      <span className="flex items-start justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          {project.liveStatus === "busy" && (
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: "var(--success)" }} />
          )}
          <strong className="truncate text-sm ui-text" title={project.displayPath}>
            {project.name}
          </strong>
        </span>
        <span className="flex shrink-0 items-center gap-0.5">
          {project.sources.map((source) => (
            <SourceMark key={source} source={source} compact />
          ))}
        </span>
      </span>
      <span className="mt-2 line-clamp-2 block text-xs leading-5 ui-muted">
        {project.synth?.summary ?? project.lastActionOneLiner ?? "暂无近期说明"}
      </span>
      <span className="stage-card-next block">
        <span className="block text-[10px] font-bold uppercase tracking-[0.14em] ui-accent">
          下一步
        </span>
        <span className="mt-1 line-clamp-2 block text-xs font-semibold leading-5 ui-text-soft">
          {project.synth?.nextStep ?? "打开详情，确认下一步行动。"}
        </span>
      </span>
      <span className="mt-2 block text-[11px] ui-faint">
        {formatRelative(project.lastActiveMs, now)}
      </span>
    </button>
  );
}
