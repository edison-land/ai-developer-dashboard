import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SETTINGS, type ProviderId, type Settings, type Stage, type Store, type SynthCacheEntry, type SynthResult } from "./domain.js";
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
];

const SETTING_KEYS = ["provider", "model", "auto_refresh_mins", "synth_on_refresh"] as const;

/**
 * Local persistence for synthesis cache, manual stage overrides, and settings
 * (including API keys). Uses Node's built-in `node:sqlite` — no native build
 * step. All project lookups are keyed case-insensitively via pathKey so a
 * project surfacing with different case still hits the same row.
 */
export class SqliteStore implements Store {
  private db: DatabaseSync;
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
      allSynth: this.db.prepare("SELECT canonical_path, result_json, input_hash FROM synth_cache"),
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

  allOverrides(): Map<string, Stage> {
    const rows = this.stmts.allOverrides.all() as { canonical_path: string; stage: Stage }[];
    return new Map(rows.map((r) => [r.canonical_path, r.stage]));
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
    for (const k of SETTING_KEYS) {
      const v = patch[k];
      if (v !== undefined) this.stmts.upsertSetting.run(k, String(v));
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
