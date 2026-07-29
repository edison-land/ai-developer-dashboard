import { describe, expect, it } from "vitest";
import { filterProjects } from "./filter";
import { project } from "./test/fixtures";

describe("project search and filters", () => {
  const now = Date.now();
  const projects = [
    project("Alpha", { sources: ["claude-code"], lastActiveMs: now - 2 * 60 * 60 * 1000 }),
    project("Beta", { sources: ["codex"], lastActiveMs: now - 2 * 24 * 60 * 60 * 1000 }),
    project("Gamma", { sources: ["git"], lastActiveMs: now - 40 * 24 * 60 * 60 * 1000 }),
  ];

  it("searches the project name and applies source OR semantics", () => {
    expect(filterProjects(projects, { query: "alpha", sources: [], recency: "all" }, now).map((p) => p.name)).toEqual(["Alpha"]);
    expect(filterProjects(projects, { query: "", sources: ["claude-code", "codex"], recency: "all" }, now).map((p) => p.name)).toEqual(["Alpha", "Beta"]);
  });

  it("applies time presets without changing the project order", () => {
    expect(filterProjects(projects, { query: "", sources: [], recency: "today" }, now).map((p) => p.name)).toEqual(["Alpha"]);
    expect(filterProjects(projects, { query: "", sources: [], recency: "older" }, now).map((p) => p.name)).toEqual(["Gamma"]);
  });
});
