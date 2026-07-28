import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { SqliteStore } from "./store.js";
import type { Stage, SynthResult } from "./domain.js";

let dbPath: string;
beforeEach(() => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "addb-store-"));
  dbPath = path.join(dir, "test.db");
});

const synth: SynthResult = {
  stage: "building",
  summary: "s",
  nextStep: "n",
  blockers: [],
  model: "m",
  provider: "anthropic",
  generatedAtMs: 1,
  inputHash: "h1",
};

describe("SqliteStore", () => {
  it("round-trips synth cache by path (case-insensitive key)", () => {
    const s = new SqliteStore(dbPath);
    expect(s.getSynth("D:/Foo")).toBeUndefined();
    s.setSynth("D:/Foo", synth);
    const got = s.getSynth("d:\\foo");
    expect(got?.result.stage).toBe("building");
    expect(got?.inputHash).toBe("h1");
  });

  it("round-trips stage overrides and clears them", () => {
    const s = new SqliteStore(dbPath);
    expect(s.getStageOverride("D:/P")).toBeUndefined();
    s.setStageOverride("D:/P", "done" as Stage);
    expect(s.getStageOverride("d:\\p")).toBe("done");
    s.clearStageOverride("D:/P");
    expect(s.getStageOverride("D:/P")).toBeUndefined();
  });

  it("stores settings and api keys without leaking keys through getSettings", () => {
    const s = new SqliteStore(dbPath);
    expect(s.getSettings().hasAnthropicKey).toBe(false);
    s.setSettings({ provider: "openai", model: "gpt-4o-mini", anthropicApiKey: "sk-secret" });
    const settings = s.getSettings();
    expect(settings.provider).toBe("openai");
    expect(settings.hasAnthropicKey).toBe(true);
    expect(settings.model).toBe("gpt-4o-mini");
    expect(JSON.stringify(settings)).not.toContain("sk-secret");
    expect(s.getApiKey("anthropic")).toBe("sk-secret");
    expect(s.getApiKey("openai")).toBeUndefined();
  });

  it("persists across instances reopening the same file", () => {
    const s1 = new SqliteStore(dbPath);
    s1.setSynth("D:/X", synth);
    const s2 = new SqliteStore(dbPath);
    expect(s2.getSynth("D:/X")?.result.stage).toBe("building");
  });

  it("bulk-loads all overrides and synth entries (keyed by pathKey)", () => {
    const s = new SqliteStore(dbPath);
    s.setStageOverride("D:/A", "done");
    s.setStageOverride("D:/B", "idea");
    s.setSynth("D:/C", synth);
    const ov = s.allOverrides();
    expect(ov.size).toBe(2);
    expect(ov.get("d:/a")).toBe("done");
    const sc = s.allSynth();
    expect(sc.get("d:/c")?.result.stage).toBe("building");
  });

  it("persists ordered focus pins and same-day dismissals", () => {
    const s = new SqliteStore(dbPath);
    s.setFocusPreferences({
      pinnedPaths: ["D:/B", "D:/A"],
      dismissedPaths: ["D:/C"],
      localDate: "2026-07-28",
    });
    expect(s.getFocusPreferences("2026-07-28")).toEqual({
      pinnedPaths: ["d:/b", "d:/a"],
      dismissedPaths: ["d:/c"],
      localDate: "2026-07-28",
    });
    expect(s.getFocusPreferences("2026-07-29")).toEqual({
      pinnedPaths: ["d:/b", "d:/a"],
      dismissedPaths: [],
      localDate: "2026-07-29",
    });
  });

  it("validates focus uniqueness and pin/dismiss overlap", () => {
    const s = new SqliteStore(dbPath);
    expect(() =>
      s.setFocusPreferences({
        pinnedPaths: ["D:/A", "d:/a"],
        dismissedPaths: [],
        localDate: "2026-07-28",
      }),
    ).toThrow(/unique/);
    expect(() =>
      s.setFocusPreferences({
        pinnedPaths: ["D:/A"],
        dismissedPaths: ["d:/a"],
        localDate: "2026-07-28",
      }),
    ).toThrow(/both pinned and dismissed/);
  });

  it("clears a project's focus preference when it is archived", () => {
    const s = new SqliteStore(dbPath);
    s.setFocusPreferences({
      pinnedPaths: ["D:/A"],
      dismissedPaths: ["D:/B"],
      localDate: "2026-07-28",
    });
    s.archive("d:\\a", 123);
    expect(s.getFocusPreferences("2026-07-28")).toEqual({
      pinnedPaths: [],
      dismissedPaths: ["d:/b"],
      localDate: "2026-07-28",
    });
  });
});
