import { STAGE_LABELS, STAGE_ORDER, type UnifiedProject } from "@ai-dashboard/core";
import { ProjectCard } from "../components/ProjectCard";

function Column({
  title,
  items,
  now,
  muted,
}: {
  title: string;
  items: UnifiedProject[];
  now: number;
  muted?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-2">
      <div className="mb-2 flex items-center justify-between px-1">
        <h3 className={`text-xs font-semibold ${muted ? "text-slate-500" : "text-slate-300"}`}>{title}</h3>
        <span className="text-xs text-slate-600">{items.length}</span>
      </div>
      <div className="space-y-2">
        {items.map((p) => (
          <ProjectCard key={p.canonicalPath} project={p} now={now} />
        ))}
      </div>
    </div>
  );
}

export function KanbanView({ projects }: { projects: UnifiedProject[] }) {
  const now = Date.now();
  const unclassified = projects.filter((p) => !p.stage);

  return (
    <div className="grid grid-cols-1 gap-3 overflow-x-auto sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {STAGE_ORDER.map((s) => (
        <Column key={s} title={STAGE_LABELS[s]} items={projects.filter((p) => p.stage === s)} now={now} />
      ))}
      <Column title="未分类" items={unclassified} now={now} muted />
    </div>
  );
}
