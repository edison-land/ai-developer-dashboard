import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { pathKey } from "./installer-fixture-path.mjs";

const [dataDir, codexHome, localDate, ...projectPaths] = process.argv.slice(2);
if (!dataDir || !codexHome || !localDate || projectPaths.length !== 3) {
  throw new Error("usage: node seed-desktop-installer-data.mjs <data-dir> <codex-home> <local-date> <project-a> <project-b> <project-c>");
}

const resolvedProjects = projectPaths.map((projectPath) => path.resolve(projectPath));
for (const projectPath of resolvedProjects) fs.mkdirSync(projectPath, { recursive: true });
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(codexHome, { recursive: true });

const dbPath = path.join(dataDir, "dashboard.db");
if (fs.existsSync(dbPath)) throw new Error(`refusing to overwrite existing database: ${dbPath}`);

const codexDbPath = path.join(codexHome, "state_5.sqlite");
const codexDb = new DatabaseSync(codexDbPath);
codexDb.exec(`
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
const insertThread = codexDb.prepare(
  `INSERT INTO threads
    (cwd, updated_at, created_at, first_user_message, title, tokens_used, git_branch, git_sha, model_provider, archived)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
);
resolvedProjects.forEach((projectPath, index) => {
  insertThread.run(
    projectPath,
    1_900_000_000 - index,
    1_900_000_000 - index - 10,
    `fixture project ${index + 1}`,
    `Installer continuity fixture ${index + 1}`,
    100 + index,
    "main",
    `fixture-sha-${index + 1}`,
    "openai",
  );
});
codexDb.close();
fs.writeFileSync(
  path.join(codexHome, "config.toml"),
  resolvedProjects.map((projectPath) => `[projects.${JSON.stringify(projectPath)}]\n`).join(""),
  "utf8",
);

const db = new DatabaseSync(dbPath);
db.exec(`
  CREATE TABLE synth_cache (
    canonical_path TEXT PRIMARY KEY,
    input_hash TEXT NOT NULL,
    result_json TEXT NOT NULL,
    model TEXT,
    provider TEXT,
    generated_at_ms INTEGER NOT NULL
  );
  CREATE TABLE stage_overrides (
    canonical_path TEXT PRIMARY KEY,
    stage TEXT NOT NULL,
    updated_at_ms INTEGER NOT NULL
  );
  CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE archives (
    canonical_path TEXT PRIMARY KEY,
    archived_at_ms INTEGER NOT NULL
  );
  CREATE TABLE focus_preferences (
    canonical_path TEXT PRIMARY KEY,
    pinned_rank INTEGER CHECK (pinned_rank IN (0, 1, 2)),
    dismissed_on TEXT,
    updated_at_ms INTEGER NOT NULL
  );
  CREATE UNIQUE INDEX focus_preferences_unique_rank
    ON focus_preferences(pinned_rank)
    WHERE pinned_rank IS NOT NULL;
`);

const projectA = pathKey(resolvedProjects[0]);
const projectB = pathKey(resolvedProjects[1]);
const projectC = pathKey(resolvedProjects[2]);
const generatedAtMs = 1_900_000_123_000;
const synthResult = {
  stage: "verifying",
  summary: "fixture cached summary",
  nextStep: "继续验证安装版数据连续性。",
  blockers: [],
  attention: "none",
  model: "fixture-model",
  provider: "openai",
  generatedAtMs,
  inputHash: "fixture-input-hash",
  tokenUsage: { input: 12, output: 8 },
};

const insertSetting = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)");
for (const [key, value] of [
  ["provider", "openai"],
  ["request_url", "https://fixture.invalid/v1/"],
  ["model", "fixture-model"],
  ["openai_api_key", "fixture-secret"],
  ["auto_refresh_mins", "15"],
  ["synth_on_refresh", "1"],
]) insertSetting.run(key, value);

db.prepare(
  "INSERT INTO stage_overrides (canonical_path, stage, updated_at_ms) VALUES (?, ?, ?)",
).run(projectA, "verifying", generatedAtMs);
db.prepare(
  "INSERT INTO archives (canonical_path, archived_at_ms) VALUES (?, ?)",
).run(projectB, generatedAtMs);
db.prepare(
  "INSERT INTO focus_preferences (canonical_path, pinned_rank, dismissed_on, updated_at_ms) VALUES (?, ?, ?, ?)",
).run(projectC, 0, null, generatedAtMs);
db.prepare(
  "INSERT INTO synth_cache (canonical_path, input_hash, result_json, model, provider, generated_at_ms) VALUES (?, ?, ?, ?, ?, ?)",
).run(projectA, synthResult.inputHash, JSON.stringify(synthResult), synthResult.model, synthResult.provider, generatedAtMs);
db.close();

console.log(JSON.stringify({
  dataDir: path.resolve(dataDir),
  dbPath,
  codexHome: path.resolve(codexHome),
  localDate,
  projects: resolvedProjects,
}));
