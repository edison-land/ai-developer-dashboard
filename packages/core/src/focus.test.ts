import { describe, expect, it } from "vitest";
import type { FocusPreferences, UnifiedProject } from "./domain.js";
import { localDateKey, selectAttentionProjects, selectTodayFocus } from "./focus.js";

const NOW = new Date(2026, 6, 28, 12, 0, 0).getTime();

function project(
  canonicalPath: string,
  overrides: Partial<UnifiedProject> = {},
): UnifiedProject {
  return {
    canonicalPath,
    displayPath: canonicalPath,
    name: canonicalPath.split("/").pop() ?? canonicalPath,
    sources: ["codex"],
    lastActiveMs: NOW - 60_000,
    recencyBucket: "today",
    liveStatus: "none",
    stage: "building",
    synthStale: false,
    signalsBySource: {},
    ...overrides,
  };
}

function preferences(overrides: Partial<FocusPreferences> = {}): FocusPreferences {
  return {
    pinnedPaths: [],
    dismissedPaths: [],
    localDate: localDateKey(NOW),
    ...overrides,
  };
}

describe("selectTodayFocus", () => {
  it("keeps three valid manual pins in their chosen order", () => {
    const projects = [project("D:/A"), project("D:/B"), project("D:/C")];
    const result = selectTodayFocus(
      projects,
      preferences({ pinnedPaths: ["D:/C", "D:/A", "D:/B"] }),
      NOW,
    );
    expect(result.map((item) => item.project.name)).toEqual(["C", "A", "B"]);
    expect(result.every((item) => item.reason === "pinned" && item.pinned)).toBe(true);
  });

  it("fills empty pin slots from automatic candidates", () => {
    const projects = [
      project("D:/Pinned"),
      project("D:/Busy", { liveStatus: "busy" }),
      project("D:/Recent", { lastActiveMs: NOW - 100 }),
    ];
    const result = selectTodayFocus(
      projects,
      preferences({ pinnedPaths: ["D:/Pinned"] }),
      NOW,
    );
    expect(result.map((item) => item.project.name)).toEqual(["Pinned", "Busy", "Recent"]);
  });

  it("does not recommend a project dismissed today", () => {
    const result = selectTodayFocus(
      [project("D:/A"), project("D:/B"), project("D:/C")],
      preferences({ dismissedPaths: ["D:/A"] }),
      NOW,
    );
    expect(result.map((item) => item.project.name)).not.toContain("A");
  });

  it("expires yesterday's dismissals on the next local day", () => {
    const yesterday = localDateKey(NOW - 24 * 60 * 60 * 1000);
    const result = selectTodayFocus(
      [project("D:/A")],
      preferences({ dismissedPaths: ["D:/A"], localDate: yesterday }),
      NOW,
    );
    expect(result[0]?.project.name).toBe("A");
  });

  it("excludes archived and done projects even when pinned", () => {
    const result = selectTodayFocus(
      [
        project("D:/Archived", { archivedAtMs: NOW }),
        project("D:/Done", { stage: "done" }),
        project("D:/Live"),
      ],
      preferences({ pinnedPaths: ["D:/Archived", "D:/Done", "D:/Live"] }),
      NOW,
    );
    expect(result.map((item) => item.project.name)).toEqual(["Live"]);
  });

  it("prioritizes running, then user-action, then active development", () => {
    const result = selectTodayFocus(
      [
        project("D:/Build"),
        project("D:/Action", { synth: synth("user-action") }),
        project("D:/Busy", { liveStatus: "busy" }),
        project("D:/Old", { recencyBucket: "stale", lastActiveMs: NOW - 10_000 }),
      ],
      preferences(),
      NOW,
    );
    expect(result.map((item) => [item.project.name, item.reason])).toEqual([
      ["Busy", "running"],
      ["Action", "needs-action"],
      ["Build", "recent"],
    ]);
  });

  it("puts waiting projects behind actionable and ordinary recent work", () => {
    const result = selectTodayFocus(
      [
        project("D:/Waiting", { liveStatus: "idle", synth: synth("waiting") }),
        project("D:/Recent", { stage: "idea" }),
        project("D:/Action", { synth: synth("user-action") }),
      ],
      preferences(),
      NOW,
    );
    expect(result.map((item) => item.project.name)).toEqual(["Action", "Recent", "Waiting"]);
  });

  it("uses waiting projects only as a final fallback", () => {
    const result = selectTodayFocus(
      [project("D:/Waiting", { synth: synth("waiting") })],
      preferences(),
      NOW,
    );
    expect(result[0]?.project.name).toBe("Waiting");
  });

  it("matches pins case-insensitively and across slash styles", () => {
    const result = selectTodayFocus(
      [project("D:/Foo")],
      preferences({ pinnedPaths: ["d:\\foo"] }),
      NOW,
    );
    expect(result[0]).toMatchObject({ pinned: true, reason: "pinned" });
  });

  it("deduplicates repeated pins and keeps at most three results", () => {
    const result = selectTodayFocus(
      [project("D:/A"), project("D:/B"), project("D:/C"), project("D:/D")],
      preferences({ pinnedPaths: ["D:/A", "d:/a", "D:/B", "D:/C", "D:/D"] }),
      NOW,
    );
    expect(result.map((item) => item.project.name)).toEqual(["A", "B", "C"]);
  });

  it("returns fewer than three without duplicating when candidates are scarce", () => {
    const result = selectTodayFocus([project("D:/Only")], preferences(), NOW);
    expect(result).toHaveLength(1);
    expect(new Set(result.map((item) => item.project.canonicalPath)).size).toBe(1);
  });

  it("is deterministic when timestamps are equal", () => {
    const projects = [project("D:/z"), project("D:/a"), project("D:/m")];
    const first = selectTodayFocus(projects, preferences(), NOW);
    const second = selectTodayFocus([...projects].reverse(), preferences(), NOW);
    expect(first.map((item) => item.project.name)).toEqual(["a", "m", "z"]);
    expect(second.map((item) => item.project.name)).toEqual(["a", "m", "z"]);
  });
});

describe("selectAttentionProjects", () => {
  it("excludes focus projects and puts user-action first", () => {
    const focusProject = project("D:/Focus", { liveStatus: "busy" });
    const projects = [
      focusProject,
      project("D:/Recent", { lastActiveMs: NOW }),
      project("D:/Action", {
        lastActiveMs: NOW - 100_000,
        synth: synth("user-action"),
      }),
    ];
    const focus = [{ project: focusProject, reason: "pinned" as const, pinned: true }];
    const result = selectAttentionProjects(projects, focus, 2);
    expect(result.map((item) => item.name)).toEqual(["Action", "Recent"]);
  });
});

function synth(attention: "user-action" | "waiting" | "none" | "unknown") {
  return {
    stage: "building" as const,
    summary: "summary",
    nextStep: "next",
    blockers: attention === "none" ? [] : ["blocker"],
    attention,
    model: "m",
    provider: "zhipu" as const,
    generatedAtMs: NOW,
    inputHash: "h",
  };
}
