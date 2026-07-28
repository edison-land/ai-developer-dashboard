import { useState } from "react";
import { ErrorBanner } from "./components/ErrorBanner";
import { ArchiveDrawer } from "./components/ArchiveDrawer";
import { FilterBar } from "./components/FilterBar";
import { useAutoRefresh, useFilter, useProjects, useRefresh, useSettings } from "./hooks";
import { filterProjects } from "./filter";
import { formatRelative } from "./lib";
import { ActivityView } from "./views/ActivityView";
import { KanbanView } from "./views/KanbanView";
import { SettingsView } from "./views/SettingsView";
import { TriageView } from "./views/TriageView";

type Tab = "triage" | "kanban" | "activity" | "settings";
const TABS: { id: Tab; label: string }[] = [
  { id: "triage", label: "🌅 晨间分流" },
  { id: "kanban", label: "📋 阶段看板" },
  { id: "activity", label: "📊 活动" },
  { id: "settings", label: "⚙ 设置" },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("triage");
  const [showArchive, setShowArchive] = useState(false);
  const projects = useProjects();
  const refresh = useRefresh();
  const settings = useSettings();
  const [filter, setFilter] = useFilter();
  useAutoRefresh(settings.data?.autoRefreshMins);
  const now = Date.now();
  const list = projects.data?.projects ?? [];
  const filtered = filterProjects(list, filter, now);

  return (
    <div className="mx-auto max-w-7xl px-4 py-5">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-100">AI Developer Dashboard</h1>
          <p className="text-xs text-slate-500">
            {projects.isLoading
              ? "加载中…"
              : `${list.length} 个项目 · 更新于 ${formatRelative(projects.data?.generatedAtMs, now)}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowArchive(true)}
            className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700"
          >
            📦 归档
          </button>
          <button
            onClick={() => refresh.mutate()}
            disabled={refresh.isPending}
            className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700 disabled:opacity-50"
          >
            {refresh.isPending ? "刷新中…" : "🔄 刷新"}
          </button>
        </div>
      </header>

      <nav className="mb-5 flex gap-1 border-b border-slate-800">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={
              "-mb-px border-b-2 px-3 py-2 text-sm " +
              (tab === t.id
                ? "border-sky-500 text-slate-100"
                : "border-transparent text-slate-400 hover:text-slate-200")
            }
          >
            {t.label}
          </button>
        ))}
      </nav>

      {projects.isError && (
        <ErrorBanner error={projects.error} onRetry={() => projects.refetch()} />
      )}

      {(tab === "triage" || tab === "kanban") && <FilterBar filter={filter} onChange={setFilter} />}

      {tab === "triage" && <TriageView projects={filtered} />}
      {tab === "kanban" && <KanbanView projects={filtered} />}
      {tab === "activity" && <ActivityView />}
      {tab === "settings" && <SettingsView />}

      {showArchive && <ArchiveDrawer onClose={() => setShowArchive(false)} />}
    </div>
  );
}
