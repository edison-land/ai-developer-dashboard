import { describe, expect, it, vi } from "vitest";
import { ApiError, api } from "./api";

describe("batch synthesis public API", () => {
  it("applies each progress event before returning the final totals", async () => {
    const events = [
      { type: "progress", canonicalPath: "D:/Alpha", completed: 1, total: 2, status: "fresh", cached: 0, fresh: 1, failed: 0 },
      { type: "progress", canonicalPath: "D:/Beta", completed: 2, total: 2, status: "failed", cached: 0, fresh: 1, failed: 1, error: "no key" },
      { type: "complete", total: 2, cached: 0, fresh: 1, failed: 1, generatedAtMs: 10 },
    ];
    vi.stubGlobal("fetch", vi.fn(async () => new Response(events.map((event) => JSON.stringify(event)).join("\n") + "\n", {
      headers: { "content-type": "application/x-ndjson" },
    })));
    const progress: string[] = [];
    const result = await api.synthesizeAll((event) => {
      progress.push(`${event.completed}:${event.status}`);
    });
    expect(progress).toEqual(["1:fresh", "2:failed"]);
    expect(result).toMatchObject({ total: 2, fresh: 1, failed: 1 });
    vi.unstubAllGlobals();
  });

  it("turns an invalid event into a parse error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("not-json\n")));
    await expect(api.synthesizeAll()).rejects.toMatchObject({ kind: "parse" } satisfies Partial<ApiError>);
    vi.unstubAllGlobals();
  });

  it("rejects valid JSON events that are missing required fields", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ type: "progress" }) + "\n")));
    await expect(api.synthesizeAll()).rejects.toMatchObject({ kind: "parse", message: "批量总结进度字段不完整" });
    vi.unstubAllGlobals();
  });

  it("rejects a progress event with an unusable project payload", async () => {
    const event = {
      type: "progress",
      canonicalPath: "D:/Alpha",
      completed: 1,
      total: 1,
      status: "fresh",
      cached: 0,
      fresh: 1,
      failed: 0,
      project: {},
    };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(event) + "\n")));
    await expect(api.synthesizeAll()).rejects.toMatchObject({ kind: "parse", message: "批量总结进度字段不完整" });
    vi.unstubAllGlobals();
  });
});
