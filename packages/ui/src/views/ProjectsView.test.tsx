import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectsView } from "./ProjectsView";
import { project } from "../test/fixtures";

describe("ProjectsView workflow", () => {
  beforeEach(() => window.localStorage.clear());

  it("searches, combines source filters, switches view, and persists the view choice", () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <ProjectsView
          projects={[
            project("Alpha", { sources: ["claude-code"] }),
            project("Beta", { sources: ["codex"] }),
            project("Gamma", { sources: ["git"] }),
          ]}
          onOpenProject={vi.fn()}
          onOpenArchive={vi.fn()}
        />
      </QueryClientProvider>,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "搜索项目" }), { target: { value: "Alpha" } });
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.queryByText("Beta")).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: "搜索项目" }), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Claude Code" }));
    fireEvent.click(screen.getByRole("button", { name: "Codex" }));
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.queryByText("Gamma")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "列表" }));
    expect(window.localStorage.getItem("ai-dashboard:projects-view-v2")).toBe("list");
    expect(screen.getByRole("button", { name: "打开 Alpha 项目详情" })).toBeInTheDocument();
  });
});
