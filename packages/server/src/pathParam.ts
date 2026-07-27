/**
 * Windows paths contain backslashes, drive colons, spaces, and CJK — all of
 * which break URL path params. Encode the canonical path as URL-safe base64url
 * for the `:enc` segment of project routes.
 */
export function encodePath(canonical: string): string {
  return Buffer.from(canonical, "utf8").toString("base64url");
}

export function decodePath(enc: string): string {
  return Buffer.from(enc, "base64url").toString("utf8");
}
