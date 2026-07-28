import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type DashboardConfig,
  resolveConfig,
  type SynthOutcome,
  type UnifiedProject,
  SqliteStore,
} from "@ai-dashboard/core/node";
import { createApp, type ServerDeps } from "./app.js";

let store: SqliteStore;
let cfg: DashboardConfig;
let collected: UnifiedProject[];

beforeEach(() => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "addb-srv-"));
  cfg = resolveConfig();
  store = new SqliteStore(path.join(dir, "test.db"));
  collected = [makeProject("D:/Foo"), makeProject("D:/Bar")];
});

function makeProject(cp: string): UnifiedProject {
  return {
    canonicalPath: cp,
    displayPath: cp.replace(/\//g, "\\"),
    name: cp.split("/").filter(Boolean).pop() ?? cp,
    sources: ["claude-code"],
    lastActiveMs: 1.7e12,
    recencyBucket: "today",
    liveStatus: "none",
    synthStale: false,
    signalsBySource: {},
  };
}

function freshOutcome(): SynthOutcome {
  return {
    ok: true,
    result: {
      stage: "building",
      summary: "正在搞",
      nextStep: "继续写测试",
      blockers: [],
      model: "glm-4.7-flash",
      provider: "zhipu",
      generatedAtMs: 123,
      inputHash: "h",
    },
    fromCache: false,
  };
}

function deps(): ServerDeps {
  return { config: cfg, store, collect: async () => collected, synthesize: async () => freshOutcome() };
}

function enc(p: string): string {
  return Buffer.from(p, "utf8").toString("base64url");
}

describe("createApp", () => {
  it("GET /api/health returns ok with dataRoot and dbPath", async () => {
    const res = await createApp(deps()).request("/api/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body).toHaveProperty("dataRoot");
    expect(body).toHaveProperty("dbPath");
  });

  it("GET /api/projects returns the collected projects", async () => {
    const res = await createApp(deps()).request("/api/projects");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.projects).toHaveLength(2);
    expect(body.projects.map((p: UnifiedProject) => p.canonicalPath)).toContain("D:/Foo");
  });

  it("POST /api/refresh recomputes", async () => {
    const res = await createApp(deps()).request("/api/refresh", { method: "POST" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.generatedAtMs).toBeGreaterThan(0);
  });

  it("PATCH /api/projects/:enc/stage persists the override", async () => {
    const res = await createApp(deps()).request(`/api/projects/${enc("D:/Foo")}/stage`, {
      method: "PATCH",
      body: JSON.stringify({ stage: "done" }),
      headers: { "content-type": "application/json" },
    });
    expect(res.status).toBe(200);
    expect(store.getStageOverride("D:/Foo")).toBe("done");
  });

  it("PATCH rejects an invalid stage with 400", async () => {
    const res = await createApp(deps()).request(`/api/projects/${enc("D:/Foo")}/stage`, {
      method: "PATCH",
      body: JSON.stringify({ stage: "nope" }),
      headers: { "content-type": "application/json" },
    });
    expect(res.status).toBe(400);
  });

  it("PUT /api/settings stores settings and never echoes the raw key", async () => {
    const res = await createApp(deps()).request("/api/settings", {
      method: "PUT",
      body: JSON.stringify({ provider: "openai", anthropicApiKey: "sk-secret" }),
      headers: { "content-type": "application/json" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.provider).toBe("openai");
    expect(body.hasAnthropicKey).toBe(true);
    expect(body.anthropicApiKey).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("sk-secret");
  });

  it("returns 500 JSON with the cause when collect throws (for UI diagnosis)", async () => {
    const throwing: ServerDeps = {
      config: cfg,
      store,
      collect: async () => {
        throw new Error("boom: sqlite locked");
      },
      synthesize: async () => freshOutcome(),
    };
    const res = await createApp(throwing).request("/api/projects");
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("internal_error");
    expect(body.message).toContain("boom: sqlite locked");
  });

  it("POST /api/projects/:enc/synthesize returns the outcome + refreshed project", async () => {
    const synth = vi.fn(async (_p: UnifiedProject): Promise<SynthOutcome> => freshOutcome());
    const d: ServerDeps = { config: cfg, store, collect: async () => collected, synthesize: synth };
    const res = await createApp(d).request(`/api/projects/${enc("D:/Foo")}/synthesize`, { method: "POST" });
    expect(res.status).toBe(200);
    expect(synth).toHaveBeenCalledTimes(1);
    const body = (await res.json()) as any;
    expect(body.outcome.ok).toBe(true);
    expect(body.outcome.result.nextStep).toBe("继续写测试");
    expect(body.project.canonicalPath).toBe("D:/Foo");
  });

  it("synthesize route surfaces a failed outcome without 500ing", async () => {
    const d: ServerDeps = {
      config: cfg,
      store,
      collect: async () => collected,
      synthesize: async () => ({ ok: false, error: "模型调用失败：no key" }),
    };
    const res = await createApp(d).request(`/api/projects/${enc("D:/Foo")}/synthesize`, { method: "POST" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.outcome.ok).toBe(false);
    expect(body.outcome.error).toContain("no key");
  });

  it("POST /api/synthesize-all tallies cached/fresh/failed for non-stale projects", async () => {
    const d: ServerDeps = {
      config: cfg,
      store,
      collect: async () => collected,
      synthesize: async () => freshOutcome(),
    };
    const res = await createApp(d).request("/api/synthesize-all", { method: "POST" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.total).toBe(2); // both fixtures are "today" (non-stale)
    expect(body.fresh).toBe(2);
    expect(body.failed).toBe(0);
  });

  it("GET /api/activity returns the merged cross-project timeline, newest-first", async () => {
    collected = [
      {
        ...makeProject("D:/Foo"),
        signalsBySource: {
          "claude-code": { source: "claude-code", canonicalPath: "D:/Foo", lastActiveMs: 1.7e12, lastActionOneLiner: "CC: edit foo" },
        },
      },
      {
        ...makeProject("D:/Bar"),
        git: {
          branch: "main",
          headSha: "s",
          headCommit: { subject: "feat: bar", author: "a", dateMs: 1.7e12 + 1000 },
          dirtyFileCount: 0,
          aheadBehind: { ahead: 0, behind: 0, hasUpstream: true },
        },
      },
    ];
    const res = await createApp(deps()).request("/api/activity");
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.items.map((i: any) => [i.project, i.source])).toEqual([
      ["Bar", "git"], // 1.7e12 + 1000 (newer)
      ["Foo", "claude-code"], // 1.7e12
    ]);
  });

  it("GET /api/activity is empty when no project has actionable signals", async () => {
    // default fixtures have empty signalsBySource + no git -> no items
    const res = await createApp(deps()).request("/api/activity");
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.items).toEqual([]);
  });

  it("GET /api/projects excludes archived projects by default", async () => {
    store.archive("D:/Foo", 1234);
    const res = await createApp(deps()).request("/api/projects");
    const body = (await res.json()) as any;
    expect(body.projects.map((p: any) => p.canonicalPath)).toEqual(["D:/Bar"]);
  });

  it("GET /api/projects?includeArchived=true keeps them with archivedAtMs", async () => {
    store.archive("D:/Foo", 1234);
    const res = await createApp(deps()).request("/api/projects?includeArchived=true");
    const body = (await res.json()) as any;
    const foo = body.projects.find((p: any) => p.canonicalPath === "D:/Foo");
    expect(foo).toBeTruthy();
    expect(foo.archivedAtMs).toBe(1234);
  });

  it("POST then DELETE /api/projects/:enc/archive archives and restores", async () => {
    const archiveRes = await createApp(deps()).request(`/api/projects/${enc("D:/Foo")}/archive`, {
      method: "POST",
    });
    expect(archiveRes.status).toBe(200);
    expect(store.allArchived().has("d:/foo")).toBe(true);

    const listRes = await createApp(deps()).request("/api/projects");
    const listBody = (await listRes.json()) as any;
    expect(listBody.projects.map((p: any) => p.canonicalPath)).toEqual(["D:/Bar"]);

    const restoreRes = await createApp(deps()).request(`/api/projects/${enc("D:/Foo")}/archive`, {
      method: "DELETE",
    });
    expect(restoreRes.status).toBe(200);
    expect(store.allArchived().has("d:/foo")).toBe(false);
  });

  it("GET /api/activity hides archived projects", async () => {
    collected = [
      {
        ...makeProject("D:/Foo"),
        signalsBySource: {
          "claude-code": { source: "claude-code", canonicalPath: "D:/Foo", lastActiveMs: 1.7e12, lastActionOneLiner: "hi" },
        },
      },
    ];
    store.archive("D:/Foo", 1234);
    const res = await createApp(deps()).request("/api/activity");
    const body = (await res.json()) as any;
    expect(body.items).toEqual([]); // Foo would normally appear, but it's archived
  });
});
