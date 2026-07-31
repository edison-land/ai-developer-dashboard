import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveConfig } from "../config.js";
import { reduceThreads, seedsFromToml, type ThreadRow, CodexAdapter } from "./codex.js";

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");

const cfg = resolveConfig();
const hasCodex = fs.existsSync(cfg.codexDb);
const itReal = hasCodex ? it : it.skip;

describe("reduceThreads (pure)", () => {
  it("groups threads by case-insensitive canonical path into one signal", () => {
    const rows: ThreadRow[] = [
      { cwd: "D:\\PolyU", updatedAtSec: 100, firstUserMessage: "a", tokensUsed: 10 },
      { cwd: "d:\\polyu", updatedAtSec: 200, firstUserMessage: "b", tokensUsed: 5 },
    ];
    const out = reduceThreads(rows);
    expect(out).toHaveLength(1);
    expect(out[0]!.source).toBe("codex");
    expect(out[0]!.canonicalPath).toBe("D:/PolyU");
    expect(out[0]!.tokensUsed).toBe(15); // summed across both threads
  });

  it("picks the most recently updated thread as the representative", () => {
    const rows: ThreadRow[] = [
      { cwd: "D:/Foo", updatedAtSec: 100, firstUserMessage: "older" },
      { cwd: "D:/Foo", updatedAtSec: 300, firstUserMessage: "newer" },
      { cwd: "D:/Foo", updatedAtSec: 200, firstUserMessage: "middle" },
    ];
    const out = reduceThreads(rows);
    expect(out).toHaveLength(1);
    expect(out[0]!.lastActiveMs).toBe(300_000); // sec -> ms
    expect(out[0]!.lastActionOneLiner).toBe("newer");
  });

  it("strips the \\\\?\\ extended-length prefix from cwd", () => {
    const out = reduceThreads([{ cwd: "\\\\?\\D:\\foo", updatedAtSec: 1, title: "t" }]);
    expect(out[0]!.canonicalPath).toBe("D:/foo");
  });

  it("prefers first_user_message over title for the one-liner", () => {
    const a = reduceThreads([{ cwd: "D:/A", updatedAtSec: 1, firstUserMessage: "msg", title: "t" }]);
    expect(a[0]!.lastActionOneLiner).toBe("msg");
    const b = reduceThreads([{ cwd: "D:/B", updatedAtSec: 1, title: "only-title" }]);
    expect(b[0]!.lastActionOneLiner).toBe("only-title");
  });

  it("falls back to created_at when updated_at is absent", () => {
    const out = reduceThreads([{ cwd: "D:/X", createdAtSec: 500 }]);
    expect(out[0]!.lastActiveMs).toBe(500_000);
  });

  it("skips rows without a cwd", () => {
    const out = reduceThreads([{ updatedAtSec: 1 }, { cwd: "   " }, { cwd: "D:/Y", updatedAtSec: 2 }]);
    expect(out).toHaveLength(1);
    expect(out[0]!.canonicalPath).toBe("D:/Y");
  });

  it("records threadCount + git fields from the representative (newest) thread", () => {
    const out = reduceThreads([
      { cwd: "D:/Z", updatedAtSec: 1 },
      { cwd: "D:/Z", updatedAtSec: 2, gitBranch: "main", gitSha: "abc", modelProvider: "openai" },
    ]);
    expect(out[0]!.rawMeta).toMatchObject({ threadCount: 2, gitBranch: "main", gitSha: "abc", modelProvider: "openai" });
  });
});

describe("seedsFromToml (pure)", () => {
  it("turns [projects] keys into minimal seed signals", () => {
    const toml = `
[projects.'D:\\Bar']
[projects."E:/Baz"]
[other]
key = "ignored"
`;
    const out = seedsFromToml(toml);
    expect(out.map((s) => s.canonicalPath).sort()).toEqual(["D:/Bar", "E:/Baz"]);
    for (const s of out) {
      expect(s.source).toBe("codex");
      expect(s.lastActiveMs).toBeUndefined();
    }
  });

  it("returns [] for invalid TOML or a missing projects section", () => {
    expect(seedsFromToml("this is = = not toml")).toEqual([]);
    expect(seedsFromToml('[other]\nkey = "v"')).toEqual([]);
    expect(seedsFromToml("")).toEqual([]);
  });
});

describe("CodexAdapter", () => {
  it("reports availability based on ~/.codex/state_5.sqlite", () => {
    expect(new CodexAdapter(cfg).available()).toBe(hasCodex);
  });

  itReal("returns at least one well-formed signal from real threads", async () => {
    const signals = await new CodexAdapter(cfg).collect({});
    expect(signals.length).toBeGreaterThan(0);
    for (const s of signals) {
      expect(s.source).toBe("codex");
      expect(s.canonicalPath).toMatch(/^[A-Z]:\//); // canonical forward-slash, upper drive
    }
    // At least one project is dated like a real epoch-ms timestamp (~2023+).
    const last = Math.max(...signals.map((s) => s.lastActiveMs ?? 0));
    expect(last).toBeGreaterThan(1.6e12);
  });

  itReal("includes at least one project with a non-empty one-liner", async () => {
    const signals = await new CodexAdapter(cfg).collect({});
    expect(signals.some((s) => (s.lastActionOneLiner ?? "").length > 0)).toBe(true);
  });

  it("keeps a real thread timestamp when the same project is also a config seed", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ai-dashboard-codex-"));
    const dbPath = path.join(root, "state_5.sqlite");
    const configToml = path.join(root, "config.toml");
    const updatedAtSec = 1_900_000_000;
    try {
      fs.writeFileSync(configToml, '[projects."D:/Foo"]\n');
      const db = new DatabaseSync(dbPath);
      db.exec(`
        CREATE TABLE threads (
          cwd TEXT,
          updated_at INTEGER,
          created_at INTEGER,
          first_user_message TEXT,
          title TEXT,
          tokens_used INTEGER,
          git_branch TEXT,
          git_sha TEXT,
          model_provider TEXT,
          archived INTEGER
        )
      `);
      db.prepare(
        `INSERT INTO threads
          (cwd, updated_at, created_at, first_user_message, archived)
         VALUES (?, ?, ?, ?, 0)`,
      ).run("D:/Foo", updatedAtSec, updatedAtSec - 10, "just worked");
      db.close();

      const signals = await new CodexAdapter({ ...cfg, codexDb: dbPath, codexConfigToml: configToml }).collect({});
      const project = signals.find((signal) => signal.canonicalPath === "D:/Foo");
      expect(project?.lastActiveMs).toBe(updatedAtSec * 1000);
      expect(project?.lastActionOneLiner).toBe("just worked");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
