import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ArchiveDrawer } from "./ArchiveDrawer";
import { jsonResponse, project } from "../test/fixtures";

describe("archive workflow", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("includeArchived=true")) {
        return jsonResponse({ projects: [project("Archived", { archivedAtMs: Date.now() })], generatedAtMs: 1 });
      }
      return jsonResponse({ project: project("Archived") });
    }));
  });

  afterEach(() => vi.unstubAllGlobals());

  it("shows archived projects and restores one", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const requests: string[] = [];
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push(`${init?.method ?? "GET"} ${String(input)}`);
      if (String(input).includes("includeArchived=true")) {
        return jsonResponse({ projects: [project("Archived", { archivedAtMs: Date.now() })], generatedAtMs: 1 });
      }
      return jsonResponse({ project: project("Archived") });
    });
    render(<QueryClientProvider client={client}><ArchiveDrawer onClose={vi.fn()} /></QueryClientProvider>);
    expect(await screen.findByText("Archived")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "恢复" }));
    await waitFor(() => expect(requests.some((request) => request.includes("DELETE") && request.includes("/archive"))).toBe(true));
  });
});
