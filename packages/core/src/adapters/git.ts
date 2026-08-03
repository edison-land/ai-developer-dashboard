import { execFile } from "node:child_process";
import path from "node:path";
import type { StatusSnapshot } from "../domain.js";
import { pathKey } from "../paths.js";

interface GitResult {
  ok: boolean;
  stdout: string;
  stderr: string;
}

function runGit(cwd: string, args: string[]): Promise<GitResult> {
  return new Promise((resolve) => {
    execFile(
      "git",
      ["-C", cwd, "-c", "core.quotepath=false", ...args],
      {
        env: { ...process.env, GIT_UTF8: "1", LC_ALL: "C.UTF-8" },
        windowsHide: true,
        maxBuffer: 4 * 1024 * 1024,
        timeout: 15000,
      },
      (err, stdout, stderr) => {
        resolve({
          ok: !err,
          stdout: stdout || "",
          stderr: stderr || "",
        });
      },
    );
  });
}

/** Convert the canonical slash-separated representation into a host path for git. */
function nativePath(canonicalPath: string): string {
  return process.platform === "win32" ? canonicalPath.replace(/\//g, "\\") : canonicalPath;
}

interface ParsedStatus {
  branch: string;
  ahead: number;
  behind: number;
  hasUpstream: boolean;
  dirtyFileCount: number;
  dirtySample: string[];
  noCommits: boolean;
}

export function parseStatus(out: string): ParsedStatus {
  const lines = out.split(/\r?\n/).filter((l) => l.length > 0);
  let branch = "(unknown)";
  let ahead = 0;
  let behind = 0;
  let hasUpstream = false;
  let noCommits = false;
  const dirty: string[] = [];

  for (const line of lines) {
    if (line.startsWith("## ")) {
      const hdr = line.slice(3);
      const nc = hdr.match(/on (.+)$/);
      if (/No commits yet|Initial commit/.test(hdr) && nc) {
        noCommits = true;
        branch = nc[1] ?? branch;
      } else {
        // Branch is the token before the `...` tracking ref and any `[ahead/behind]` bracket.
        const beforeTracking = hdr.split("...")[0] ?? hdr;
        const beforeBracket = beforeTracking.split("[")[0] ?? beforeTracking;
        const tok = beforeBracket.trim().split(/\s+/)[0];
        if (tok) branch = tok === "HEAD" ? "(detached)" : tok;
      }
      if (hdr.includes("...")) hasUpstream = true;
      const ab = hdr.match(/\[ahead\s+(\d+)(?:,\s*behind\s+(\d+))?\]|\[behind\s+(\d+)(?:,\s*ahead\s+(\d+))?\]/);
      if (ab) {
        ahead = Number(ab[1] ?? ab[4] ?? 0);
        behind = Number(ab[2] ?? ab[3] ?? 0);
        hasUpstream = true;
      }
    } else if (line.length >= 3) {
      dirty.push(line.slice(3));
    }
  }
  return {
    branch,
    ahead,
    behind,
    hasUpstream,
    dirtyFileCount: dirty.length,
    dirtySample: dirty.slice(0, 5),
    noCommits,
  };
}

/**
 * Snapshots git state per project, live, by spawning git. Paths are passed as
 * an argv array (never a shell string) so backslashes/spaces/CJK need no
 * quoting. Concurrency is capped because spawning many git processes on Windows
 * is slow. Failures (non-repo, missing upstream, no commits) are captured as
 * fields, never thrown — the card shows a muted line.
 */
export class GitAdapter {
  constructor(private concurrency = 6) {}

  async snapshotOne(canonicalPath: string): Promise<StatusSnapshot> {
    const dir = nativePath(canonicalPath);
    const [status, head, log] = await Promise.all([
      runGit(dir, ["status", "-b", "--porcelain=v1"]),
      runGit(dir, ["rev-parse", "HEAD"]),
      runGit(dir, ["log", "-1", "--pretty=%s%x1f%an%x1f%cI"]),
    ]);

    if (!status.ok) {
      return {
        branch: "(unknown)",
        headSha: null,
        headCommit: null,
        dirtyFileCount: 0,
        aheadBehind: { ahead: 0, behind: 0, hasUpstream: false },
        gitError: (status.stderr.split(/\r?\n/)[0] || "git error").trim(),
      };
    }

    const parsed = parseStatus(status.stdout);

    let headSha: string | null = null;
    let headCommit: StatusSnapshot["headCommit"] = null;
    if (head.ok && head.stdout.trim()) {
      headSha = head.stdout.trim();
    }
    if (log.ok && log.stdout.trim()) {
      const [subject, author, iso] = log.stdout.trim().split("\x1f");
      const dateMs = iso ? Date.parse(iso) : NaN;
      if (subject && author) {
        headCommit = { subject, author, dateMs: Number.isNaN(dateMs) ? 0 : dateMs };
      }
    }

    return {
      branch: parsed.branch,
      headSha,
      headCommit,
      dirtyFileCount: parsed.dirtyFileCount,
      dirtySample: parsed.dirtySample,
      aheadBehind: { ahead: parsed.ahead, behind: parsed.behind, hasUpstream: parsed.hasUpstream },
      gitError: parsed.noCommits ? "no commits yet" : undefined,
    };
  }

  async snapshotAll(canonicalPaths: string[]): Promise<Map<string, StatusSnapshot>> {
    const results = await mapPool(canonicalPaths, (p) => this.snapshotOne(p), this.concurrency);
    const map = new Map<string, StatusSnapshot>();
    canonicalPaths.forEach((p, i) => map.set(pathKey(p), results[i]!));
    return map;
  }
}

/** Bounded concurrency mapper — avoids spawning dozens of git processes at once. */
async function mapPool<T, R>(items: T[], fn: (t: T) => Promise<R>, concurrency: number): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  const workers = Array.from({ length: workerCount }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await fn(items[idx]!);
    }
  });
  await Promise.all(workers);
  return results;
}
