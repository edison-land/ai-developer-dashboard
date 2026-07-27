import fs from "node:fs";
import path from "node:path";
import type { RawSignals } from "../domain.js";
import { canonicalizePath, encodeClaudeFolder, pathKey } from "../paths.js";
import type { DashboardConfig } from "../config.js";
import type { Adapter, CollectOpts } from "./types.js";

interface ClaudeProjectEntry {
  lastSessionId?: string;
  lastSessionModified?: number;
  lastSessionFirstPrompt?: string;
  lastTotalInputTokens?: number;
  lastTotalOutputTokens?: number;
  lastCost?: number;
}
interface ClaudeJson {
  projects?: Record<string, ClaudeProjectEntry>;
}

interface SessionRow {
  cwd?: string;
  status?: string;
  updatedAt?: unknown;
  kind?: string;
}

function toMs(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  if (typeof v === "string") {
    const t = Date.parse(v);
    return Number.isNaN(t) ? undefined : t;
  }
  return undefined;
}

function maxDefined(...vals: (number | undefined)[]): number | undefined {
  const xs = vals.filter((v): v is number => v !== undefined);
  return xs.length ? Math.max(...xs) : undefined;
}

/**
 * Reads Claude Code's local state. The canonical project list and last-session
 * metadata come from `~/.claude.json` (paths there are already in forward-slash
 * form, CJK intact — the reliable source of truth). Live busy/idle status comes
 * from `~/.claude/sessions/<pid>.json`. Transcripts are NOT read here; only the
 * tail path is stashed for lazy synthesis.
 */
export class ClaudeCodeAdapter implements Adapter {
  readonly id = "claude-code" as const;
  constructor(private cfg: DashboardConfig) {}

  available(): boolean {
    return fs.existsSync(this.cfg.claudeJson);
  }

  async collect(_opts: CollectOpts): Promise<RawSignals[]> {
    if (!this.available()) return [];
    const data = JSON.parse(fs.readFileSync(this.cfg.claudeJson, "utf8")) as ClaudeJson;
    const projects = data.projects ?? {};
    const liveByPath = this.readLiveSessions();

    const out: RawSignals[] = [];
    for (const [rawPath, entry] of Object.entries(projects)) {
      const canonicalPath = canonicalizePath(rawPath);
      const live = liveByPath.get(pathKey(canonicalPath));
      const tokens =
        (entry.lastTotalInputTokens ?? 0) + (entry.lastTotalOutputTokens ?? 0) || undefined;

      const transcriptTailPath = entry.lastSessionId
        ? path.join(
            this.cfg.claudeDir,
            "projects",
            encodeClaudeFolder(rawPath),
            `${entry.lastSessionId}.jsonl`,
          )
        : undefined;

      out.push({
        source: "claude-code",
        canonicalPath,
        lastActiveMs: maxDefined(entry.lastSessionModified, toMs(live?.updatedAt)),
        lastActionOneLiner: entry.lastSessionFirstPrompt,
        liveStatus:
          live?.status === "busy" ? "busy" : live?.status === "idle" ? "idle" : undefined,
        tokensUsed: tokens,
        costUsd: typeof entry.lastCost === "number" ? entry.lastCost : undefined,
        transcriptTailPath,
      });
    }
    return out;
  }

  /** Map pathKey -> most recent live session status for each cwd. */
  private readLiveSessions(): Map<string, { status?: string; updatedAt?: number }> {
    const dir = path.join(this.cfg.claudeDir, "sessions");
    const map = new Map<string, { status?: string; updatedAt?: number }>();
    let files: string[];
    try {
      files = fs.readdirSync(dir);
    } catch {
      return map;
    }
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      try {
        const row = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as SessionRow;
        if (!row.cwd) continue;
        const key = pathKey(canonicalizePath(row.cwd));
        const updatedAt = toMs(row.updatedAt);
        const prev = map.get(key);
        // Keep the newest entry, but only promote status from a row that has one.
        if (!prev || (updatedAt !== undefined && (prev.updatedAt ?? 0) < updatedAt)) {
          map.set(key, { status: row.status ?? prev?.status, updatedAt: updatedAt ?? prev?.updatedAt });
        } else if (row.status && !prev.status) {
          prev.status = row.status;
        }
      } catch {
        // skip unreadable session file
      }
    }
    return map;
  }
}
