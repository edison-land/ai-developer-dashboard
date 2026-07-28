import {
  STAGE_LABELS,
  STAGE_ORDER,
  type Stage,
  type UnifiedProject,
} from "@ai-dashboard/core";
import { StageCard } from "./StageCard";

type Column = Stage | "unclassified";
const COLUMNS: { id: Column; label: string }[] = [
  ...STAGE_ORDER.map((stage) => ({ id: stage as Column, label: STAGE_LABELS[stage] })),
  { id: "unclassified", label: "未分类" },
];

export function StageBoard({
  projects,
  onOpenProject,
}: {
  projects: UnifiedProject[];
  onOpenProject: (project: UnifiedProject) => void;
}) {
  const now = Date.now();
  return (
    <div className="stage-board">
      {COLUMNS.map((column) => {
        const items = projects.filter((project) =>
          column.id === "unclassified" ? !project.stage : project.stage === column.id,
        );
        return (
          <section key={column.id} className="ui-panel min-w-0 p-2.5">
            <div className="mb-2 flex items-center justify-between px-1 py-1">
              <h3 className="text-xs font-bold uppercase tracking-[0.12em] ui-muted">
                {column.label}
              </h3>
              <span className="text-xs ui-faint">{items.length}</span>
            </div>
            <div className="space-y-2">
              {items.length === 0 ? (
                <div className="rounded-xl border border-dashed px-3 py-7 text-center text-xs ui-faint ui-divider">
                  暂无项目
                </div>
              ) : (
                items.map((project) => (
                  <StageCard
                    key={project.canonicalPath}
                    project={project}
                    now={now}
                    onOpen={() => onOpenProject(project)}
                  />
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
