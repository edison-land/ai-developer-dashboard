import path from "node:path";

export function pathKey(value) {
  let normalized = path.resolve(value).replace(/\\/g, "/");
  normalized = normalized.replace(/^([a-z]):/i, (_match, drive) => `${drive.toUpperCase()}:`);
  normalized = normalized.replace(/\/+$/, "");
  return normalized.toLowerCase();
}
