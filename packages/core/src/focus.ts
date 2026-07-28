import type {
  FocusPreferences,
  FocusReason,
  FocusSelection,
  UnifiedProject,
} from "./domain.js";
import { pathKey } from "./paths.js";

const FOCUS_LIMIT = 3;
const ATTENTION_LIMIT = 5;

/** Local-calendar date used for "dismiss for today" semantics. */
export function localDateKey(nowMs = Date.now()): string {
  const d = new Date(nowMs);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function attentionOf(project: UnifiedProject) {
  return project.synth?.attention ?? "unknown";
}

function isEligible(project: UnifiedProject): boolean {
  return project.archivedAtMs === undefined && project.stage !== "done";
}

function autoTier(project: UnifiedProject): number {
  if (project.liveStatus === "busy") return 0;
  if (attentionOf(project) === "user-action") return 1;
  if (attentionOf(project) === "waiting") return 5;
  if (
    (project.stage === "building" || project.stage === "verifying") &&
    project.recencyBucket !== "stale"
  ) {
    return 2;
  }
  if (project.recencyBucket !== "stale") return 3;
  return 4;
}

function reasonFor(project: UnifiedProject): FocusReason {
  if (project.liveStatus === "busy") return "running";
  if (attentionOf(project) === "user-action") return "needs-action";
  return "recent";
}

function compareAuto(a: UnifiedProject, b: UnifiedProject): number {
  const tier = autoTier(a) - autoTier(b);
  if (tier !== 0) return tier;
  const recency = b.lastActiveMs - a.lastActiveMs;
  if (recency !== 0) return recency;
  return pathKey(a.canonicalPath).localeCompare(pathKey(b.canonicalPath));
}

/**
 * Select up to three focus projects using transparent, deterministic rules.
 * Manual pins always come first; eligible automatic suggestions fill the rest.
 */
export function selectTodayFocus(
  projects: UnifiedProject[],
  preferences: FocusPreferences,
  nowMs = Date.now(),
): FocusSelection[] {
  const today = localDateKey(nowMs);
  const dismissed =
    preferences.localDate === today
      ? new Set(preferences.dismissedPaths.map(pathKey))
      : new Set<string>();

  const byPath = new Map(
    projects.filter(isEligible).map((project) => [pathKey(project.canonicalPath), project]),
  );
  const selections: FocusSelection[] = [];
  const selected = new Set<string>();

  for (const canonicalPath of preferences.pinnedPaths) {
    const key = pathKey(canonicalPath);
    if (selected.has(key) || dismissed.has(key)) continue;
    const project = byPath.get(key);
    if (!project) continue;
    selections.push({ project, reason: "pinned", pinned: true });
    selected.add(key);
    if (selections.length === FOCUS_LIMIT) return selections;
  }

  const automatic = projects
    .filter(isEligible)
    .filter((project) => {
      const key = pathKey(project.canonicalPath);
      return !selected.has(key) && !dismissed.has(key);
    })
    .sort(compareAuto);

  for (const project of automatic) {
    const key = pathKey(project.canonicalPath);
    if (selected.has(key)) continue;
    selections.push({ project, reason: reasonFor(project), pinned: false });
    selected.add(key);
    if (selections.length === FOCUS_LIMIT) break;
  }

  return selections;
}

/**
 * Compact projects shown below the focus cards. Actionable items come first,
 * then the newest remaining projects. Focus items and archived projects never
 * appear twice.
 */
export function selectAttentionProjects(
  projects: UnifiedProject[],
  focus: FocusSelection[],
  limit = ATTENTION_LIMIT,
): UnifiedProject[] {
  const focused = new Set(focus.map((item) => pathKey(item.project.canonicalPath)));
  return projects
    .filter((project) => project.archivedAtMs === undefined)
    .filter((project) => !focused.has(pathKey(project.canonicalPath)))
    .sort((a, b) => {
      const attentionRank =
        Number(attentionOf(b) === "user-action") - Number(attentionOf(a) === "user-action");
      if (attentionRank !== 0) return attentionRank;
      const busyRank = Number(b.liveStatus === "busy") - Number(a.liveStatus === "busy");
      if (busyRank !== 0) return busyRank;
      const recency = b.lastActiveMs - a.lastActiveMs;
      if (recency !== 0) return recency;
      return pathKey(a.canonicalPath).localeCompare(pathKey(b.canonicalPath));
    })
    .slice(0, Math.max(0, limit));
}
