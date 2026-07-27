import os from "node:os";
import path from "node:path";

export interface DashboardConfig {
  /** `~/.claude` (or $CLAUDE_CONFIG_DIR). */
  claudeDir: string;
  /** `~/.claude.json` — the canonical project table. */
  claudeJson: string;
  /** `~/.codex` (or $CODEX_HOME). */
  codexDir: string;
  /** `~/.codex/state_5.sqlite` — the threads table. */
  codexDb: string;
  /** `~/.codex/config.toml` — trusted project seeds. */
  codexConfigToml: string;
  /** Our own data dir (`~/.ai-dashboard` or override). */
  dataDir: string;
  /** Our sqlite db. */
  dbPath: string;
}

function env(value: string | undefined, fallback: string): string {
  return value && value.trim().length > 0 ? path.resolve(value) : fallback;
}

export function resolveConfig(overrides?: { dataDir?: string }): DashboardConfig {
  const home = os.homedir();
  const claudeDir = env(process.env.CLAUDE_CONFIG_DIR, path.join(home, ".claude"));
  const codexDir = env(process.env.CODEX_HOME, path.join(home, ".codex"));
  const dataDir = env(
    overrides?.dataDir ?? process.env.AI_DASHBOARD_DATA_DIR,
    path.join(home, ".ai-dashboard"),
  );
  return {
    claudeDir,
    claudeJson: path.join(home, ".claude.json"),
    codexDir,
    codexDb: path.join(codexDir, "state_5.sqlite"),
    codexConfigToml: path.join(codexDir, "config.toml"),
    dataDir,
    dbPath: path.join(dataDir, "dashboard.db"),
  };
}
