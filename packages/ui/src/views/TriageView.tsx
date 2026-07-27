import { RECENCY_BUCKETS, RECENCY_LABELS, type UnifiedProject } from "@ai-dashboard/core";
import { ProjectCard } from "../components/ProjectCard";

export function TriageView({ projects }: { projects: UnifiedProject[] }) {
  const now = Date.now();

  if (projects.length === 0) {
    return <p className="py-12 text-center text-slate-500">还没有项目。打开 Claude Code 或 Codex 用一会再来刷新。</p>;
  }

  return (
    <div className="space-y-6">
      {RECENCY_BUCKETS.map((bucket) => {
        const items = projects.filter((p) => p.recencyBucket === bucket);
        if (items.length === 0) return null;
        return (
          <section key={bucket}>
            <h2 className="mb-2 text-sm font-semibold text-slate-400">{RECENCY_LABELS[bucket]}</h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {items.map((p) => (
                <ProjectCard key={p.canonicalPath} project={p} now={now} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
