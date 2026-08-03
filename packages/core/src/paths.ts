/**
 * Path helpers. The single most error-prone module in the project: paths flow in
 * from three sources (Claude Code `.claude.json`, Codex `threads.cwd`, and the
 * OS) in mixed forms — backslashes, forward slashes, `\\?\` extended-length
 * prefixes, CJK characters, and inconsistent drive-letter case. Everything is
 * normalized to a **canonical** forward-slash form internally; we convert back
 * to backslashes only for Windows display.
 */

/** Remove the Windows `\\?\` (or `\\?\UNC\`) extended-length path prefix. */
export function stripExtendedPrefix(p: string): string {
  return p
    .replace(/^\\\\\?\\UNC\\/i, "\\\\")
    .replace(/^\\\\\?\\/i, "");
}

/**
 * Normalize any incoming path to canonical form:
 * forward slashes, no extended prefix, uppercase drive letter, no trailing slash.
 * CJK and spaces are preserved (this form is the merge key across all adapters).
 */
export function canonicalizePath(p: string): string {
  let s = stripExtendedPrefix(p);
  s = s.replace(/\\/g, "/");
  s = s.replace(/^([a-z]):/i, (_m, d) => d.toUpperCase() + ":");
  s = s.replace(/\/+$/, "");
  return s;
}

/**
 * Convert a canonical (forward-slash) path to the running platform's display
 * form: backslashes on Windows, forward slashes everywhere else. macOS/Linux
 * paths must never be rewritten to backslashes — `\Users\foo` is not a real
 * path there (this exact mistake broke every git snapshot on macOS).
 */
export function displayPath(
  canonical: string,
  platform: NodeJS.Platform = process.platform,
): string {
  return platform === "win32" ? canonical.replace(/\//g, "\\") : canonical;
}

/**
 * Case-insensitive merge key. Windows paths are case-insensitive, so the same
 * project may surface as `D:/PolyU` (Claude Code), `D:/polyu` (Codex), or
 * `d:\polyu` (config.toml). Group by this lowercased canonical form; keep a
 * case-preserved representative for display.
 */
export function pathKey(p: string): string {
  return canonicalizePath(p).toLowerCase();
}

/** Last segment of a canonical path (CJK-safe). Falls back to the input if empty. */
export function basename(canonical: string): string {
  const segs = canonical.split("/").filter(Boolean);
  return segs[segs.length - 1] ?? canonical;
}

/**
 * Encode a filesystem path the way Claude Code names its `~/.claude/projects/`
 * folders: every character that is not ASCII alphanumeric becomes `-`, with NO
 * collapsing of consecutive runs (CJK characters each become their own dash).
 *
 * This transform is **lossy and irreversible** — use it only to LOCATE a folder
 * for transcript drill-down, never to recover a real path. Verified against the
 * real folders on this machine (see paths.test.ts).
 */
export function encodeClaudeFolder(path: string): string {
  return path.replace(/[^A-Za-z0-9]/g, "-");
}
