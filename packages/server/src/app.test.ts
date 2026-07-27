import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { type DashboardConfig, resolveConfig, type UnifiedProject, SqliteStore } from "@ai-dashboard/core/node";
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

function deps(): ServerDeps {
  return { config: cfg, store, collect: async () => collected };
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
    };
    const res = await createApp(throwing).request("/api/projects");
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("internal_error");
    expect(body.message).toContain("boom: sqlite locked");
  });
});
