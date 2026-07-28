import fs from "node:fs";
import path from "node:path";
import { Hono, type Context } from "hono";
import {
  type DashboardConfig,
  type Stage,
  type Store,
  type SynthOutcome,
  type UnifiedProject,
  buildActivityFeed,
  pathKey,
  resolveConfig,
  STAGE,
  withArchived,
} from "@ai-dashboard/core/node";
import { decodePath } from "./pathParam.js";

export interface ServerDeps {
  config: DashboardConfig;
  store: Store;
  /** Recompute the unified project list (adapters + git + merge). */
  collect: () => Promise<UnifiedProject[]>;
  /** On-demand AI synthesis for one project (cache-aware; never throws). */
  synthesize: (project: UnifiedProject) => Promise<SynthOutcome>;
  /** Optional absolute path to the built UI; if absent, the API still works. */
  uiDir?: string;
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".map": "application/json",
};

/** Minimal, dependency-free static + SPA-fallback handler for the built UI. */
function uiHandler(uiDir: string) {
  return async (c: Context): Promise<Response> => {
    const reqPath = decodeURIComponent(new URL(c.req.url).pathname);
    let rel = reqPath === "/" ? "/index.html" : reqPath;
    const fp = path.normalize(path.join(uiDir, rel));
    if (!fp.startsWith(uiDir)) return c.text("forbidden", 403);
    const send = (file: string): Response => {
      const data = fs.readFileSync(file);
      return new Response(data, {
        headers: { "content-type": MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream" },
      });
    };
    try {
      if (fs.existsSync(fp) && fs.statSync(fp).isFile()) return send(fp);
    } catch {
      // fall through to SPA fallback
    }
    const indexHtml = path.join(uiDir, "index.html");
    if (fs.existsSync(indexHtml)) return send(indexHtml);
    return c.text("UI not built. Run `pnpm build:ui`.", 404);
  };
}

export function createApp(deps: ServerDeps): Hono {
  const app = new Hono();
  let state: { projects: UnifiedProject[]; generatedAtMs: number } = { projects: [], generatedAtMs: 0 };
  let loadPromise: Promise<void> | null = null;

  const refresh = async (): Promise<void> => {
    state = {
      projects: withArchived(await deps.collect(), deps.store.allArchived()),
      generatedAtMs: Date.now(),
    };
  };
  const ensureLoaded = async (): Promise<void> => {
    if (!loadPromise) loadPromise = refresh();
    await loadPromise;
  };
  const findProject = (canonical: string): UnifiedProject | undefined =>
    state.projects.find((p) => pathKey(p.canonicalPath) === pathKey(canonical));

  const api = new Hono();

  api.get("/health", (c) =>
    c.json({
      ok: true,
      dataRoot: deps.config.dataDir,
      dbPath: deps.config.dbPath,
      claudeCodeAvailable: fs.existsSync(deps.config.claudeJson),
      codexAvailable: fs.existsSync(deps.config.codexDb),
      gitAvailable: true,
      projectCount: state.projects.length,
      generatedAtMs: state.generatedAtMs,
    }),
  );

  api.get("/projects", async (c) => {
    await ensureLoaded();
    const includeArchived = c.req.query("includeArchived") === "true";
    const projects = includeArchived ? state.projects : state.projects.filter((p) => !p.archivedAtMs);
    return c.json({ projects, generatedAtMs: state.generatedAtMs });
  });

  api.post("/refresh", async (c) => {
    await refresh();
    return c.json({ projects: state.projects, generatedAtMs: state.generatedAtMs });
  });

  api.get("/projects/:enc", async (c) => {
    await ensureLoaded();
    const project = findProject(decodePath(c.req.param("enc")));
    if (!project) return c.json({ error: "not found" }, 404);
    return c.json({ project });
  });

  api.patch("/projects/:enc/stage", async (c) => {
    await ensureLoaded();
    const body = (await c.req.json().catch(() => ({}))) as { stage?: string };
    const stage = body?.stage as Stage | undefined;
    if (!stage || !(STAGE as readonly string[]).includes(stage)) {
      return c.json({ error: "invalid stage" }, 400);
    }
    const canonical = decodePath(c.req.param("enc"));
    if (!findProject(canonical)) return c.json({ error: "not found" }, 404);
    deps.store.setStageOverride(canonical, stage);
    await refresh();
    return c.json({ project: findProject(canonical) });
  });

  api.delete("/projects/:enc/stage", async (c) => {
    const canonical = decodePath(c.req.param("enc"));
    deps.store.clearStageOverride(canonical);
    await refresh();
    return c.json({ project: findProject(canonical) });
  });

  api.post("/projects/:enc/synthesize", async (c) => {
    await ensureLoaded();
    const canonical = decodePath(c.req.param("enc"));
    const project = findProject(canonical);
    if (!project) return c.json({ error: "not found" }, 404);
    const outcome = await deps.synthesize(project);
    await refresh();
    return c.json({ project: findProject(canonical), outcome });
  });

  api.post("/synthesize-all", async (c) => {
    await ensureLoaded();
    const includeStale = c.req.query("includeStale") === "true";
    const targets = state.projects.filter((p) => includeStale || p.recencyBucket !== "stale");
    let cached = 0;
    let fresh = 0;
    let failed = 0;
    for (const p of targets) {
      const r = await deps.synthesize(p);
      if (!r.ok) failed++;
      else if (r.fromCache) cached++;
      else fresh++;
    }
    await refresh();
    return c.json({ total: targets.length, cached, fresh, failed, generatedAtMs: state.generatedAtMs });
  });

  api.get("/settings", (c) => c.json(deps.store.getSettings()));
  api.put("/settings", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) ?? {};
    deps.store.setSettings(body);
    return c.json(deps.store.getSettings());
  });

  api.post("/projects/:enc/archive", async (c) => {
    await ensureLoaded();
    const canonical = decodePath(c.req.param("enc"));
    if (!findProject(canonical)) return c.json({ error: "not found" }, 404);
    deps.store.archive(canonical, Date.now());
    await refresh();
    return c.json({ project: findProject(canonical) });
  });

  api.delete("/projects/:enc/archive", async (c) => {
    const canonical = decodePath(c.req.param("enc"));
    deps.store.unarchive(canonical);
    await refresh();
    return c.json({ project: findProject(canonical) });
  });

  api.get("/activity", async (c) => {
    await ensureLoaded();
    // Archived projects are hidden from the timeline too (R3 decision ④).
    const live = state.projects.filter((p) => !p.archivedAtMs);
    return c.json({ items: buildActivityFeed(live), generatedAtMs: state.generatedAtMs });
  });

  app.route("/api", api);

  if (deps.uiDir && fs.existsSync(deps.uiDir)) {
    app.get("/*", uiHandler(deps.uiDir));
  }

  // Surface the cause of a thrown error (e.g. a failing collect()) as JSON
  // instead of Hono's default empty 500, so the UI can show what went wrong.
  // Safe to expose internals: the server binds 127.0.0.1 for a single local user.
  app.onError((err, c) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[dashboard] request failed:", err);
    return c.json({ error: "internal_error", message }, 500);
  });

  return app;
}

export type { DashboardConfig };
export { resolveConfig };
