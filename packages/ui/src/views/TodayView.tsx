import {
  localDateKey,
  pathKey,
  selectAttentionProjects,
  selectTodayFocus,
  type FocusPreferences,
  type UnifiedProject,
} from "@ai-dashboard/core";
import { useMemo, useState } from "react";
import {
  useFocusPreferences,
  useSaveFocusPreferences,
  useSynthesize,
} from "../hooks";
import { CompactProjectRow } from "../components/CompactProjectRow";
import { FocusCard } from "../components/FocusCard";
import { Icon } from "../components/Icons";
import { TodaySkeleton } from "../components/TodaySkeleton";
import { TodayStatusStrip } from "../components/TodayStatusStrip";

export function TodayView({
  projects,
  loading,
  onOpenProject,
  onViewProjects,
}: {
  projects: UnifiedProject[];
  loading: boolean;
  onOpenProject: (project: UnifiedProject) => void;
  onViewProjects: () => void;
}) {
  const now = Date.now();
  const localDate = localDateKey(now);
  const preferencesQuery = useFocusPreferences(localDate);
  const savePreferences = useSaveFocusPreferences();
  const synthesize = useSynthesize();
  const [editing, setEditing] = useState(false);
  const preferences: FocusPreferences = preferencesQuery.data ?? {
    pinnedPaths: [],
    dismissedPaths: [],
    localDate,
  };
  const focus = useMemo(
    () => selectTodayFocus(projects, preferences, now),
    [projects, preferences, now],
  );
  const attention = useMemo(
    () => selectAttentionProjects(projects, focus),
    [projects, focus],
  );

  const running = projects.filter((project) => project.liveStatus === "busy").length;
  const needsAction = projects.filter(
    (project) => project.synth?.attention === "user-action",
  ).length;
  const activeThisWeek = projects.filter(
    (project) => now - project.lastActiveMs <= 7 * 24 * 60 * 60 * 1000,
  ).length;

  const persist = (next: FocusPreferences) => {
    savePreferences.mutate({ ...next, localDate });
  };

  const pinAt = (canonicalPath: string, visibleIndex: number) => {
    const key = pathKey(canonicalPath);
    const current = preferences.pinnedPaths.filter((path) => pathKey(path) !== key);
    const pinnedBefore = focus
      .slice(0, visibleIndex)
      .filter((item) => item.pinned)
      .length;
    current.splice(Math.min(pinnedBefore, current.length), 0, canonicalPath);
    persist({
      ...preferences,
      pinnedPaths: current.slice(0, 3),
      dismissedPaths: preferences.dismissedPaths.filter((path) => pathKey(path) !== key),
    });
  };

  const unpin = (canonicalPath: string) => {
    const key = pathKey(canonicalPath);
    persist({
      ...preferences,
      pinnedPaths: preferences.pinnedPaths.filter((path) => pathKey(path) !== key),
    });
  };

  const movePin = (canonicalPath: string, direction: -1 | 1) => {
    const key = pathKey(canonicalPath);
    const paths = [...preferences.pinnedPaths];
    const index = paths.findIndex((path) => pathKey(path) === key);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= paths.length) return;
    [paths[index], paths[nextIndex]] = [paths[nextIndex]!, paths[index]!];
    persist({ ...preferences, pinnedPaths: paths });
  };

  const dismiss = (canonicalPath: string) => {
    const key = pathKey(canonicalPath);
    const dismissedPaths = preferences.dismissedPaths.some((path) => pathKey(path) === key)
      ? preferences.dismissedPaths
      : [...preferences.dismissedPaths, canonicalPath];
    persist({
      ...preferences,
      pinnedPaths: preferences.pinnedPaths.filter((path) => pathKey(path) !== key),
      dismissedPaths,
    });
  };

  return (
    <div className="page-rise space-y-8">
      <TodayStatusStrip
        running={running}
        needsAction={needsAction}
        activeThisWeek={activeThisWeek}
      />

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] ui-accent">
              Today&apos;s focus
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-[-0.035em] ui-text">
              今天先做这 3 件事
            </h2>
          </div>
          <button
            type="button"
            className={editing ? "ui-button ui-button-primary" : "ui-button"}
            onClick={() => setEditing((value) => !value)}
            disabled={loading || preferencesQuery.isLoading}
          >
            <Icon name={editing ? "check" : "pin"} size={15} />
            {editing ? "完成调整" : "调整重点"}
          </button>
        </div>

        {loading ? (
          <TodaySkeleton />
        ) : projects.length === 0 ? (
          <EmptyProjects onViewProjects={onViewProjects} />
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            {focus.map((selection, index) => {
              const pinnedIndex = preferences.pinnedPaths.findIndex(
                (path) => pathKey(path) === pathKey(selection.project.canonicalPath),
              );
              return (
                <FocusCard
                  key={selection.project.canonicalPath}
                  selection={selection}
                  index={index}
                  now={now}
                  editing={editing}
                  pinnedIndex={pinnedIndex}
                  pinnedCount={preferences.pinnedPaths.length}
                  saving={savePreferences.isPending}
                  summaryPending={
                    synthesize.isPending &&
                    pathKey(synthesize.variables ?? "") ===
                      pathKey(selection.project.canonicalPath)
                  }
                  onOpen={() => onOpenProject(selection.project)}
                  onSynthesize={() =>
                    synthesize.mutate(selection.project.canonicalPath)
                  }
                  onPin={() => pinAt(selection.project.canonicalPath, index)}
                  onUnpin={() => unpin(selection.project.canonicalPath)}
                  onMoveLeft={() => movePin(selection.project.canonicalPath, -1)}
                  onMoveRight={() => movePin(selection.project.canonicalPath, 1)}
                  onDismiss={() => dismiss(selection.project.canonicalPath)}
                />
              );
            })}
            {Array.from({ length: Math.max(0, 3 - focus.length) }, (_, index) => (
              <button
                key={`empty-${index}`}
                type="button"
                onClick={onViewProjects}
                className="min-h-[268px] rounded-2xl border border-dashed p-5 text-left transition hover:bg-[var(--surface-hover)] ui-divider"
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full ui-accent" style={{ background: "var(--accent-soft)" }}>
                  <Icon name="projects" size={18} />
                </span>
                <span className="mt-5 block text-base font-bold ui-text">选择一个重点项目</span>
                <span className="mt-2 block text-sm leading-6 ui-muted">
                  当前没有足够的自动候选，可从项目列表中继续查看。
                </span>
              </button>
            ))}
          </div>
        )}

        {(preferencesQuery.isError || savePreferences.isError) && (
          <p role="alert" className="mt-3 text-sm ui-danger">
            重点偏好暂时无法保存，页面已恢复到上一次保存状态。
          </p>
        )}
        {synthesize.isError && (
          <p role="alert" className="mt-3 text-sm ui-danger">
            项目总结失败，请检查模型设置后重试。
          </p>
        )}
      </section>

      {attention.length > 0 && (
        <section>
          <div className="mb-3 flex items-end justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] ui-faint">
                Next in view
              </p>
              <h2 className="mt-1 text-lg font-bold ui-text">随后关注</h2>
            </div>
            <button type="button" onClick={onViewProjects} className="text-sm font-semibold ui-accent">
              查看全部项目
            </button>
          </div>
          <div className="ui-panel overflow-hidden">
            {attention.map((project) => (
              <CompactProjectRow
                key={project.canonicalPath}
                project={project}
                now={now}
                onOpen={() => onOpenProject(project)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function EmptyProjects({ onViewProjects }: { onViewProjects: () => void }) {
  return (
    <div className="ui-panel px-6 py-14 text-center">
      <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full ui-accent" style={{ background: "var(--accent-soft)" }}>
        <Icon name="projects" size={21} />
      </span>
      <h3 className="mt-4 text-lg font-bold ui-text">还没有可展示的项目</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 ui-muted">
        先在 Claude Code 或 Codex 中打开项目，然后刷新工作台。
      </p>
      <button type="button" className="ui-button mt-5" onClick={onViewProjects}>
        查看项目页
      </button>
    </div>
  );
}
