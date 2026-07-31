import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ActivityView } from "./ActivityView";
import { jsonResponse, project } from "../test/fixtures";

describe("ActivityView filters", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("filters by source/project/time and persists the selection", async () => {
    const requests: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      requests.push(url);
      if (url.startsWith("/api/projects")) {
        return jsonResponse({ projects: [project("Alpha"), project("Beta")] });
      }
      return jsonResponse({
        items: [
          { source: "codex", canonicalPath: "D:/Projects/Alpha", project: "Alpha", atMs: Date.now(), text: "codex work" },
          { source: "git", canonicalPath: "D:/Projects/Beta", project: "Beta", atMs: Date.now(), text: "git work" },
        ],
        generatedAtMs: Date.now(),
      });
    }));

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <ActivityView />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(screen.getByText("codex work")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Codex" }));
    fireEvent.change(screen.getByRole("combobox", { name: "项目" }), { target: { value: "D:/Projects/Alpha" } });
    fireEvent.click(screen.getByRole("button", { name: "最近 7 天" }));

    await waitFor(() => expect(requests.some((url) => url.includes("sources=codex") && url.includes("project=D%3A%2FProjects%2FAlpha") && url.includes("range=7d"))).toBe(true));
    expect(JSON.parse(window.localStorage.getItem("ai-dashboard:activity-filter") ?? "{}")).toMatchObject({
      sources: ["codex"],
      project: "D:/Projects/Alpha",
      range: "7d",
    });
    expect(screen.getByText("codex work")).toBeInTheDocument();
    expect(screen.queryByText("git work")).not.toBeInTheDocument();
  });
});
