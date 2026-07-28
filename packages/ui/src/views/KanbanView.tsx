import { useState } from "react";
import { STAGE_LABELS, STAGE_ORDER, type Stage, type UnifiedProject } from "@ai-dashboard/core";
import { ProjectCard } from "../components/ProjectCard";
import { KanbanCardCompact } from "../components/KanbanCardCompact";

type Col = Stage | "unclassified";
const COLUMNS: { id: Col; label: string; muted?: boolean }[] = [
  ...STAGE_ORDER.map((s) => ({ id: s as Col, label: STAGE_LABELS[s] })),
  { id: "unclassified", label: "未分类", muted: true },
];

/** Fixed target width for the expanded overlay (R4 decision ①: a constant, not a
 *  proportional scale — keeps text wrapping predictable). */
const OVERLAY_W = 340;

export function KanbanView({ projects }: { projects: UnifiedProject[] }) {
  const now = Date.now();
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <>
      <p className="mb-3 text-xs text-slate-500">
        鼠标悬停某一列，展开看完整状态（总结 / git / 下一步）。同屏只展开一列。
      </p>
      <div className="grid grid-cols-1 gap-3 pb-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
        {COLUMNS.map((col, idx) => {
          const items =
            col.id === "unclassified" ? projects.filter((p) => !p.stage) : projects.filter((p) => p.stage === col.id);
          const isHovered = hovered === idx;
          const dimmed = hovered !== null && !isHovered;
          // Boundary columns hug the inside so the overlay never spills off-viewport.
          const isFirst = idx === 0;
          const isLast = idx === COLUMNS.length - 1;
          const overlayStyle: React.CSSProperties = isHovered
            ? {
                width: OVERLAY_W,
                ...(isFirst
                  ? { left: 0 }
                  : isLast
                    ? { right: 0, left: "auto" }
                    : { left: "50%", transform: "translateX(-50%)" }),
              }
            : {};

          return (
            <div
              key={col.id}
              onMouseEnter={() => setHovered(idx)}
              onMouseLeave={() => setHovered((h) => (h === idx ? null : h))}
              className={
                "relative rounded-xl border p-2 transition-opacity duration-150 " +
                (isHovered ? "border-sky-600 bg-slate-900/80" : "border-slate-700/70 bg-slate-900/50 ") +
                (dimmed ? "opacity-40" : "opacity-100")
              }
            >
              {/* Base compact column — always rendered, defines layout height so the
                  expanded overlay never triggers a layout reflow. */}
              <div className="mb-2 flex items-center justify-between px-1">
                <h3 className={`text-xs font-semibold ${col.muted ? "text-slate-500" : "text-slate-300"}`}>{col.label}</h3>
                <span className="text-xs text-slate-400">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.length === 0 ? (
                  <p className="px-1 py-4 text-center text-xs text-slate-500">空</p>
                ) : (
                  items.map((p) => <KanbanCardCompact key={p.canonicalPath} project={p} now={now} />)
                )}
              </div>

              {/* Expanded overlay — absolute, so it floats over neighbors (z-30) with
                  zero layout impact. Single column at a time (only the hovered idx). */}
              {isHovered && items.length > 0 && (
                <div
                  style={overlayStyle}
                  className="kf-fade-in absolute top-0 z-30 rounded-xl border border-sky-500 bg-slate-900 p-2 shadow-2xl shadow-black/60"
                >
                  <div className="mb-2 flex items-center justify-between px-1">
                    <h3 className="text-xs font-semibold text-sky-300">{col.label}</h3>
                    <span className="text-xs text-slate-500">{items.length}</span>
                  </div>
                  <div className="space-y-2">
                    {items.map((p) => (
                      <ProjectCard key={p.canonicalPath} project={p} now={now} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
