/**
 * Path helpers. The single most error-prone module in the project: paths flow in
 * from three sources (Claude Code `.claude.json`, Codex `threads.cwd`, and the
 * OS) in mixed forms — backslashes, forward slashes, `\\?\` extended-length
 * prefixes, CJK characters, and inconsistent drive-letter case. Everything is
 * normalized to a **canonical** forward-slash form internally. Callers that
 * execute a path must convert it for their host platform instead of reusing a
 * user-facing display value.
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
  // Keep POSIX and drive roots intact while removing accidental trailing
  // separators from project paths.
  if (s !== "/" && !/^[A-Z]:\/$/.test(s)) s = s.replace(/\/+$/, "");
  return s;
}

function isWindowsCanonicalPath(canonical: string): boolean {
  return /^[A-Za-z]:(?:\/|$)/.test(canonical) || canonical.startsWith("//");
}

/**
 * Render a canonical path with separators appropriate to the path it
 * represents: backslashes for Windows paths, forward slashes for POSIX.
 * POSIX paths must never be rewritten to backslashes — `\Users\foo` is not a
 * real path (this exact mistake broke every git snapshot on macOS).
 */
export function displayPath(canonical: string): string {
  return isWindowsCanonicalPath(canonical) ? canonical.replace(/\//g, "\\") : canonical;
}

/**
 * Merge key. Windows paths are case-insensitive, so the same project may
 * surface as `D:/PolyU` (Claude Code), `D:/polyu` (Codex), or `d:\polyu`
 * (config.toml). POSIX paths keep their case because macOS volumes may be
 * configured as case-sensitive.
 */
export function pathKey(p: string): string {
  const canonical = canonicalizePath(p);
  return isWindowsCanonicalPath(canonical) ? canonical.toLowerCase() : canonical;
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
