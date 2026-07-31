import { createRequire } from "node:module";
import fs from "node:fs";
import { parse as parseToml } from "@iarna/toml";
import type { RawSignals } from "../domain.js";
import type { DashboardConfig } from "../config.js";
import { canonicalizePath, pathKey } from "../paths.js";
import type { Adapter, CollectOpts } from "./types.js";

// Loaded via createRequire so bundlers/transformers (Vite, vitest) never see a
// bare `node:sqlite` import to mis-resolve — same pattern as store.ts.
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");

/** Columns we know how to use; missing ones degrade gracefully (never bind a CLI version). */
const KNOWN_COLS = [
  "cwd",
  "updated_at",
  "created_at",
  "first_user_message",
  "title",
  "tokens_used",
  "git_branch",
  "git_sha",
  "model_provider",
  "archived",
] as const;

/** Normalized shape of one Codex thread after schema-driven extraction. */
export interface ThreadRow {
  cwd?: string;
  updatedAtSec?: number;
  createdAtSec?: number;
  firstUserMessage?: string;
  title?: string;
  tokensUsed?: number;
  gitBranch?: string;
  gitSha?: string;
  modelProvider?: string;
}

function num(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim().length > 0) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function str(v: unknown): string | undefined {
  if (typeof v === "string") {
    const t = v.trim();
    return t.length > 0 ? t : undefined;
  }
  return undefined;
}

/**
 * Reduce raw Codex thread rows into one signal per project (grouped by
 * case-insensitive canonical path). The most recently updated thread wins as
 * the representative; tokens are summed across all of the project's threads.
 * Pure — unit-testable without a database.
 */
export function reduceThreads(rows: ThreadRow[]): RawSignals[] {
  interface Group {
    rep: ThreadRow;
    rows: ThreadRow[];
    canonicalPath: string;
  }
  const groups = new Map<string, Group>();
  for (const r of rows) {
    const cwd = str(r.cwd);
    if (!cwd) continue; // can't place a thread without a cwd
    const canonicalPath = canonicalizePath(cwd);
    const key = pathKey(canonicalPath);
    const score = r.updatedAtSec ?? r.createdAtSec ?? 0;
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, { rep: r, rows: [r], canonicalPath });
      continue;
    }
    existing.rows.push(r);
    const repScore = existing.rep.updatedAtSec ?? existing.rep.createdAtSec ?? 0;
    if (score > repScore) existing.rep = r;
  }

  const out: RawSignals[] = [];
  for (const { rep, rows, canonicalPath } of groups.values()) {
    const activeSec = rep.updatedAtSec ?? rep.createdAtSec;
    const tokens = rows.reduce((sum, r) => sum + (r.tokensUsed ?? 0), 0);
    out.push({
      source: "codex",
      canonicalPath,
      lastActiveMs: activeSec !== undefined ? activeSec * 1000 : undefined,
      lastActionOneLiner: rep.firstUserMessage ?? rep.title,
      tokensUsed: tokens > 0 ? tokens : undefined,
      rawMeta: {
        threadCount: rows.length,
        gitBranch: rep.gitBranch,
        gitSha: rep.gitSha,
        modelProvider: rep.modelProvider,
      },
    });
  }
  return out;
}

/**
 * Parse `[projects."<path>"]` keys from Codex's config.toml into minimal seed
 * signals, so projects registered-but-never-run still appear on the board.
 * Pure — unit-testable without a file.
 */
export function seedsFromToml(text: string): RawSignals[] {
  let parsed: unknown;
  try {
    parsed = parseToml(text);
  } catch {
    return [];
  }
  const projects = (parsed as { projects?: Record<string, unknown> })?.projects;
  if (!projects || typeof projects !== "object") return [];
  const out: RawSignals[] = [];
  for (const rawKey of Object.keys(projects)) {
    const p = str(rawKey);
    if (!p) continue;
    out.push({ source: "codex", canonicalPath: canonicalizePath(p) });
  }
  return out;
}

/**
 * Reads Codex's local state. The threads table in `~/.codex/state_5.sqlite` is
 * the source of truth (cwd + updated_at + first_user_message). config.toml
 * contributes trusted seed paths for projects with no session yet. The DB is
 * opened **read-only** via a `file:…?mode=ro` URI and held only for one SELECT
 * — Codex is a live writer, so we never take a write lock or hold the connection.
 */
export class CodexAdapter implements Adapter {
  readonly id = "codex" as const;
  constructor(private cfg: DashboardConfig) {}

  available(): boolean {
    return fs.existsSync(this.cfg.codexDb);
  }

  async collect(_opts: CollectOpts): Promise<RawSignals[]> {
    const fromThreads = this.readThreads();
    const fromSeeds = this.readSeeds();
    // Seeds only fill paths the threads didn't cover; dedup by pathKey.
    const byKey = new Map<string, RawSignals>();
    for (const s of fromThreads) byKey.set(pathKey(s.canonicalPath), s);
    for (const s of fromSeeds) {
      const key = pathKey(s.canonicalPath);
      if (!byKey.has(key)) byKey.set(key, s);
    }
    return [...byKey.values()];
  }

  private readThreads(): RawSignals[] {
    if (!this.available()) return [];
    // Read-only URI open: SQLite honors ?mode=ro when SQLITE_OPEN_URI is set
    // (node:sqlite sets it). Verified to block writes on Node 24.15.0.
    const uri = "file:" + this.cfg.codexDb.replace(/\\/g, "/") + "?mode=ro";
    let db;
    try {
      db = new DatabaseSync(uri);
    } catch (e) {
      console.warn(
        `[codex] cannot open ${this.cfg.codexDb} read-only:`,
        e instanceof Error ? e.message : e,
      );
      return [];
    }
    try {
      const cols = new Set(
        (db.prepare("PRAGMA table_info(threads)").all() as { name: string }[]).map((r) => r.name),
      );
      const missing = KNOWN_COLS.filter((c) => !cols.has(c));
      if (missing.length) console.warn("[codex] threads missing columns (degrading):", missing.join(", "));
      if (!cols.has("cwd")) return []; // nothing useful without cwd

      const select = (
        ["cwd", "updated_at", "created_at", "first_user_message", "title", "tokens_used", "git_branch", "git_sha", "model_provider"] as const
      ).filter((c) => cols.has(c));
      let sql = `SELECT ${select.join(", ")} FROM threads`;
      if (cols.has("archived")) sql += " WHERE archived = 0 OR archived IS NULL";

      const rows = db.prepare(sql).all() as Record<string, unknown>[];
      const threadRows: ThreadRow[] = rows.map((r) => ({
        cwd: str(r.cwd) ?? "",
        updatedAtSec: num(r.updated_at),
        createdAtSec: num(r.created_at),
        firstUserMessage: str(r.first_user_message),
        title: str(r.title),
        tokensUsed: num(r.tokens_used),
        gitBranch: str(r.git_branch),
        gitSha: str(r.git_sha),
        modelProvider: str(r.model_provider),
      }));
      return reduceThreads(threadRows);
    } catch (e) {
      console.warn("[codex] query failed:", e instanceof Error ? e.message : e);
      return [];
    } finally {
      try {
        db.close();
      } catch {
        // ignore
      }
    }
  }

  private readSeeds(): RawSignals[] {
    try {
      return seedsFromToml(fs.readFileSync(this.cfg.codexConfigToml, "utf8"));
    } catch {
      return [];
    }
  }
}
