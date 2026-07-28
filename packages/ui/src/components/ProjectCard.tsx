import { RECENCY_LABELS, SOURCE_LABELS, STAGE, STAGE_LABELS, STAGE_ORDER, type Stage, type UnifiedProject } from "@ai-dashboard/core";
import { ApiError } from "../api";
import { useArchive, useClearStage, useSetStage, useSynthesize } from "../hooks";
import { formatRelative, truncate } from "../lib";

const STAGE_DOT: Record<Stage, string> = {
  idea: "bg-sky-400",
  building: "bg-amber-400",
  verifying: "bg-violet-400",
  done: "bg-emerald-400",
  stalled: "bg-slate-500",
};

export function ProjectCard({ project, now }: { project: UnifiedProject; now: number }) {
  const setStage = useSetStage();
  const clearStage = useClearStage();
  const synth = useSynthesize();
  const archive = useArchive();
  const synthOutcome = synth.data?.outcome;
  // A failed outcome (model error) comes back as HTTP 200 with outcome.ok=false;
  // a network/server failure surfaces as synth.isError. Surface either inline.
  const synthFailMsg =
    (synthOutcome && !synthOutcome.ok ? synthOutcome.error : null) ??
    (synth.isError
      ? synth.error instanceof ApiError
        ? (synth.error.serverMessage ?? synth.error.message)
        : "总结请求失败"
      : null);
  const git = project.git;
  const dirty = git?.dirtyFileCount ?? 0;
  const effectiveStage = project.stage;
  const overrideValue = project.stageSource === "override" ? project.stage : "__auto__";

  const onStageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    if (v === "__auto__") clearStage.mutate(project.canonicalPath);
    else setStage.mutate({ canonical: project.canonicalPath, stage: v as Stage });
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 shadow-sm hover:border-slate-700">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {project.liveStatus === "busy" && (
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </span>
            )}
            {project.liveStatus === "idle" && (
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-amber-400" />
            )}
            <h3 className="truncate font-semibold text-slate-100">{project.name}</h3>
            {effectiveStage && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
                <span className={`h-1.5 w-1.5 rounded-full ${STAGE_DOT[effectiveStage]}`} />
                {STAGE_LABELS[effectiveStage]}
              </span>
            )}
          </div>
          <div className="mt-0.5 truncate text-xs text-slate-500" title={project.displayPath}>
            {project.displayPath}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1">
          {project.sources.map((s) => (
            <span key={s} className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
              {SOURCE_LABELS[s]}
            </span>
          ))}
        </div>
      </div>

      {project.lastActionOneLiner && (
        <p className="mt-2 line-clamp-2 text-sm text-slate-300">
          <span className="text-slate-500">最后：</span>
          {truncate(project.lastActionOneLiner, 160)}
        </p>
      )}

      {git && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
          <span className="font-mono text-slate-300">{git.branch}</span>
          {git.gitError ? (
            <span className="text-slate-600">{git.gitError}</span>
          ) : (
            <>
              {dirty > 0 ? (
                <span className="text-amber-400">⚠ {dirty} 个未提交</span>
              ) : (
                <span className="text-emerald-500/80">✓ 干净</span>
              )}
              {git.aheadBehind.ahead > 0 && <span>↑{git.aheadBehind.ahead}</span>}
              {git.aheadBehind.behind > 0 && <span className="text-sky-400">↓{git.aheadBehind.behind}</span>}
              {git.headCommit && <span className="truncate text-slate-500">· {truncate(git.headCommit.subject, 60)}</span>}
            </>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-800 pt-2 text-xs">
        <span className="text-slate-500">
          {RECENCY_LABELS[project.recencyBucket]} · {formatRelative(project.lastActiveMs, now)}
        </span>
        <label className="flex items-center gap-1 text-slate-500">
          阶段
          <select
            value={overrideValue}
            onChange={onStageChange}
            disabled={setStage.isPending || clearStage.isPending}
            className="rounded border border-slate-700 bg-slate-800 px-1 py-0.5 text-xs text-slate-200"
          >
            <option value="__auto__">自动</option>
            {STAGE_ORDER.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {project.synth && (
        <div className="mt-2 space-y-1.5 border-t border-slate-800 pt-2 text-xs">
          <p className="text-slate-300">{project.synth.summary}</p>
          <p className="text-slate-400">
            <span className="text-slate-500">下一步：</span>
            {project.synth.nextStep}
          </p>
          {project.synth.blockers.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {project.synth.blockers.map((b, i) => (
                <span key={i} className="rounded bg-amber-950/60 px-1.5 py-0.5 text-[10px] text-amber-300">
                  ⛔ {b}
                </span>
              ))}
            </div>
          )}
          <p className="text-[10px] text-slate-600">
            {project.synth.provider}/{project.synth.model} · {formatRelative(project.synth.generatedAtMs, now)}
            {project.synthStale && <span className="ml-1 text-amber-500">· 输入已变</span>}
          </p>
        </div>
      )}

      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={() => synth.mutate(project.canonicalPath)}
          disabled={synth.isPending}
          className="rounded bg-slate-800 px-2.5 py-1 text-xs text-slate-200 hover:bg-slate-700 disabled:opacity-50"
        >
          {synth.isPending ? "总结中…" : project.synth ? "🔄 重新总结" : "✨ 总结"}
        </button>
        {project.synthStale && project.synth && !synth.isPending && (
          <span className="text-[10px] text-amber-500">建议重新总结</span>
        )}
        {!project.synth && !synth.isPending && (
          <span className="text-[10px] text-slate-600">点总结获取下一步与阻塞</span>
        )}
        <button
          onClick={() => archive.mutate(project.canonicalPath)}
          disabled={archive.isPending}
          title="归档：从看板隐藏，可随时恢复"
          className="ml-auto rounded bg-slate-800 px-2 py-1 text-xs text-slate-400 hover:bg-slate-700 hover:text-slate-200 disabled:opacity-50"
        >
          {archive.isPending ? "…" : "📦 归档"}
        </button>
      </div>
      {synthFailMsg && <p className="mt-1 text-[11px] text-rose-400">⚠ {synthFailMsg}</p>}
    </div>
  );
}

export const STAGES = STAGE;
