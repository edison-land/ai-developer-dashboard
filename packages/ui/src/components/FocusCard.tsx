import {
  STAGE_LABELS,
  type FocusSelection,
} from "@ai-dashboard/core";
import { formatRelative } from "../lib";
import { FocusEditor } from "./FocusEditor";
import { Icon } from "./Icons";
import { SourceMark } from "./SourceMark";

const REASON_LABEL = {
  running: "正在进行",
  "needs-action": "需要你处理",
  recent: "近期活跃",
} as const;

export function FocusCard({
  selection,
  index,
  now,
  editing,
  pinnedIndex,
  pinnedCount,
  saving,
  summaryPending,
  onOpen,
  onSynthesize,
  onPin,
  onUnpin,
  onMoveLeft,
  onMoveRight,
  onDismiss,
}: {
  selection: FocusSelection;
  index: number;
  now: number;
  editing: boolean;
  pinnedIndex: number;
  pinnedCount: number;
  saving: boolean;
  summaryPending: boolean;
  onOpen: () => void;
  onSynthesize: () => void;
  onPin: () => void;
  onUnpin: () => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onDismiss: () => void;
}) {
  const { project, reason, pinned } = selection;
  const summary =
    project.synth?.summary ??
    project.lastActionOneLiner ??
    "这个项目还没有可用的近期说明。";
  const nextStep = project.synth?.nextStep ?? "打开详情，确认下一步行动。";
  const stage = project.stage ? STAGE_LABELS[project.stage] : "未分类";
  const statusReason =
    reason === "pinned"
      ? project.liveStatus === "busy"
        ? "running"
        : project.synth?.attention === "user-action"
          ? "needs-action"
          : "recent"
      : reason;
  const reasonTone =
    statusReason === "needs-action"
      ? "ui-warning"
      : statusReason === "running"
        ? "ui-success"
        : "ui-accent";

  return (
    <article
      className={`ui-card group flex min-h-[268px] flex-col p-5 ${
        pinned ? "focus-card-pinned" : ""
      }`}
    >
      <button
        type="button"
        onClick={onOpen}
        disabled={editing}
        className="flex flex-1 flex-col text-left disabled:cursor-default"
        aria-label={`打开 ${project.name} 项目详情`}
      >
        <div className="flex items-start justify-between gap-3">
          <span className="text-xs font-bold tracking-[0.16em] ui-accent">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="flex items-center justify-end gap-1.5">
            <span className="flex items-center gap-1">
              {project.sources.map((source) => (
                <SourceMark key={source} source={source} compact />
              ))}
            </span>
            <span className="ui-chip">{stage}</span>
          </span>
        </div>

        <h3
          className="mt-4 truncate text-lg font-bold tracking-[-0.02em] ui-text"
          title={project.displayPath}
        >
          {project.name}
        </h3>

        <div className="mt-5">
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] ui-faint">
            当前情况
          </div>
          <p className="mt-1.5 line-clamp-2 text-[15px] leading-6 ui-text-soft">
            {summary}
          </p>
        </div>

        <div
          className="mt-4 rounded-xl px-3.5 py-3"
          style={{ background: "var(--accent-soft)" }}
        >
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] ui-accent">
            下一步
          </div>
          <p className="mt-1 line-clamp-2 text-sm font-semibold leading-5 ui-text">
            {nextStep}
          </p>
        </div>
      </button>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs ui-muted">
          <span className={`inline-flex items-center gap-1.5 font-semibold ${reasonTone}`}>
            <Icon
              name={statusReason === "needs-action" ? "alert" : "spark"}
              size={13}
            />
            {REASON_LABEL[statusReason]}
          </span>
          <span>·</span>
          <span>{formatRelative(project.lastActiveMs, now)}</span>
          {project.synthStale && (
            <>
              <span>·</span>
              <span className="ui-warning">总结需更新</span>
            </>
          )}
        </div>
        <button
          type="button"
          className="ui-button shrink-0 px-2.5 py-1.5 text-xs"
          onClick={onSynthesize}
          disabled={summaryPending}
        >
          <Icon
            name="spark"
            size={13}
            className={summaryPending ? "animate-pulse" : ""}
          />
          {summaryPending ? "总结中…" : project.synth ? "更新总结" : "生成总结"}
        </button>
      </div>

      {editing && (
        <FocusEditor
          pinned={pinned}
          canMoveLeft={pinned && pinnedIndex > 0}
          canMoveRight={pinned && pinnedIndex < pinnedCount - 1}
          onPin={onPin}
          onUnpin={onUnpin}
          onMoveLeft={onMoveLeft}
          onMoveRight={onMoveRight}
          onDismiss={onDismiss}
          disabled={saving}
        />
      )}
    </article>
  );
}
