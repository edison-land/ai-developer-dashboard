import { serve } from "@hono/node-server";
import {
  type DashboardConfig,
  Dashboard,
  resolveConfig,
  SqliteStore,
} from "@ai-dashboard/core/node";
import { createApp, type ServerDeps } from "./app.js";

export { createApp };
export type { ServerDeps };

/**
 * Build the server's dependencies: opens our sqlite store, creates the
 * Dashboard orchestrator, and wires a `collect` closure that merges live
 * overrides + synth cache. This is the single place that knows how the pieces
 * fit together — the Electron shell (Phase 6) will reuse it directly.
 */
export function createServerDeps(opts: { config: DashboardConfig; uiDir?: string }): ServerDeps {
  const store = new SqliteStore(opts.config.dbPath);
  const dashboard = new Dashboard(opts.config);
  const collect = async () =>
    dashboard.collect({
      overrides: store.allOverrides(),
      synthCache: store.allSynth(),
    });
  return { config: opts.config, store, collect, uiDir: opts.uiDir };
}

export interface StartOptions {
  port: number;
  hostname?: string;
}

/** Listen on the given port and warm the project cache in the background. */
export function startServer(deps: ServerDeps, opts: StartOptions) {
  const app = createApp(deps);
  const hostname = opts.hostname ?? "127.0.0.1";
  const server = serve({ fetch: app.fetch, port: opts.port, hostname });
  // Kick off a background refresh so /health shows a real project count quickly.
  void fetch(`http://${hostname}:${opts.port}/api/refresh`, { method: "POST" }).catch(() => {});
  return server;
}

export { resolveConfig };
export type { DashboardConfig };
