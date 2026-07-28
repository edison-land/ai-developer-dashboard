import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_SETTINGS,
  type FocusPreferences,
  type ProviderId,
  type Settings,
  type Stage,
  type Store,
  type SynthCacheEntry,
  type SynthResult,
} from "./domain.js";
import { pathKey } from "./paths.js";

// Loaded via createRequire so bundlers/transformers (Vite, vitest) never see a
// bare `node:sqlite` import to mis-resolve. `node:sqlite` ships with Node 22.5+.
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");

const MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS synth_cache (
     canonical_path TEXT PRIMARY KEY,
     input_hash     TEXT NOT NULL,
     result_json    TEXT NOT NULL,
     model          TEXT,
     provider       TEXT,
     generated_at_ms INTEGER NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS stage_overrides (
     canonical_path TEXT PRIMARY KEY,
     stage          TEXT NOT NULL,
     updated_at_ms  INTEGER NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS settings (
     key   TEXT PRIMARY KEY,
     value TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS archives (
     canonical_path TEXT PRIMARY KEY,
     archived_at_ms INTEGER NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS focus_preferences (
     canonical_path TEXT PRIMARY KEY,
     pinned_rank    INTEGER CHECK (pinned_rank IN (0, 1, 2)),
     dismissed_on  TEXT,
     updated_at_ms INTEGER NOT NULL
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS focus_preferences_unique_rank
     ON focus_preferences(pinned_rank)
     WHERE pinned_rank IS NOT NULL`,
];

const SETTING_FIELDS = [
  ["provider", "provider"],
  ["model", "model"],
  ["autoRefreshMins", "auto_refresh_mins"],
  ["synthOnRefresh", "synth_on_refresh"],
] as const;

/**
 * Local persistence for synthesis cache, manual stage overrides, and settings
 * (including API keys). Uses Node's built-in `node:sqlite` — no native build
 * step. All project lookups are keyed case-insensitively via pathKey so a
 * project surfacing with different case still hits the same row.
 */
export class SqliteStore implements Store {
  private db: InstanceType<typeof DatabaseSync>;
  private stmts;

  constructor(dbPath: string) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec("PRAGMA foreign_keys = ON;");
    for (const sql of MIGRATIONS) this.db.exec(sql);

    this.stmts = {
      getSynth: this.db.prepare(
        "SELECT result_json, input_hash FROM synth_cache WHERE canonical_path = ?",
      ),
      upsertSynth: this.db.prepare(
        `INSERT INTO synth_cache (canonical_path, input_hash, result_json, model, provider, generated_at_ms)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(canonical_path) DO UPDATE SET
           input_hash = excluded.input_hash,
           result_json = excluded.result_json,
           model = excluded.model,
           provider = excluded.provider,
           generated_at_ms = excluded.generated_at_ms`,
      ),
      getOverride: this.db.prepare("SELECT stage FROM stage_overrides WHERE canonical_path = ?"),
      upsertOverride: this.db.prepare(
        `INSERT INTO stage_overrides (canonical_path, stage, updated_at_ms) VALUES (?, ?, ?)
         ON CONFLICT(canonical_path) DO UPDATE SET stage = excluded.stage, updated_at_ms = excluded.updated_at_ms`,
      ),
      deleteOverride: this.db.prepare("DELETE FROM stage_overrides WHERE canonical_path = ?"),
      allOverrides: this.db.prepare("SELECT canonical_path, stage FROM stage_overrides"),
      upsertArchive: this.db.prepare(
        `INSERT INTO archives (canonical_path, archived_at_ms) VALUES (?, ?)
         ON CONFLICT(canonical_path) DO UPDATE SET archived_at_ms = excluded.archived_at_ms`,
      ),
      deleteArchive: this.db.prepare("DELETE FROM archives WHERE canonical_path = ?"),
      allArchives: this.db.prepare("SELECT canonical_path, archived_at_ms FROM archives"),
      allSynth: this.db.prepare("SELECT canonical_path, result_json, input_hash FROM synth_cache"),
      allFocus: this.db.prepare(
        "SELECT canonical_path, pinned_rank, dismissed_on FROM focus_preferences",
      ),
      deleteAllFocus: this.db.prepare("DELETE FROM focus_preferences"),
      insertFocus: this.db.prepare(
        `INSERT INTO focus_preferences
           (canonical_path, pinned_rank, dismissed_on, updated_at_ms)
         VALUES (?, ?, ?, ?)`,
      ),
      deleteFocus: this.db.prepare("DELETE FROM focus_preferences WHERE canonical_path = ?"),
      getSetting: this.db.prepare("SELECT value FROM settings WHERE key = ?"),
      upsertSetting: this.db.prepare(
        `INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      ),
      allSettings: this.db.prepare("SELECT key, value FROM settings"),
    };
  }

  close(): void {
    this.db.close();
  }

  getSynth(canonicalPath: string): SynthCacheEntry | undefined {
    const row = this.stmts.getSynth.get(pathKey(canonicalPath)) as
      | { result_json: string; input_hash: string }
      | undefined;
    if (!row) return undefined;
    return { result: JSON.parse(row.result_json) as SynthResult, inputHash: row.input_hash };
  }

  setSynth(canonicalPath: string, result: SynthResult): void {
    this.stmts.upsertSynth.run(
      pathKey(canonicalPath),
      result.inputHash,
      JSON.stringify(result),
      result.model,
      result.provider,
      result.generatedAtMs,
    );
  }

  getStageOverride(canonicalPath: string): Stage | undefined {
    const row = this.stmts.getOverride.get(pathKey(canonicalPath)) as { stage: Stage } | undefined;
    return row?.stage;
  }

  setStageOverride(canonicalPath: string, stage: Stage): void {
    this.stmts.upsertOverride.run(pathKey(canonicalPath), stage, Date.now());
  }

  clearStageOverride(canonicalPath: string): void {
    this.stmts.deleteOverride.run(pathKey(canonicalPath));
  }

  archive(canonicalPath: string, atMs: number): void {
    const key = pathKey(canonicalPath);
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.stmts.deleteFocus.run(key);
      this.stmts.upsertArchive.run(key, atMs);
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  unarchive(canonicalPath: string): void {
    this.stmts.deleteArchive.run(pathKey(canonicalPath));
  }

  allOverrides(): Map<string, Stage> {
    const rows = this.stmts.allOverrides.all() as { canonical_path: string; stage: Stage }[];
    return new Map(rows.map((r) => [r.canonical_path, r.stage]));
  }

  allArchived(): Map<string, number> {
    const rows = this.stmts.allArchives.all() as { canonical_path: string; archived_at_ms: number }[];
    return new Map(rows.map((r) => [r.canonical_path, r.archived_at_ms]));
  }

  allSynth(): Map<string, SynthCacheEntry> {
    const rows = this.stmts.allSynth.all() as {
      canonical_path: string;
      result_json: string;
      input_hash: string;
    }[];
    return new Map(
      rows.map((r) => [
        r.canonical_path,
        { result: JSON.parse(r.result_json) as SynthResult, inputHash: r.input_hash },
      ]),
    );
  }

  getFocusPreferences(localDate: string): FocusPreferences {
    const rows = this.stmts.allFocus.all() as {
      canonical_path: string;
      pinned_rank: number | null;
      dismissed_on: string | null;
    }[];
    const pinnedPaths = rows
      .filter((row) => row.pinned_rank !== null)
      .sort((a, b) => (a.pinned_rank ?? 0) - (b.pinned_rank ?? 0))
      .map((row) => row.canonical_path);
    const dismissedPaths = rows
      .filter((row) => row.dismissed_on === localDate)
      .map((row) => row.canonical_path)
      .sort();
    return { pinnedPaths, dismissedPaths, localDate };
  }

  setFocusPreferences(preferences: FocusPreferences): void {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(preferences.localDate)) {
      throw new Error("focus localDate must be YYYY-MM-DD");
    }
    const pinnedPaths = preferences.pinnedPaths.map(pathKey);
    const dismissedPaths = preferences.dismissedPaths.map(pathKey);
    if (pinnedPaths.length > 3) throw new Error("focus supports at most three pinned paths");
    if (new Set(pinnedPaths).size !== pinnedPaths.length) {
      throw new Error("focus pinned paths must be unique");
    }
    if (new Set(dismissedPaths).size !== dismissedPaths.length) {
      throw new Error("focus dismissed paths must be unique");
    }
    const dismissed = new Set(dismissedPaths);
    if (pinnedPaths.some((canonicalPath) => dismissed.has(canonicalPath))) {
      throw new Error("a focus path cannot be both pinned and dismissed");
    }

    const entries = new Map<
      string,
      { pinnedRank: number | null; dismissedOn: string | null }
    >();
    pinnedPaths.forEach((canonicalPath, index) => {
      entries.set(canonicalPath, { pinnedRank: index, dismissedOn: null });
    });
    dismissedPaths.forEach((canonicalPath) => {
      entries.set(canonicalPath, {
        pinnedRank: null,
        dismissedOn: preferences.localDate,
      });
    });

    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.stmts.deleteAllFocus.run();
      const now = Date.now();
      for (const [canonicalPath, entry] of entries) {
        this.stmts.insertFocus.run(
          canonicalPath,
          entry.pinnedRank,
          entry.dismissedOn,
          now,
        );
      }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  clearFocusPreference(canonicalPath: string): void {
    this.stmts.deleteFocus.run(pathKey(canonicalPath));
  }

  getSettings(): Settings {
    const rows = this.stmts.allSettings.all() as { key: string; value: string }[];
    const map = new Map(rows.map((r) => [r.key, r.value]));
    return {
      provider: (map.get("provider") as Settings["provider"]) || DEFAULT_SETTINGS.provider,
      model: map.get("model") || DEFAULT_SETTINGS.model,
      hasAnthropicKey: Boolean(map.get("anthropic_api_key")),
      hasOpenAIKey: Boolean(map.get("openai_api_key")),
      hasZhipuKey: Boolean(map.get("zhipu_api_key")),
      autoRefreshMins: Number(map.get("auto_refresh_mins") ?? DEFAULT_SETTINGS.autoRefreshMins),
      synthOnRefresh: (map.get("synth_on_refresh") ?? "0") === "1",
    };
  }

  setSettings(patch: Partial<Settings> & { anthropicApiKey?: string; openaiApiKey?: string; zhipuApiKey?: string }): void {
    for (const [field, storageKey] of SETTING_FIELDS) {
      const value = patch[field];
      if (value === undefined) continue;
      const stored = field === "synthOnRefresh" ? (value ? "1" : "0") : String(value);
      this.stmts.upsertSetting.run(storageKey, stored);
    }
    if (patch.anthropicApiKey !== undefined) {
      this.stmts.upsertSetting.run("anthropic_api_key", patch.anthropicApiKey);
    }
    if (patch.openaiApiKey !== undefined) {
      this.stmts.upsertSetting.run("openai_api_key", patch.openaiApiKey);
    }
    if (patch.zhipuApiKey !== undefined) {
      this.stmts.upsertSetting.run("zhipu_api_key", patch.zhipuApiKey);
    }
  }

  getApiKey(provider: ProviderId): string | undefined {
    const key =
      provider === "zhipu" ? "zhipu_api_key" : provider === "anthropic" ? "anthropic_api_key" : "openai_api_key";
    const row = this.stmts.getSetting.get(key) as { value: string } | undefined;
    const v = row?.value;
    return v && v.length > 0 ? v : undefined;
  }
}
