import type { UnifiedProject } from "@ai-dashboard/core";

export function project(
  name: string,
  options: Partial<UnifiedProject> = {},
): UnifiedProject {
  return {
    canonicalPath: `D:/Projects/${name}`,
    displayPath: `D:\\Projects\\${name}`,
    name,
    sources: ["codex"],
    lastActiveMs: Date.now() - 2 * 60 * 60 * 1000,
    recencyBucket: "today",
    liveStatus: "none",
    stage: "building",
    synthStale: false,
    signalsBySource: {},
    ...options,
  };
}

export function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}
