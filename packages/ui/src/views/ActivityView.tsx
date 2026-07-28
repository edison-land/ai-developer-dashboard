import { SOURCE_LABELS, type SourceId } from "@ai-dashboard/core";
import { ErrorBanner } from "../components/ErrorBanner";
import { useActivity } from "../hooks";
import { formatRelative, truncate } from "../lib";

const SOURCE_STYLE: Record<SourceId, string> = {
  "claude-code": "bg-sky-900/60 text-sky-300",
  codex: "bg-violet-900/60 text-violet-300",
  git: "bg-emerald-900/60 text-emerald-300",
};
const SOURCE_GLYPH: Record<SourceId, string> = {
  "claude-code": "✦",
  codex: "◈",
  git: "⎇",
};

export function ActivityView() {
  const activity = useActivity();
  const now = Date.now();
  const items = activity.data?.items ?? [];

  if (activity.isError) {
    return <ErrorBanner error={activity.error} onRetry={() => activity.refetch()} />;
  }
  if (activity.isLoading) {
    return <p className="py-12 text-center text-slate-500">加载活动流…</p>;
  }
  if (items.length === 0) {
    return (
      <p className="py-12 text-center text-slate-500">
        还没有活动。打开 Claude Code / Codex 跑一会，或提交点代码，再来刷新。
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-3 text-xs text-slate-500">
        跨项目时间线 · 合并 Claude Code、Codex 与 git 最近动作，按时间倒序。
      </p>
      <ul className="space-y-2">
        {items.map((it, i) => (
          <li
            key={`${it.canonicalPath}-${it.source}-${it.atMs}-${i}`}
            className="rounded-lg border border-slate-800 bg-slate-900/60 p-3"
          >
            <div className="flex items-start gap-3">
              <span
                className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${SOURCE_STYLE[it.source]}`}
                title={SOURCE_LABELS[it.source]}
              >
                {SOURCE_GLYPH[it.source]}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-slate-200" title={it.canonicalPath}>
                    {it.project}
                  </span>
                  <span className="shrink-0 text-[11px] text-slate-500">{formatRelative(it.atMs, now)}</span>
                </div>
                <p className="mt-0.5 line-clamp-2 text-sm text-slate-300">{truncate(it.text, 200)}</p>
                <p className="mt-1 text-[10px] text-slate-600">{SOURCE_LABELS[it.source]}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
