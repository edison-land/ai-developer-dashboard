import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { ThemeProvider } from "./theme";
import { jsonResponse, project } from "./test/fixtures";

describe("batch summary UI workflow", () => {
  let finishBatch: (() => void) | undefined;

  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/refresh")) {
        return jsonResponse({
          projects: [project("Alpha"), project("Beta")],
          generatedAtMs: 3,
          synthesis: {
            enabled: true,
            total: 2,
            fresh: 1,
            cached: 0,
            failed: 1,
            errors: ["Beta: no key"],
          },
        });
      }
      if (url.endsWith("/api/projects")) {
        return jsonResponse({ projects: [project("Alpha"), project("Beta")], generatedAtMs: 1 });
      }
      if (url.includes("/api/settings")) {
        return jsonResponse({
          provider: "zhipu",
          model: "qa-model",
          hasAnthropicKey: false,
          hasOpenAIKey: false,
          hasZhipuKey: false,
          autoRefreshMins: 0,
          synthOnRefresh: false,
        });
      }
      if (url.includes("/api/focus-preferences")) {
        const localDate = new URL(url, "http://dashboard.test").searchParams.get("localDate") ?? "2026-07-29";
        return jsonResponse({ pinnedPaths: [], dismissedPaths: [], localDate });
      }
      if (url.endsWith("/api/activity")) return jsonResponse({ items: [], generatedAtMs: 1 });
      if (url.endsWith("/api/health")) return jsonResponse({ ok: true, projectCount: 2, generatedAtMs: 1 });
      if (url.endsWith("/api/synthesize-all") && init?.method === "POST") {
        const first = {
          type: "progress",
          canonicalPath: "D:/Projects/Alpha",
          completed: 1,
          total: 2,
          status: "fresh",
          cached: 0,
          fresh: 1,
          failed: 0,
          project: { ...project("Alpha"), synth: { stage: "building", summary: "Alpha 已更新", nextStep: "继续检查", blockers: [], attention: "none", model: "qa-model", provider: "zhipu", generatedAtMs: 2, inputHash: "a" } },
        };
        const second = { type: "progress", canonicalPath: "D:/Projects/Beta", completed: 2, total: 2, status: "cached", cached: 1, fresh: 1, failed: 0, project: { ...project("Beta") } };
        const complete = { type: "complete", total: 2, cached: 1, fresh: 1, failed: 0, generatedAtMs: 2 };
        let controller: ReadableStreamDefaultController<Uint8Array>;
        const encoder = new TextEncoder();
        const stream = new ReadableStream<Uint8Array>({
          start(nextController) {
            controller = nextController;
            controller.enqueue(encoder.encode(`${JSON.stringify(first)}\n`));
            finishBatch = () => {
              controller.enqueue(encoder.encode(`${JSON.stringify(second)}\n${JSON.stringify(complete)}\n`));
              controller.close();
            };
          },
        });
        return new Response(stream, { headers: { "content-type": "application/x-ndjson" } });
      }
      return jsonResponse({});
    }));
  });

  afterEach(() => {
    finishBatch = undefined;
    vi.unstubAllGlobals();
  });

  it("shows X/total immediately, updates a project after an event, and keeps final stats", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(<ThemeProvider><QueryClientProvider client={client}><App /></QueryClientProvider></ThemeProvider>);
    await screen.findByText("Alpha");
    fireEvent.click(screen.getByRole("button", { name: "总结全部" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "总结全部，已完成 1/2" })).toBeInTheDocument());
    expect(screen.getByText("Alpha 已更新")).toBeInTheDocument();
    finishBatch?.();
    await waitFor(() => expect(screen.getByText("更新 1 · 缓存 1 · 失败 0")).toBeInTheDocument());
  });

  it("shows refresh synthesis errors in the page", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(<ThemeProvider><QueryClientProvider client={client}><App /></QueryClientProvider></ThemeProvider>);
    await screen.findByText("Alpha");
    fireEvent.click(screen.getByRole("button", { name: "刷新" }));
    expect(await screen.findByText("Beta: no key")).toBeInTheDocument();
  });
});
