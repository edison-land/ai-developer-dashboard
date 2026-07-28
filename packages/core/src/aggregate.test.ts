import { describe, expect, it } from "vitest";
import type { RawSignals, Stage, StatusSnapshot, SynthCacheEntry, SynthResult } from "./domain.js";
import { computeInputHash, mergeByCanonicalPath, withArchived } from "./aggregate.js";

const NOW = 1_700_000_000_000;

function cc(path: string, lastActiveMs: number, extra: Partial<RawSignals> = {}): RawSignals {
  return { source: "claude-code", canonicalPath: path, lastActiveMs, ...extra };
}

function makeSynth(stage: Stage, inputHash = "irrelevant"): SynthResult {
  return {
    stage,
    summary: "s",
    nextStep: "n",
    blockers: [],
    model: "m",
    provider: "anthropic",
    generatedAtMs: NOW,
    inputHash,
  };
}

function git(dirty: number, extra: Partial<StatusSnapshot> = {}): StatusSnapshot {
  return {
    branch: "main",
    headSha: "abc123",
    headCommit: { subject: "init", author: "a", dateMs: NOW - 5000 },
    dirtyFileCount: dirty,
    aheadBehind: { ahead: 0, behind: 0, hasUpstream: true },
    ...extra,
  };
}

function merge(
  signals: RawSignals[],
  gitByPath: Map<string, StatusSnapshot> = new Map(),
  ctx: { overrides?: Map<string, Stage>; synthCache?: Map<string, SynthCacheEntry>; nowMs?: number } = {},
) {
  return mergeByCanonicalPath(signals, gitByPath, {
    overrides: ctx.overrides ?? new Map(),
    synthCache: ctx.synthCache ?? new Map(),
    nowMs: ctx.nowMs ?? NOW,
  });
}

describe("mergeByCanonicalPath", () => {
  it("merges signals from multiple sources by case-insensitive path", () => {
    const signals: RawSignals[] = [
      cc("D:/btc-bear-market-dashboard", NOW - 1_000, {
        lastActionOneLiner: "CC: fix off-by-one",
        transcriptTailPath: "/tmp/x.jsonl",
      }),
      // different case -> same pathKey -> same project
      { source: "codex", canonicalPath: "D:/BTC-bear-market-dashboard", lastActiveMs: NOW - 2_000, lastActionOneLiner: "Codex: implement goal" },
    ];
    const gitByPath = new Map<string, StatusSnapshot>([
      ["d:/btc-bear-market-dashboard", git(4)],
    ]);

    const out = merge(signals, gitByPath);
    expect(out).toHaveLength(1);
    const p = out[0]!;
    expect([...p.sources].sort()).toEqual(["claude-code", "codex", "git"]);
    expect(p.lastActiveMs).toBe(NOW - 1_000); // max across sources
    expect(p.lastActionOneLiner).toBe("CC: fix off-by-one"); // CC precedence
    expect(p.git?.dirtyFileCount).toBe(4);
    expect(p.canonicalPath).toBe("D:/btc-bear-market-dashboard"); // CC representative case
    expect(p.displayPath).toBe("D:\\btc-bear-market-dashboard");
    expect(p.name).toBe("btc-bear-market-dashboard");
  });

  it("falls back through codex then git for the last-action one-liner", () => {
    const out = merge([{ source: "codex", canonicalPath: "D:/x", lastActiveMs: NOW, lastActionOneLiner: "codex msg" }]);
    expect(out[0]!.lastActionOneLiner).toBe("codex msg");
  });

  it("keeps a project that only has a claude-code signal (no git)", () => {
    const out = merge([cc("D:/solo", NOW - 1000)]);
    expect(out).toHaveLength(1);
    expect(out[0]!.sources).toEqual(["claude-code"]);
    expect(out[0]!.git).toBeUndefined();
    expect(out[0]!.liveStatus).toBe("none");
  });

  it("uses the git head date when every session source lacks an activity time", () => {
    const gitByPath = new Map<string, StatusSnapshot>([
      ["d:/active-repo", git(0)],
    ]);
    const out = merge(
      [
        { source: "claude-code", canonicalPath: "D:/active-repo" },
        { source: "codex", canonicalPath: "D:/active-repo" },
      ],
      gitByPath,
    );

    expect(out[0]!.lastActiveMs).toBe(NOW - 5000);
    expect(out[0]!.recencyBucket).toBe("today");
  });

  it("does not invent a project from git alone", () => {
    const gitByPath = new Map([["d:/orphan", git(0)]]);
    expect(merge([], gitByPath)).toHaveLength(0);
  });
});

describe("recency buckets", () => {
  it("marks a busy claude-code session as active-now", () => {
    const out = merge([cc("D:/a", NOW - 1000, { liveStatus: "busy" })]);
    expect(out[0]!.recencyBucket).toBe("active-now");
    expect(out[0]!.liveStatus).toBe("busy");
  });

  it("marks recent activity as today", () => {
    const out = merge([cc("D:/r", NOW - 3_600_000)]);
    expect(out[0]!.recencyBucket).toBe("today");
  });

  it("marks old activity as stale", () => {
    const out = merge([cc("D:/o", NOW - 10 * 86_400_000)]);
    expect(out[0]!.recencyBucket).toBe("stale");
  });

  it("treats a project with no last-active time as stale", () => {
    const out = merge([{ source: "codex", canonicalPath: "D:/seed" }]);
    expect(out[0]!.recencyBucket).toBe("stale");
  });
});

describe("stage + synth staleness", () => {
  it("prefers a manual override over a cached synth", () => {
    const overrides = new Map([["d:/s", "done" as Stage]]);
    const synthCache = new Map([["d:/s", { result: makeSynth("building"), inputHash: "h" }]]);
    const out = merge([cc("D:/s", NOW - 1000)], new Map(), { overrides, synthCache });
    expect(out[0]!.stage).toBe("done");
    expect(out[0]!.stageSource).toBe("override");
  });

  it("uses cached synth stage when no override and inputs unchanged", () => {
    const inputs = { lastActiveMs: NOW - 1000 };
    const synthCache = new Map([
      ["d:/s", { result: makeSynth("building", computeInputHash(inputs)), inputHash: computeInputHash(inputs) }],
    ]);
    const out = merge([cc("D:/s", NOW - 1000)], new Map(), { synthCache });
    expect(out[0]!.stage).toBe("building");
    expect(out[0]!.stageSource).toBe("synth");
    expect(out[0]!.synthStale).toBe(false);
  });

  it("flags synth as stale when inputs changed since the cached result", () => {
    const synthCache = new Map([["d:/s", { result: makeSynth("building", "old"), inputHash: "old" }]]);
    const out = merge([cc("D:/s", NOW - 1000)], new Map(), { synthCache });
    expect(out[0]!.synthStale).toBe(true);
  });
});

describe("withArchived", () => {
  it("stamps archivedAtMs by case-insensitive pathKey and leaves others untouched", () => {
    const projects = merge([cc("D:/Foo", NOW - 1000), cc("D:/Bar", NOW - 2000)]);
    const out = withArchived(projects, new Map([["d:/foo", 1234]]));
    const foo = out.find((p) => p.name === "Foo")!;
    const bar = out.find((p) => p.name === "Bar")!;
    expect(foo.archivedAtMs).toBe(1234);
    expect(bar.archivedAtMs).toBeUndefined();
  });

  it("returns the same array reference when nothing is archived", () => {
    const projects = merge([cc("D:/Foo", NOW - 1000)]);
    expect(withArchived(projects, new Map())).toBe(projects);
  });
});
