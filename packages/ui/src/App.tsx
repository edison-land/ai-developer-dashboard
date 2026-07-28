import { pathKey } from "@ai-dashboard/core";
import { useState } from "react";
import { ArchiveDrawer } from "./components/ArchiveDrawer";
import { ErrorBanner } from "./components/ErrorBanner";
import { Icon, type IconName } from "./components/Icons";
import { ProjectDetailsModal } from "./components/ProjectDetailsModal";
import { ThemeToggle } from "./components/ThemeToggle";
import {
  useAutoRefresh,
  useProjects,
  useRefresh,
  useSettings,
  useSynthesizeAll,
} from "./hooks";
import { formatRelative } from "./lib";
import { ActivityView } from "./views/ActivityView";
import { ProjectsView } from "./views/ProjectsView";
import { SettingsView } from "./views/SettingsView";
import { TodayView } from "./views/TodayView";

type Tab = "today" | "projects" | "activity" | "settings";

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: "today", label: "今日", icon: "today" },
  { id: "projects", label: "项目", icon: "projects" },
  { id: "activity", label: "动态", icon: "activity" },
  { id: "settings", label: "设置", icon: "settings" },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("today");
  const [showArchive, setShowArchive] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const projects = useProjects();
  const refresh = useRefresh();
  const synthesizeAll = useSynthesizeAll();
  const settings = useSettings();
  useAutoRefresh(settings.data?.autoRefreshMins);

  const now = Date.now();
  const list = projects.data?.projects ?? [];
  const selectedProject = selectedPath
    ? list.find((project) => pathKey(project.canonicalPath) === pathKey(selectedPath))
    : undefined;
  const batchCompleted = synthesizeAll.progress?.completed ?? 0;
  const batchTotal = synthesizeAll.progress?.total ?? list.length;
  const synthesizeAllMessage = synthesizeAll.isPending
    ? `已完成 ${batchCompleted}/${batchTotal} · 更新 ${synthesizeAll.progress?.fresh ?? 0} · 缓存 ${synthesizeAll.progress?.cached ?? 0} · 失败 ${synthesizeAll.progress?.failed ?? 0}`
    : synthesizeAll.isError
      ? "总结全部失败，请检查模型设置"
      : synthesizeAll.data
        ? `更新 ${synthesizeAll.data.fresh} · 缓存 ${synthesizeAll.data.cached} · 失败 ${synthesizeAll.data.failed}`
        : null;

  return (
    <div className="min-h-screen">
      <header
        className="sticky top-0 z-40 border-b backdrop-blur-xl ui-divider"
        style={{ background: "color-mix(in srgb, var(--page) 88%, transparent)" }}
      >
        <div className="mx-auto max-w-[1480px] px-4 sm:px-6">
          <div className="flex min-h-[74px] items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] ui-accent">
                Local project intelligence
              </p>
              <div className="mt-1 flex items-baseline gap-3">
                <h1 className="truncate text-xl font-bold tracking-[-0.035em] ui-text">
                  AI 工作台
                </h1>
                <span className="hidden text-xs ui-muted sm:inline">
                  {projects.isLoading
                    ? "正在读取项目…"
                    : `${list.length} 个项目 · ${formatRelative(projects.data?.generatedAtMs, now)}更新`}
                </span>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => synthesizeAll.mutate()}
                  disabled={synthesizeAll.isPending || projects.isLoading || list.length === 0}
                  className="ui-button"
                  title={
                    synthesizeAll.isPending
                      ? `已完成 ${batchCompleted}/${batchTotal}`
                      : "依次总结所有未归档项目"
                  }
                  aria-label={
                    synthesizeAll.isPending
                      ? `总结全部，已完成 ${batchCompleted}/${batchTotal}`
                      : "总结全部"
                  }
                  aria-busy={synthesizeAll.isPending}
                >
                  <Icon
                    name="spark"
                    size={15}
                    className={synthesizeAll.isPending ? "animate-pulse" : ""}
                  />
                  <span className="hidden sm:inline">
                    {synthesizeAll.isPending
                      ? `已完成 ${batchCompleted}/${batchTotal}`
                      : "总结全部"}
                  </span>
                </button>
                <ThemeToggle />
                <button
                  type="button"
                  onClick={() => refresh.mutate()}
                  disabled={refresh.isPending}
                  className="ui-button"
                >
                  <Icon
                    name="refresh"
                    size={15}
                    className={refresh.isPending ? "animate-spin" : ""}
                  />
                  <span className="hidden sm:inline">
                    {refresh.isPending ? "刷新中…" : "刷新"}
                  </span>
                </button>
              </div>
              {synthesizeAllMessage && (
                <p
                  className={`text-[11px] ${
                    synthesizeAll.isError ||
                    (synthesizeAll.progress?.failed ?? 0) > 0 ||
                    (synthesizeAll.data?.failed ?? 0) > 0
                      ? "ui-warning"
                      : synthesizeAll.isPending
                        ? "ui-accent"
                      : "ui-success"
                  }`}
                  aria-live="polite"
                >
                  {synthesizeAllMessage}
                </p>
              )}
            </div>
          </div>

          <nav className="flex items-center gap-1 overflow-x-auto" aria-label="主导航">
            {TABS.map((item) => {
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className="relative inline-flex shrink-0 items-center gap-2 px-3 py-3 text-sm font-semibold transition"
                  style={{ color: active ? "var(--text)" : "var(--muted)" }}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon name={item.icon} size={15} />
                  {item.label}
                  {active && (
                    <span
                      className="absolute inset-x-3 bottom-0 h-0.5 rounded-full"
                      style={{ background: "var(--accent)" }}
                    />
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1480px] px-4 py-7 sm:px-6 sm:py-9">
        {projects.isError && (
          <ErrorBanner error={projects.error} onRetry={() => projects.refetch()} />
        )}

        {tab === "today" && (
          <TodayView
            projects={list}
            loading={projects.isLoading}
            onOpenProject={(project) => setSelectedPath(project.canonicalPath)}
            onViewProjects={() => setTab("projects")}
          />
        )}
        {tab === "projects" &&
          (projects.isLoading ? (
            <p className="py-16 text-center text-sm ui-muted">正在读取项目…</p>
          ) : (
            <ProjectsView
              projects={list}
              onOpenProject={(project) => setSelectedPath(project.canonicalPath)}
              onOpenArchive={() => setShowArchive(true)}
            />
          ))}
        {tab === "activity" && <ActivityView />}
        {tab === "settings" && <SettingsView />}
      </main>

      {selectedProject && (
        <ProjectDetailsModal
          project={selectedProject}
          onClose={() => setSelectedPath(null)}
        />
      )}
      {showArchive && <ArchiveDrawer onClose={() => setShowArchive(false)} />}
    </div>
  );
}
