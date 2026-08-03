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
  filterActivityFeed,
  pathKey,
  providerPreset,
  resolveConfig,
  STAGE,
  type ActivityTimeRange,
  type SourceId,
  withArchived,
} from "@ai-dashboard/core/node";
import { decodePath } from "./pathParam.js";
import { listModels as defaultListModels } from "./models.js";

export interface ServerDeps {
  config: DashboardConfig;
  store: Store;
  /** Recompute the unified project list (adapters + git + merge). */
  collect: () => Promise<UnifiedProject[]>;
  /** On-demand AI synthesis for one project (cache-aware; never throws). */
  synthesize: (project: UnifiedProject) => Promise<SynthOutcome>;
  /** Optional absolute path to the built UI; if absent, the API still works. */
  uiDir?: string;
  /** Product version shown in the UI header (desktop: app.getVersion()). */
  version?: string;
  /** List available models from an OpenAI-compatible endpoint (settings page). */
  listModels?: (requestUrl: string, apiKey: string) => Promise<string[]>;
}

export interface RefreshSynthesisSummary {
  enabled: boolean;
  total: number;
  fresh: number;
  cached: number;
  failed: number;
  errors: string[];
}

interface RefreshResult {
  projects: UnifiedProject[];
  generatedAtMs: number;
  synthesis?: RefreshSynthesisSummary;
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

function isLocalDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return false;
  const parsed = new Date(year, month - 1, day);
  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  );
}

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
  let refreshPromise: Promise<RefreshResult> | null = null;
  let refreshIncludesSynthesis = false;

  const applySynthesis = (
    projects: UnifiedProject[],
    target: UnifiedProject,
    outcome: SynthOutcome,
  ): UnifiedProject[] => {
    if (!outcome.ok) return projects;
    return projects.map((project) =>
      pathKey(project.canonicalPath) === pathKey(target.canonicalPath)
        ? {
            ...project,
            synth: outcome.result,
            synthStale: false,
            ...(project.stageSource === "override"
              ? {}
              : { stage: outcome.result.stage, stageSource: "synth" as const }),
          }
        : project,
    );
  };

  const performRefresh = async (includeSynthesis: boolean): Promise<RefreshResult> => {
    let projects = withArchived(await deps.collect(), deps.store.allArchived());
    const shouldSynthesize = includeSynthesis && deps.store.getSettings().synthOnRefresh;
    const synthesis: RefreshSynthesisSummary | undefined = shouldSynthesize
      ? { enabled: true, total: 0, fresh: 0, cached: 0, failed: 0, errors: [] }
      : undefined;

    if (synthesis) {
      const targets = projects.filter((project) => !project.archivedAtMs);
      synthesis.total = targets.length;
      for (const target of targets) {
        let outcome: SynthOutcome;
        try {
          outcome = await deps.synthesize(target);
        } catch (error) {
          outcome = {
            ok: false,
            error: `模型调用失败：${error instanceof Error ? error.message : String(error)}`,
          };
        }
        if (!outcome.ok) {
          synthesis.failed++;
          synthesis.errors.push(`${target.name}: ${outcome.error}`);
          continue;
        }
        if (outcome.fromCache) synthesis.cached++;
        else synthesis.fresh++;
        projects = applySynthesis(projects, target, outcome);
      }
    }

    const generatedAtMs = Date.now();
    state = { projects, generatedAtMs };
    return {
      projects,
      generatedAtMs,
      ...(synthesis ? { synthesis } : {}),
    };
  };

  const refresh = async (includeSynthesis = false): Promise<RefreshResult> => {
    if (refreshPromise) {
      const inFlight = refreshPromise;
      const inFlightIncludesSynthesis = refreshIncludesSynthesis;
      const result = await inFlight;
      if (includeSynthesis && !inFlightIncludesSynthesis) return refresh(true);
      return result;
    }
    refreshIncludesSynthesis = includeSynthesis;
    const inFlight = performRefresh(includeSynthesis);
    refreshPromise = inFlight;
    try {
      return await inFlight;
    } finally {
      if (refreshPromise === inFlight) {
        refreshPromise = null;
        refreshIncludesSynthesis = false;
      }
    }
  };
  const ensureLoaded = async (): Promise<void> => {
    if (!loadPromise) {
      const inFlight = refresh(false).then(() => undefined);
      loadPromise = inFlight.catch((error) => {
        loadPromise = null;
        throw error;
      });
    }
    await loadPromise;
  };
  const findProject = (canonical: string): UnifiedProject | undefined =>
    state.projects.find((p) => pathKey(p.canonicalPath) === pathKey(canonical));
  const settingsResponse = () => {
    const settings = deps.store.getSettings();
    return { ...settings, apiKey: deps.store.getApiKey(settings.provider) ?? "" };
  };

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
      version: deps.version ?? null,
    }),
  );

  api.get("/projects", async (c) => {
    await ensureLoaded();
    const includeArchived = c.req.query("includeArchived") === "true";
    const projects = includeArchived ? state.projects : state.projects.filter((p) => !p.archivedAtMs);
    return c.json({ projects, generatedAtMs: state.generatedAtMs });
  });

  api.post("/refresh", async (c) => {
    const result = await refresh(true);
    return c.json(result);
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
    await refresh(false);
    return c.json({ project: findProject(canonical) });
  });

  api.delete("/projects/:enc/stage", async (c) => {
    const canonical = decodePath(c.req.param("enc"));
    deps.store.clearStageOverride(canonical);
    await refresh(false);
    return c.json({ project: findProject(canonical) });
  });

  api.post("/projects/:enc/synthesize", async (c) => {
    await ensureLoaded();
    const canonical = decodePath(c.req.param("enc"));
    const project = findProject(canonical);
    if (!project) return c.json({ error: "not found" }, 404);
    const outcome = await deps.synthesize(project);
    await refresh(false);
    return c.json({ project: findProject(canonical), outcome });
  });

  api.post("/synthesize-all", async (c) => {
    await ensureLoaded();
    const targets = state.projects.filter((project) => !project.archivedAtMs);
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        const send = (event: object) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        };
        void (async () => {
          let cached = 0;
          let fresh = 0;
          let failed = 0;
          let completed = 0;

          for (const target of targets) {
            let outcome: SynthOutcome;
            try {
              outcome = await deps.synthesize(target);
            } catch (error) {
              outcome = {
                ok: false,
                error: `模型调用失败：${error instanceof Error ? error.message : String(error)}`,
              };
            }
            let status: "cached" | "fresh" | "failed";
            if (!outcome.ok) {
              failed++;
              status = "failed";
            } else {
              if (outcome.fromCache) {
                cached++;
                status = "cached";
              } else {
                fresh++;
                status = "fresh";
              }
              state = { projects: applySynthesis(state.projects, target, outcome), generatedAtMs: Date.now() };
            }
            completed++;

            send({
              type: "progress",
              canonicalPath: target.canonicalPath,
              completed,
              total: targets.length,
              status,
              cached,
              fresh,
              failed,
              project: findProject(target.canonicalPath),
              ...(!outcome.ok ? { error: outcome.error } : {}),
            });
          }

          await refresh(false);
          send({
            type: "complete",
            total: targets.length,
            cached,
            fresh,
            failed,
            generatedAtMs: state.generatedAtMs,
          });
          controller.close();
        })().catch((error) => {
          controller.error(error);
        });
      },
    });

    return new Response(body, {
      headers: {
        "cache-control": "no-cache, no-transform",
        "content-type": "application/x-ndjson; charset=utf-8",
        "x-content-type-options": "nosniff",
      },
    });
  });

  api.get("/focus-preferences", (c) => {
    const localDate = c.req.query("localDate");
    if (!isLocalDate(localDate)) {
      return c.json({ error: "localDate must be a real YYYY-MM-DD date" }, 400);
    }
    return c.json(deps.store.getFocusPreferences(localDate));
  });

  api.put("/focus-preferences", async (c) => {
    const body = (await c.req.json().catch(() => null)) as
      | {
          pinnedPaths?: unknown;
          dismissedPaths?: unknown;
          localDate?: unknown;
        }
      | null;
    if (
      !body ||
      !isLocalDate(body.localDate) ||
      !Array.isArray(body.pinnedPaths) ||
      !body.pinnedPaths.every((value) => typeof value === "string") ||
      !Array.isArray(body.dismissedPaths) ||
      !body.dismissedPaths.every((value) => typeof value === "string")
    ) {
      return c.json(
        {
          error:
            "body must contain pinnedPaths/dismissedPaths string arrays and a real localDate",
        },
        400,
      );
    }
    if (body.pinnedPaths.length > 3) {
      return c.json({ error: "pinnedPaths supports at most three projects" }, 400);
    }
    const pinned = body.pinnedPaths.map(pathKey);
    const dismissed = body.dismissedPaths.map(pathKey);
    if (new Set(pinned).size !== pinned.length || new Set(dismissed).size !== dismissed.length) {
      return c.json({ error: "focus paths must be unique" }, 400);
    }
    const dismissedSet = new Set(dismissed);
    if (pinned.some((canonicalPath) => dismissedSet.has(canonicalPath))) {
      return c.json({ error: "a project cannot be both pinned and dismissed" }, 400);
    }
    deps.store.setFocusPreferences({
      pinnedPaths: body.pinnedPaths,
      dismissedPaths: body.dismissedPaths,
      localDate: body.localDate,
    });
    return c.json(deps.store.getFocusPreferences(body.localDate));
  });

  api.get("/settings", (c) => c.json(settingsResponse()));

  api.post("/models", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as {
      requestUrl?: unknown;
      apiKey?: unknown;
    };
    const requestUrl = typeof body.requestUrl === "string" ? body.requestUrl.trim() : "";
    const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    if (!requestUrl) {
      return c.json({ error: "请提供请求地址" }, 400);
    }
    const listModels = deps.listModels ?? defaultListModels;
    try {
      const models = await listModels(requestUrl, apiKey);
      return c.json({ models });
    } catch (error) {
      const message = error instanceof Error ? error.message : "拉取模型列表失败";
      return c.json({ error: message }, 502);
    }
  });

  api.put("/settings", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) ?? {};
    if (body.provider !== undefined) {
      const preset = providerPreset(body.provider);
      if (!preset) return c.json({ error: "未知模型提供商预设" }, 400);
      if (preset.protocol !== "openai-chat-completions") {
        return c.json({ error: "Anthropic 使用不同的 Messages 协议，当前仅支持 OpenAI 兼容接口" }, 400);
      }
      if (body.provider !== "zhipu" && !body.requestUrl && !body.apiKey) {
        return c.json({ error: "请填写 OpenAI 兼容接口请求地址和 API Key" }, 400);
      }
    }
    try {
      deps.store.setSettings(body);
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : "设置保存失败" }, 400);
    }
    return c.json(settingsResponse());
  });

  api.post("/projects/:enc/archive", async (c) => {
    await ensureLoaded();
    const canonical = decodePath(c.req.param("enc"));
    if (!findProject(canonical)) return c.json({ error: "not found" }, 404);
    deps.store.archive(canonical, Date.now());
    await refresh(false);
    return c.json({ project: findProject(canonical) });
  });

  api.delete("/projects/:enc/archive", async (c) => {
    const canonical = decodePath(c.req.param("enc"));
    deps.store.unarchive(canonical);
    await refresh(false);
    return c.json({ project: findProject(canonical) });
  });

  api.get("/activity", async (c) => {
    await ensureLoaded();
    // Archived projects are hidden from the timeline too (R3 decision ④).
    const live = state.projects.filter((p) => !p.archivedAtMs);
    const validSources = new Set<SourceId>(["claude-code", "codex", "git"]);
    const sources = (c.req.query("sources") ?? "")
      .split(",")
      .map((source) => source.trim())
      .filter((source): source is SourceId => validSources.has(source as SourceId));
    const rawRange = c.req.query("range");
    const range: ActivityTimeRange =
      rawRange === "today" || rawRange === "7d" ? rawRange : "all";
    const items = filterActivityFeed(
      buildActivityFeed(live),
      { sources, project: c.req.query("project") ?? "", range },
    );
    return c.json({ items, generatedAtMs: state.generatedAtMs });
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
