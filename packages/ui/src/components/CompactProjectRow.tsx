import { STAGE_LABELS, type UnifiedProject } from "@ai-dashboard/core";
import { formatRelative } from "../lib";
import { Icon } from "./Icons";

export function CompactProjectRow({
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
      className="grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 border-t px-4 py-3 text-left transition first:border-t-0 hover:bg-[var(--surface-hover)] ui-divider"
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold ui-text">{project.name}</span>
        <span className="mt-0.5 block truncate text-xs ui-muted">
          {project.synth?.summary ?? project.lastActionOneLiner ?? "暂无近期说明"}
        </span>
      </span>
      <span className="ui-chip whitespace-nowrap">
        {project.stage ? STAGE_LABELS[project.stage] : "未分类"}
      </span>
      <span className="inline-flex min-w-[74px] items-center justify-end gap-1.5 whitespace-nowrap text-xs ui-muted">
        <Icon name="clock" size={13} />
        {formatRelative(project.lastActiveMs, now)}
      </span>
    </button>
  );
}
