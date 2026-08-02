import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { pathKey } from "./installer-fixture-path.mjs";

const [dbPath, localDate, ...projectPaths] = process.argv.slice(2);
if (!dbPath || !localDate || projectPaths.length !== 3) {
  throw new Error("usage: node inspect-desktop-installer-data.mjs <db-path> <local-date> <project-a> <project-b> <project-c>");
}

const keys = projectPaths.map(pathKey);
if (!fs.existsSync(dbPath)) throw new Error(`database not found: ${dbPath}`);
const db = new DatabaseSync(dbPath);
const settings = Object.fromEntries(
  db.prepare("SELECT key, value FROM settings ORDER BY key").all().map((row) => [row.key, row.value]),
);
const stage = db.prepare("SELECT stage FROM stage_overrides WHERE canonical_path = ?").get(keys[0]);
const archived = db.prepare("SELECT archived_at_ms FROM archives WHERE canonical_path = ?").get(keys[1]);
const focus = db.prepare(
  "SELECT canonical_path, pinned_rank, dismissed_on FROM focus_preferences WHERE canonical_path = ?",
).get(keys[2]);
const synth = db.prepare("SELECT result_json, input_hash FROM synth_cache WHERE canonical_path = ?").get(keys[0]);
const focusForDate = db.prepare(
  "SELECT canonical_path FROM focus_preferences WHERE pinned_rank IS NOT NULL ORDER BY pinned_rank",
).all();
db.close();

console.log(JSON.stringify({
  settings,
  stage,
  archived,
  focus,
  focusForDate,
  localDate,
  synth: synth ? { inputHash: synth.input_hash, result: JSON.parse(synth.result_json) } : null,
}));
