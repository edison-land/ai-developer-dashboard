import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProjectDetailsModal } from "./ProjectDetailsModal";
import { jsonResponse, project } from "../test/fixtures";

function renderModal(onClose = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return { onClose, ...render(<QueryClientProvider client={client}><ProjectDetailsModal project={project("Alpha")} onClose={onClose} /></QueryClientProvider>) };
}

describe("project management workflow", () => {
  it("opens, changes stage, and closes with Escape", async () => {
    const requests: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push(`${init?.method ?? "GET"} ${String(input)}`);
      return jsonResponse({ project: project("Alpha") });
    }));
    const { onClose } = renderModal();

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "done" } });
    await waitFor(() => expect(requests.some((request) => request.includes("PATCH") && request.includes("/stage"))).toBe(true));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("archives from the same public details surface", async () => {
    const requests: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push(`${init?.method ?? "GET"} ${String(input)}`);
      return jsonResponse({ project: project("Alpha") });
    }));
    const { onClose } = renderModal();
    fireEvent.click(screen.getByRole("button", { name: "归档" }));
    await waitFor(() => expect(requests.some((request) => request.includes("POST") && request.includes("/archive"))).toBe(true));
    expect(onClose).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
