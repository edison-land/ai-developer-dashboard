import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProjectList } from "./ProjectList";
import { jsonResponse, project } from "../test/fixtures";

describe("project list archive workflow", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("keeps both rows pending when two archive requests overlap", async () => {
    const resolvers: Array<(response: Response) => void> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolvers.push(resolve);
          }),
      ),
    );

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <ProjectList
          projects={[project("Alpha"), project("Beta")]}
          onOpenProject={vi.fn()}
        />
      </QueryClientProvider>,
    );

    const alpha = screen.getByRole("button", { name: "归档 Alpha" });
    const beta = screen.getByRole("button", { name: "归档 Beta" });
    fireEvent.click(alpha);
    await waitFor(() => expect(alpha).toBeDisabled());

    fireEvent.click(beta);
    await waitFor(() => expect(beta).toBeDisabled());
    expect(alpha).toBeDisabled();
    expect(resolvers).toHaveLength(2);

    for (const resolve of resolvers) {
      resolve(jsonResponse({ project: project("Archived") }));
    }
  });
});
