import { serve } from "@hono/node-server";
import {
  type DashboardConfig,
  Dashboard,
  resolveConfig,
  SqliteStore,
  type SynthOutcome,
  type SynthProvider,
  type UnifiedProject,
  providerPreset,
  synthesize as synthesizeProject,
} from "@ai-dashboard/core/node";
import { createApp, type ServerDeps } from "./app.js";
import { NodeTailReader } from "./synth/tailReader.js";
import { OpenAICompatibleProvider } from "./synth/openaiCompatible.js";
import { ZhipuProvider } from "./synth/zhipu.js";

export { createApp };
export type { ServerDeps };
export { NodeTailReader, OpenAICompatibleProvider, ZhipuProvider };

/**
 * Build the server's dependencies: opens our sqlite store, creates the
 * Dashboard orchestrator, and wires a `collect` closure that merges live
 * overrides + synth cache. The `synthesize` closure reads the current provider
 * + key + model from settings at call time, so a key pasted in Settings takes
 * effect immediately without a restart. This is the single place that knows how
 * the pieces fit together — the Electron shell (Phase 6) will reuse it directly.
 */
export function createServerDeps(opts: { config: DashboardConfig; uiDir?: string }): ServerDeps {
  const store = new SqliteStore(opts.config.dbPath);
  const dashboard = new Dashboard(opts.config);
  const tailReader = new NodeTailReader();
  const collect = async () =>
    dashboard.collect({
      overrides: store.allOverrides(),
      synthCache: store.allSynth(),
    });
  const synthesize = async (project: UnifiedProject): Promise<SynthOutcome> => {
    const settings = store.getSettings();
    const apiKey = store.getApiKey(settings.provider);
    if (!apiKey) {
      return { ok: false, error: `尚未设置 ${settings.provider} 的 API Key（请在「设置」页填写）` };
    }
    const preset = providerPreset(settings.provider);
    if (!preset || preset.protocol !== "openai-chat-completions") {
      return {
        ok: false,
        error: `${settings.provider} 使用不同的 API 协议，当前仅支持 OpenAI 兼容 Chat Completions 接口`,
      };
    }
    const requestUrl = settings.requestUrl || preset.requestUrl;
    if (!requestUrl) {
      return { ok: false, error: "请先在设置中填写 OpenAI 兼容接口请求地址" };
    }
    const provider: SynthProvider =
      settings.provider === "zhipu" && requestUrl === preset.requestUrl
        ? new ZhipuProvider({ apiKey, defaultModel: settings.model })
        : new OpenAICompatibleProvider({
            id: settings.provider,
            apiKey,
            requestUrl,
            defaultModel: settings.model,
          });
    return synthesizeProject(project, {
      provider,
      tailReader,
      store,
      model: settings.model,
    });
  };
  return { config: opts.config, store, collect, synthesize, uiDir: opts.uiDir };
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
  // Warm the mechanical project cache without triggering optional AI synthesis.
  void fetch(`http://${hostname}:${opts.port}/api/projects`).catch(() => {});
  return server;
}

export { resolveConfig };
export type { DashboardConfig };
