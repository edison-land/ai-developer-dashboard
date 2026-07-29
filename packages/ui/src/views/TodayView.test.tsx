import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TodayView } from "./TodayView";
import { jsonResponse, project } from "../test/fixtures";

function renderToday(projects: ReturnType<typeof project>[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TodayView projects={projects} loading={false} onOpenProject={vi.fn()} onViewProjects={vi.fn()} />
    </QueryClientProvider>,
  );
}

describe("TodayView focus workflow", () => {
  let requests: { url: string; body?: string }[];

  beforeEach(() => {
    window.localStorage.clear();
    requests = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      requests.push({ url, body: init?.body?.toString() });
      if (url.includes("/api/focus-preferences") && init?.method === "PUT") {
        return jsonResponse(JSON.parse(String(init.body)));
      }
      if (url.includes("/api/focus-preferences")) {
        const localDate = new URL(url, "http://dashboard.test").searchParams.get("localDate") ?? "2026-07-29";
        return jsonResponse({ pinnedPaths: [], dismissedPaths: [], localDate });
      }
      return jsonResponse({ projects: [] });
    }));
  });

  afterEach(() => vi.unstubAllGlobals());

  it("shows automatic focus, supports pinning and same-day dismissal, and excludes archived projects", async () => {
    renderToday([
      project("Alpha", { sources: ["claude-code"], liveStatus: "busy" }),
      project("Beta", { sources: ["codex"] }),
      project("Gamma", { sources: ["git"] }),
      project("Archived", { archivedAtMs: Date.now() }),
    ]);

    expect(await screen.findByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.getByText("Gamma")).toBeInTheDocument();
    expect(screen.queryByText("Archived")).not.toBeInTheDocument();

    await waitFor(() => expect(screen.getByRole("button", { name: "调整重点" })).not.toBeDisabled());
    fireEvent.click(screen.getByRole("button", { name: "调整重点" }));
    fireEvent.click(screen.getAllByRole("button", { name: "置顶" })[0]!);
    await waitFor(() => expect(requests.some((r) => r.url.includes("/api/focus-preferences") && r.body?.includes("Alpha"))).toBe(true));

    fireEvent.click(screen.getAllByRole("button", { name: "今天移除" })[0]!);
    await waitFor(() => {
      const dismissal = [...requests].reverse().find((r) => r.url.includes("/api/focus-preferences") && r.body?.includes("dismissedPaths"));
      expect(dismissal?.body).toContain("Alpha");
    });
  });
});
