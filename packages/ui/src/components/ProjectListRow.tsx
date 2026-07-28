import { STAGE_LABELS, type UnifiedProject } from "@ai-dashboard/core";
import { formatRelative } from "../lib";
import { Icon } from "./Icons";

export function ProjectListRow({
  project,
  now,
  onOpen,
  onArchive,
  archivePending,
}: {
  project: UnifiedProject;
  now: number;
  onOpen: () => void;
  onArchive: () => void;
  archivePending: boolean;
}) {
  const needsAction = project.synth?.attention === "user-action";
  return (
    <div
      className="project-list-row w-full border-t px-4 py-3.5 text-left transition first:border-t-0 hover:bg-[var(--surface-hover)] ui-divider"
    >
      <button
        type="button"
        className="project-list-open min-w-0 text-left"
        onClick={onOpen}
        aria-label={`打开 ${project.name} 项目详情`}
      >
        <span className="project-list-identity min-w-0">
          <span className="flex items-center gap-2">
            {project.liveStatus === "busy" && (
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: "var(--success)" }} />
            )}
            <strong className="truncate text-sm ui-text">{project.name}</strong>
          </span>
          <span className="mt-1 block truncate text-xs ui-faint" title={project.displayPath}>
            {project.displayPath}
          </span>
        </span>
        <span className="project-list-summary line-clamp-2 text-sm leading-5 ui-text-soft">
          {project.synth?.summary ?? project.lastActionOneLiner ?? "暂无近期说明"}
        </span>
      </button>
      <span className={`project-list-stage ${needsAction ? "ui-chip ui-warning" : "ui-chip"}`}>
        {needsAction && <Icon name="alert" size={12} />}
        {needsAction ? "需要处理" : project.stage ? STAGE_LABELS[project.stage] : "未分类"}
      </span>
      <button
        type="button"
        className="project-list-archive ui-button px-2 py-1.5 text-xs"
        onClick={onArchive}
        disabled={archivePending}
        aria-label={`归档 ${project.name}`}
        title={`归档 ${project.name}`}
      >
        <Icon name="archive" size={13} />
        <span className="hidden xl:inline">
          {archivePending ? "归档中…" : "归档"}
        </span>
      </button>
      <span className="project-list-time inline-flex min-w-[82px] justify-start gap-1.5 whitespace-nowrap text-xs ui-muted">
        <Icon name="clock" size={13} />
        {formatRelative(project.lastActiveMs, now)}
      </span>
    </div>
  );
}
