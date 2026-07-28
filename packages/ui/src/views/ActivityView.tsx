import { SOURCE_LABELS } from "@ai-dashboard/core";
import { ErrorBanner } from "../components/ErrorBanner";
import { SourceMark } from "../components/SourceMark";
import { useActivity } from "../hooks";
import { formatRelative, truncate } from "../lib";

export function ActivityView() {
  const activity = useActivity();
  const now = Date.now();
  const items = activity.data?.items ?? [];

  if (activity.isError) {
    return <ErrorBanner error={activity.error} onRetry={() => activity.refetch()} />;
  }
  if (activity.isLoading) {
    return <p className="py-16 text-center text-sm ui-muted">正在整理最近动态…</p>;
  }

  return (
    <div className="page-rise mx-auto max-w-4xl">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] ui-accent">
          Activity stream
        </p>
        <h2 className="mt-1 text-2xl font-bold tracking-[-0.035em] ui-text">最近动态</h2>
        <p className="mt-1 text-sm ui-muted">
          Claude Code、Codex 与 Git 的最近动作，按时间合并。
        </p>
      </div>

      {items.length === 0 ? (
        <div className="ui-panel mt-6 px-6 py-14 text-center">
          <h3 className="text-base font-bold ui-text">还没有可展示的动态</h3>
          <p className="mt-2 text-sm ui-muted">
            打开开发工具运行一会，或提交代码后再刷新。
          </p>
        </div>
      ) : (
        <ol className="relative mt-7 space-y-3 before:absolute before:bottom-5 before:left-[18px] before:top-5 before:w-px before:bg-[var(--border)]">
          {items.map((item, index) => (
            <li
              key={`${item.canonicalPath}-${item.source}-${item.atMs}-${index}`}
              className="ui-panel relative ml-0 grid grid-cols-[36px_minmax(0,1fr)] gap-3 p-4"
            >
              <span
                className="relative z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border ui-divider"
                style={{ background: "var(--surface-elevated)" }}
              >
                <SourceMark source={item.source} />
              </span>
              <div className="min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold ui-text" title={item.canonicalPath}>
                      {item.project}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-sm leading-6 ui-text-soft">
                      {truncate(item.text, 220)}
                    </p>
                  </div>
                  <time className="shrink-0 text-xs ui-muted">
                    {formatRelative(item.atMs, now)}
                  </time>
                </div>
                <p className="mt-2 text-[11px] ui-faint">{SOURCE_LABELS[item.source]}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
