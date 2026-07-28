import {
  STAGE_LABELS,
  STAGE_ORDER,
  type Stage,
  type UnifiedProject,
} from "@ai-dashboard/core";
import { useEffect } from "react";
import { ApiError } from "../api";
import {
  useArchive,
  useClearStage,
  useSetStage,
  useSynthesize,
} from "../hooks";
import { formatRelative } from "../lib";
import { Icon } from "./Icons";
import { SourceMark } from "./SourceMark";

export function ProjectDetailsModal({
  project,
  onClose,
}: {
  project: UnifiedProject;
  onClose: () => void;
}) {
  const now = Date.now();
  const setStage = useSetStage();
  const clearStage = useClearStage();
  const synth = useSynthesize();
  const archive = useArchive();
  const synthOutcome = synth.data?.outcome;
  const synthFailMsg =
    (synthOutcome && !synthOutcome.ok ? synthOutcome.error : null) ??
    (synth.isError
      ? synth.error instanceof ApiError
        ? (synth.error.serverMessage ?? synth.error.message)
        : "总结请求失败"
      : null);
  const overrideValue = project.stageSource === "override" ? project.stage : "__auto__";

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  const onStageChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    if (value === "__auto__") clearStage.mutate(project.canonicalPath);
    else setStage.mutate({ canonical: project.canonicalPath, stage: value as Stage });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-detail-title"
    >
      <button
        type="button"
        className="absolute inset-0 z-0 cursor-default"
        style={{ background: "rgba(3, 8, 16, 0.52)" }}
        onClick={onClose}
        aria-label="关闭项目详情"
      />
      <section
        className="page-rise relative z-10 flex h-full w-full flex-col overflow-hidden border shadow-2xl ui-divider sm:h-auto sm:max-h-[calc(100vh-48px)] sm:max-w-[820px] sm:rounded-2xl"
        style={{ background: "var(--page)" }}
      >
        <header className="border-b px-5 py-4 ui-divider" style={{ background: "var(--surface)" }}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] ui-accent">
                Project detail
              </p>
              <h2
                id="project-detail-title"
                className="mt-1 truncate text-xl font-bold tracking-[-0.025em] ui-text"
              >
                {project.name}
              </h2>
              <p className="mt-1 break-all text-xs leading-5 ui-muted">
                {project.displayPath}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-3">
              <button type="button" className="ui-icon-button" onClick={onClose} aria-label="关闭">
                <Icon name="close" size={17} />
              </button>
              <span
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ui-muted"
                style={{ background: "var(--surface-soft)" }}
                title={`最近活跃 · ${formatRelative(project.lastActiveMs, now)}`}
              >
                <Icon name="clock" size={13} />
                最近活跃 · {formatRelative(project.lastActiveMs, now)}
              </span>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {project.sources.map((source) => (
              <SourceMark key={source} source={source} showLabel />
            ))}
          </div>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          <section className="ui-panel p-4">
            <SectionLabel>当前情况</SectionLabel>
            <p className="mt-2 text-sm leading-6 ui-text-soft">
              {project.synth?.summary ?? project.lastActionOneLiner ?? "暂无近期说明。"}
            </p>
            <div className="mt-4 rounded-xl p-3.5" style={{ background: "var(--accent-soft)" }}>
              <SectionLabel accent>下一步</SectionLabel>
              <p className="mt-1.5 text-sm font-semibold leading-6 ui-text">
                {project.synth?.nextStep ?? "生成总结以获得可执行的下一步。"}
              </p>
            </div>
            {project.synthStale && (
              <p className="mt-3 inline-flex items-center gap-1.5 text-xs ui-warning">
                <Icon name="alert" size={13} />
                底层输入已变化，建议更新总结
              </p>
            )}
          </section>

          {project.synth?.blockers && project.synth.blockers.length > 0 && (
            <section className="ui-panel p-4">
              <SectionLabel>阻塞</SectionLabel>
              <ul className="mt-2 space-y-2">
                {project.synth.blockers.map((blocker, index) => (
                  <li
                    key={index}
                    className="flex gap-2 rounded-lg px-3 py-2 text-sm leading-5 ui-warning"
                    style={{ background: "var(--warning-soft)" }}
                  >
                    <Icon name="alert" size={14} className="mt-0.5 shrink-0" />
                    {blocker}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {project.lastActionOneLiner && (
            <section className="ui-panel p-4">
              <SectionLabel>最近动作</SectionLabel>
              <p className="mt-2 text-sm leading-6 ui-text-soft">{project.lastActionOneLiner}</p>
            </section>
          )}

          <section className="ui-panel p-4">
            <SectionLabel>Git 状态</SectionLabel>
            {project.git ? (
              project.git.gitError ? (
                <p className="mt-2 text-sm ui-muted">{project.git.gitError}</p>
              ) : (
                <div className="mt-3 space-y-2 text-sm ui-text-soft">
                  <div className="flex items-center justify-between gap-3">
                    <span className="ui-muted">分支</span>
                    <code className="truncate font-mono text-xs ui-text">{project.git.branch}</code>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="ui-muted">工作区</span>
                    <span className={project.git.dirtyFileCount > 0 ? "ui-warning" : "ui-success"}>
                      {project.git.dirtyFileCount > 0
                        ? `${project.git.dirtyFileCount} 个未提交`
                        : "干净"}
                    </span>
                  </div>
                  {(project.git.aheadBehind.ahead > 0 || project.git.aheadBehind.behind > 0) && (
                    <div className="flex items-center justify-between gap-3">
                      <span className="ui-muted">远端差异</span>
                      <span>
                        ↑{project.git.aheadBehind.ahead} · ↓{project.git.aheadBehind.behind}
                      </span>
                    </div>
                  )}
                  {project.git.headCommit && (
                    <div className="border-t pt-3 text-xs leading-5 ui-muted ui-divider">
                      {project.git.headCommit.subject}
                    </div>
                  )}
                </div>
              )
            ) : (
              <p className="mt-2 text-sm ui-muted">没有 Git 状态。</p>
            )}
          </section>

          <section className="ui-panel p-4">
            <SectionLabel>项目管理</SectionLabel>
            <label className="mt-3 block">
              <span className="mb-1.5 block text-xs ui-muted">阶段</span>
              <select
                value={overrideValue}
                onChange={onStageChange}
                disabled={setStage.isPending || clearStage.isPending}
                className="ui-input"
              >
                <option value="__auto__">自动判断</option>
                {STAGE_ORDER.map((stage) => (
                  <option key={stage} value={stage}>
                    {STAGE_LABELS[stage]}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="ui-button ui-button-primary"
                onClick={() => synth.mutate(project.canonicalPath)}
                disabled={synth.isPending}
              >
                <Icon name="spark" size={15} />
                {synth.isPending ? "总结中…" : project.synth ? "更新总结" : "生成总结"}
              </button>
              <button
                type="button"
                className="ui-button ml-auto"
                onClick={() =>
                  archive.mutate(project.canonicalPath, { onSuccess: onClose })
                }
                disabled={archive.isPending}
              >
                <Icon name="archive" size={15} />
                {archive.isPending ? "归档中…" : "归档"}
              </button>
            </div>
            {project.synth && (
              <p className="mt-3 text-[11px] leading-5 ui-faint">
                {project.synth.provider}/{project.synth.model} ·{" "}
                {formatRelative(project.synth.generatedAtMs, now)}
              </p>
            )}
            {synthFailMsg && (
              <p role="alert" className="mt-3 text-xs leading-5 ui-danger">
                {synthFailMsg}
              </p>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}

function SectionLabel({
  children,
  accent = false,
}: {
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className={`text-[11px] font-bold uppercase tracking-[0.14em] ${accent ? "ui-accent" : "ui-faint"}`}>
      {children}
    </div>
  );
}
