import { useEffect } from "react";
import { ErrorBanner } from "./ErrorBanner";
import { Icon } from "./Icons";
import { useArchived, useUnarchive } from "../hooks";
import { formatRelative } from "../lib";

export function ArchiveDrawer({ onClose }: { onClose: () => void }) {
  const archived = useArchived();
  const unarchive = useUnarchive();
  const now = Date.now();
  const items = (archived.data?.projects ?? []).filter((project) => project.archivedAtMs);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="归档项目">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        style={{ background: "rgba(3, 8, 16, 0.52)" }}
        onClick={onClose}
        aria-label="关闭归档"
      />
      <aside
        className="page-rise relative flex h-full w-full max-w-md flex-col border-l shadow-2xl ui-divider"
        style={{ background: "var(--page)" }}
      >
        <header className="flex items-start justify-between gap-4 border-b px-5 py-4 ui-divider" style={{ background: "var(--surface)" }}>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] ui-accent">
              Archive
            </p>
            <h2 className="mt-1 text-xl font-bold ui-text">归档项目</h2>
            <p className="mt-1 text-xs ui-muted">{items.length} 个项目暂时隐藏</p>
          </div>
          <button type="button" onClick={onClose} className="ui-icon-button" aria-label="关闭">
            <Icon name="close" size={17} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          {archived.isError && (
            <ErrorBanner error={archived.error} onRetry={() => archived.refetch()} />
          )}
          {archived.isLoading && (
            <p className="py-10 text-center text-sm ui-muted">正在读取归档…</p>
          )}
          {!archived.isLoading && !archived.isError && items.length === 0 && (
            <div className="ui-panel px-5 py-12 text-center">
              <span className="mx-auto inline-flex h-11 w-11 items-center justify-center rounded-full ui-muted" style={{ background: "var(--surface-soft)" }}>
                <Icon name="archive" size={19} />
              </span>
              <p className="mt-4 text-sm font-bold ui-text">归档是空的</p>
              <p className="mt-1 text-xs leading-5 ui-muted">
                项目归档后会出现在这里，并可随时恢复。
              </p>
            </div>
          )}

          <ul className="space-y-2">
            {items.map((project) => (
              <li key={project.canonicalPath} className="ui-panel p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold ui-text">{project.name}</h3>
                    <p className="mt-1 truncate text-xs ui-faint" title={project.displayPath}>
                      {project.displayPath}
                    </p>
                    <p className="mt-2 text-xs ui-muted">
                      归档于 {formatRelative(project.archivedAtMs, now)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => unarchive.mutate(project.canonicalPath)}
                    disabled={
                      unarchive.isPending &&
                      unarchive.variables === project.canonicalPath
                    }
                    className="ui-button shrink-0 px-2.5 py-1.5 text-xs"
                  >
                    <Icon name="refresh" size={13} />
                    {unarchive.isPending &&
                    unarchive.variables === project.canonicalPath
                      ? "恢复中…"
                      : "恢复"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="border-t px-5 py-3 text-xs leading-5 ui-muted ui-divider">
          归档不会因项目重新活跃而自动取消。
        </p>
      </aside>
    </div>
  );
}
