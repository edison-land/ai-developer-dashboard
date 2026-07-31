import { describe, expect, it } from "vitest";
import type { ActivityItem, RawSignals, StatusSnapshot, UnifiedProject } from "./domain.js";
import { buildActivityFeed, DEFAULT_ACTIVITY_LIMIT, filterActivityFeed } from "./activity.js";

const NOW = 1_700_000_000_000;

/** Minimal UnifiedProject — only the fields buildActivityFeed reads. */
function proj(opts: {
  name: string;
  path?: string;
  cc?: Partial<RawSignals>;
  codex?: Partial<RawSignals>;
  git?: Partial<StatusSnapshot> | null;
}): UnifiedProject {
  const path = opts.path ?? `D:/${opts.name}`;
  const signalsBySource: UnifiedProject["signalsBySource"] = {};
  if (opts.cc) signalsBySource["claude-code"] = { source: "claude-code", canonicalPath: path, ...opts.cc };
  if (opts.codex) signalsBySource.codex = { source: "codex", canonicalPath: path, ...opts.codex };
  const git: StatusSnapshot | undefined =
    opts.git === null ? undefined : { branch: "main", headSha: "s", headCommit: null, dirtyFileCount: 0, aheadBehind: { ahead: 0, behind: 0, hasUpstream: true }, ...opts.git };
  return {
    canonicalPath: path,
    displayPath: path,
    name: opts.name,
    sources: [],
    lastActiveMs: 0,
    recencyBucket: "stale",
    liveStatus: "none",
    git,
    synthStale: false,
    signalsBySource,
  };
}

describe("buildActivityFeed", () => {
  it("emits one event per source a project has signals for, newest-first", () => {
    const items = buildActivityFeed([
      proj({
        name: "btc",
        cc: { lastActiveMs: NOW - 1_000, lastActionOneLiner: "CC: fix bug" },
        codex: { lastActiveMs: NOW - 2_000, lastActionOneLiner: "Codex: add tests" },
        git: { headCommit: { subject: "feat: ship it", author: "a", dateMs: NOW - 500 } },
      }),
    ]);
    expect(items.map((i) => [i.source, i.text])).toEqual([
      ["git", "feat: ship it"], // NOW - 500
      ["claude-code", "CC: fix bug"], // NOW - 1000
      ["codex", "Codex: add tests"], // NOW - 2000
    ]);
  });

  it("merges events across projects into one global timeline", () => {
    const items = buildActivityFeed([
      proj({ name: "old", cc: { lastActiveMs: NOW - 10_000, lastActionOneLiner: "old cc" } }),
      proj({ name: "new", cc: { lastActiveMs: NOW - 100, lastActionOneLiner: "new cc" } }),
    ]);
    expect(items.map((i) => i.project)).toEqual(["new", "old"]);
  });

  it("skips a source when it lacks a one-liner or timestamp", () => {
    const items = buildActivityFeed([
      proj({ name: "x", cc: { lastActiveMs: NOW } }), // no one-liner -> skip
      proj({ name: "y", git: { headCommit: { subject: "c", author: "a", dateMs: 0 } } }), // dateMs 0 -> skip
    ]);
    expect(items).toHaveLength(0);
  });

  it("omits git events when there is no head commit", () => {
    const items = buildActivityFeed([proj({ name: "z", git: { headCommit: null } })]);
    expect(items).toHaveLength(0);
  });

  it("respects the limit cap (newest N only)", () => {
    const projects = Array.from({ length: 5 }, (_, i) =>
      proj({ name: `p${i}`, cc: { lastActiveMs: NOW - i * 1000, lastActionOneLiner: `m${i}` } }),
    );
    const items = buildActivityFeed(projects, { limit: 3 });
    expect(items.map((i) => i.text)).toEqual(["m0", "m1", "m2"]);
  });

  it("preserves key fields (canonicalPath, project name, source label) on each item", () => {
    const items = buildActivityFeed([
      proj({ name: "polyu", path: "D:/PolyU", cc: { lastActiveMs: NOW, lastActionOneLiner: "hi" } }),
    ]);
    const it: ActivityItem = items[0]!;
    expect(it.source).toBe("claude-code");
    expect(it.project).toBe("polyu");
    expect(it.canonicalPath).toBe("D:/PolyU");
    expect(it.atMs).toBe(NOW);
  });

  it("returns at most DEFAULT_ACTIVITY_LIMIT when no limit given", () => {
    const projects = Array.from({ length: DEFAULT_ACTIVITY_LIMIT + 50 }, (_, i) =>
      proj({ name: `p${i}`, cc: { lastActiveMs: NOW - i, lastActionOneLiner: "x" } }),
    );
    expect(buildActivityFeed(projects)).toHaveLength(DEFAULT_ACTIVITY_LIMIT);
  });

  it("handles an empty project list", () => {
    expect(buildActivityFeed([])).toEqual([]);
  });

  it("filters by source, project, and a rolling seven-day window", () => {
    const items = [
      { source: "codex", project: "alpha", canonicalPath: "D:/Alpha", atMs: NOW - 1_000, text: "a" },
      { source: "git", project: "alpha", canonicalPath: "D:/Alpha", atMs: NOW - 2 * 24 * 60 * 60 * 1000, text: "b" },
      { source: "codex", project: "beta", canonicalPath: "D:/Beta", atMs: NOW - 8 * 24 * 60 * 60 * 1000, text: "c" },
    ] as ActivityItem[];
    expect(filterActivityFeed(items, { sources: ["codex"], project: "alpha", range: "7d" }, NOW)).toEqual([items[0]]);
  });
});
