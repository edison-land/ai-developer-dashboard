import { ErrorBanner } from "./ErrorBanner";
import { useArchived, useUnarchive } from "../hooks";
import { formatRelative, truncate } from "../lib";

export function ArchiveDrawer({ onClose }: { onClose: () => void }) {
  const archived = useArchived();
  const unarchive = useUnarchive();
  const now = Date.now();
  const items = (archived.data?.projects ?? []).filter((p) => p.archivedAtMs);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-md flex-col border-l border-slate-800 bg-slate-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-200">📦 归档（{items.length}）</h2>
          <button
            onClick={onClose}
            className="rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            关闭 ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {archived.isError && <ErrorBanner error={archived.error} onRetry={() => archived.refetch()} />}
          {archived.isLoading && <p className="py-8 text-center text-sm text-slate-500">加载归档…</p>}
          {!archived.isLoading && !archived.isError && items.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-500">没有已归档的项目。</p>
          )}

          <ul className="space-y-2">
            {items.map((p) => (
              <li key={p.canonicalPath} className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-slate-200">{p.name}</h3>
                    <p className="truncate text-[11px] text-slate-500" title={p.displayPath}>
                      {p.displayPath}
                    </p>
                    {p.lastActionOneLiner && (
                      <p className="mt-1 truncate text-xs text-slate-400">{truncate(p.lastActionOneLiner, 60)}</p>
                    )}
                    <p className="mt-1 text-[11px] text-slate-400">归档于 {formatRelative(p.archivedAtMs, now)}</p>
                  </div>
                  <button
                    onClick={() => unarchive.mutate(p.canonicalPath)}
                    disabled={unarchive.isPending && unarchive.variables === p.canonicalPath}
                    className="shrink-0 rounded bg-sky-700 px-2.5 py-1 text-xs text-white hover:bg-sky-600 disabled:opacity-50"
                  >
                    {unarchive.isPending && unarchive.variables === p.canonicalPath ? "恢复中…" : "↩ 恢复"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="border-t border-slate-800 px-4 py-2 text-xs text-slate-400">
          归档是粘性的：项目重新活跃也不会自动回到看板，需手动恢复。
        </p>
      </div>
    </div>
  );
}
