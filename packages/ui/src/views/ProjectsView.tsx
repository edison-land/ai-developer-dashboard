import type { UnifiedProject } from "@ai-dashboard/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import { filterProjects } from "../filter";
import { useFilter, useSetStage } from "../hooks";
import { ProjectList } from "../components/ProjectList";
import {
  ProjectToolbar,
  type ProjectViewMode,
} from "../components/ProjectToolbar";
import { StageBoard } from "../components/StageBoard";
import { Icon } from "../components/Icons";

const VIEW_KEY = "ai-dashboard:projects-view-v2";

function loadView(): ProjectViewMode {
  try {
    return localStorage.getItem(VIEW_KEY) === "list" ? "list" : "stage";
  } catch {
    return "stage";
  }
}

export function ProjectsView({
  projects,
  onOpenProject,
}: {
  projects: UnifiedProject[];
  onOpenProject: (project: UnifiedProject) => void;
}) {
  const [filter, setFilter] = useFilter();
  const [viewMode, setViewMode] = useState<ProjectViewMode>(loadView);
  const setStage = useSetStage();
  const filtered = useMemo(
    () => filterProjects(projects, filter, Date.now()),
    [projects, filter],
  );
  const persistStage = useCallback(
    (canonical: string, stage: import("@ai-dashboard/core").Stage) =>
      setStage.mutateAsync({ canonical, stage }),
    [setStage],
  );

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, viewMode);
    } catch {
      // View still works in-memory.
    }
  }, [viewMode]);

  return (
    <div className="page-rise space-y-4">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] ui-accent">
          Project library
        </p>
        <h2 className="mt-1 text-2xl font-bold tracking-[-0.035em] ui-text">全部项目</h2>
        <p className="mt-1 text-sm ui-muted">
          这里负责查找、分阶段和管理；点击项目查看完整细节。
        </p>
      </div>

      <ProjectToolbar
        filter={filter}
        onFilterChange={setFilter}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        resultCount={filtered.length}
      />

      {filtered.length === 0 ? (
        <div className="ui-panel px-6 py-14 text-center">
          <span className="mx-auto inline-flex h-11 w-11 items-center justify-center rounded-full ui-muted" style={{ background: "var(--surface-soft)" }}>
            <Icon name="search" size={19} />
          </span>
          <h3 className="mt-4 text-base font-bold ui-text">没有匹配的项目</h3>
          <p className="mt-2 text-sm ui-muted">调整搜索文字或清除筛选条件后再试。</p>
        </div>
      ) : viewMode === "list" ? (
        <ProjectList projects={filtered} onOpenProject={onOpenProject} />
      ) : (
        <StageBoard
          projects={filtered}
          onOpenProject={onOpenProject}
          onSetStage={persistStage}
        />
      )}
    </div>
  );
}
