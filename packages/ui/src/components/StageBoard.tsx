import {
  STAGE_LABELS,
  STAGE_ORDER,
  pathKey,
  type Stage,
  type UnifiedProject,
} from "@ai-dashboard/core";
import { useEffect, useMemo, useState } from "react";
import { StageCard } from "./StageCard";

type Column = Stage | "unclassified";
const COLUMNS: { id: Column; label: string }[] = [
  ...STAGE_ORDER.map((stage) => ({ id: stage as Column, label: STAGE_LABELS[stage] })),
  { id: "unclassified", label: "未分类" },
];

export function StageBoard({
  projects,
  onOpenProject,
  onSetStage,
}: {
  projects: UnifiedProject[];
  onOpenProject: (project: UnifiedProject) => void;
  onSetStage: (canonical: string, stage: Stage) => Promise<void>;
}) {
  const now = Date.now();
  const [draggingPath, setDraggingPath] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<Stage | null>(null);
  const [optimisticStages, setOptimisticStages] = useState<Map<string, Stage>>(
    () => new Map(),
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setOptimisticStages((current) => {
      const next = new Map(current);
      for (const project of projects) {
        const key = pathKey(project.canonicalPath);
        if (next.get(key) === project.stage) next.delete(key);
      }
      return next.size === current.size ? current : next;
    });
  }, [projects]);

  const visibleProjects = useMemo(
    () =>
      projects.map((project) => {
        const override = optimisticStages.get(pathKey(project.canonicalPath));
        return override
          ? { ...project, stage: override, stageSource: "override" as const }
          : project;
      }),
    [optimisticStages, projects],
  );

  const startDrag = (project: UnifiedProject, event: React.DragEvent<HTMLButtonElement>) => {
    const key = pathKey(project.canonicalPath);
    setDraggingPath(key);
    setError(null);
    event.dataTransfer?.setData("text/plain", key);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
  };

  const dropOn = async (stage: Stage, event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    const key = draggingPath ?? event.dataTransfer?.getData("text/plain");
    if (!key) return;
    const project = visibleProjects.find((item) => pathKey(item.canonicalPath) === key);
    if (!project || project.stage === stage) {
      setDraggingPath(null);
      setOverColumn(null);
      return;
    }

    setOptimisticStages((current) => new Map(current).set(key, stage));
    setDraggingPath(null);
    setOverColumn(null);
    setError(null);
    try {
      await onSetStage(project.canonicalPath, stage);
    } catch {
      setOptimisticStages((current) => {
        const next = new Map(current);
        next.delete(key);
        return next;
      });
      setError(`阶段更新失败：${project.name} 已退回原位置，请重试。`);
    }
  };

  return (
    <div className="stage-board" aria-label="项目阶段看板">
      {error && (
        <p role="alert" className="mb-3 text-sm ui-danger" aria-live="polite">
          {error}
        </p>
      )}
      {COLUMNS.map((column) => {
        const items = visibleProjects.filter((project) =>
          column.id === "unclassified" ? !project.stage : project.stage === column.id,
        );
        const droppable = column.id !== "unclassified";
        const activeDrop = droppable && overColumn === column.id;
        return (
          <section
            key={column.id}
            className={`ui-panel min-w-0 p-2.5 transition ${activeDrop ? "stage-drop-active" : ""}`}
            onDragOver={
              droppable
                ? (event) => {
                    event.preventDefault();
                    setOverColumn(column.id as Stage);
                    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
                  }
                : undefined
            }
            onDragLeave={
              droppable
                ? () => setOverColumn((current) => (current === column.id ? null : current))
                : undefined
            }
            onDrop={droppable ? (event) => void dropOn(column.id as Stage, event) : undefined}
          >
            <div className="mb-2 flex items-center justify-between px-1 py-1">
              <h3 className="text-xs font-bold uppercase tracking-[0.12em] ui-muted">
                {column.label}
              </h3>
              <span className="text-xs ui-faint">{items.length}</span>
            </div>
            <div className="space-y-2">
              {items.length === 0 ? (
                <div className="rounded-xl border border-dashed px-3 py-7 text-center text-xs ui-faint ui-divider">
                  {activeDrop ? `放到“${column.label}”` : "暂无项目"}
                </div>
              ) : (
                items.map((project) => (
                  <StageCard
                    key={project.canonicalPath}
                    project={project}
                    now={now}
                    onOpen={() => onOpenProject(project)}
                    onDragStart={(event) => startDrag(project, event)}
                    onDragEnd={() => {
                      setDraggingPath(null);
                      setOverColumn(null);
                    }}
                  />
                ))
              )}
              {activeDrop && items.length > 0 && (
                <div className="rounded-xl border border-dashed px-3 py-3 text-center text-xs ui-accent ui-divider">
                  放到“{column.label}”
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
