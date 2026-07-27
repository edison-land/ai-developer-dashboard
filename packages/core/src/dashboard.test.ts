import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { resolveConfig } from "./config.js";
import { Dashboard } from "./dashboard.js";

const cfg = resolveConfig();
const hasClaude = fs.existsSync(cfg.claudeJson);
const hasCodex = fs.existsSync(cfg.codexDb);
const itReal = hasClaude ? it : it.skip;
const itRealCodex = hasClaude && hasCodex ? it : it.skip;

describe("Dashboard.collect (integration)", () => {
  itReal("returns unified projects sorted by recency bucket, with git attached", async () => {
    const projects = await new Dashboard(cfg).collect({
      overrides: new Map(),
      synthCache: new Map(),
      nowMs: 1.7e12,
    });
    expect(projects.length).toBeGreaterThan(0);

    // Output is sorted by bucket order (active-now < today < stale).
    const ranks = { "active-now": 0, today: 1, stale: 2 } as const;
    const order = projects.map((p) => ranks[p.recencyBucket]);
    for (let i = 1; i < order.length; i++) {
      expect(order[i]!).toBeGreaterThanOrEqual(order[i - 1]!);
    }

    // This dashboard project is present.
    expect(projects.some((p) => p.canonicalPath.toLowerCase() === "d:/ai-developer-dashboard")).toBe(true);

    // Git is attached to at least some projects (as a snapshot or an error, never thrown).
    expect(projects.some((p) => p.git !== undefined)).toBe(true);
  });

  itRealCodex("surfaces Codex as a source on merged cards", async () => {
    const projects = await new Dashboard(cfg).collect({
      overrides: new Map(),
      synthCache: new Map(),
      nowMs: 1.7e12,
    });
    const withCodex = projects.filter((p) => p.sources.includes("codex"));
    expect(withCodex.length).toBeGreaterThan(0);
    // If the user runs the same project in both tools, the three-source merge
    // should fuse them into one card. Depends on real overlap, so only logged.
    const fused = projects.filter(
      (p) => p.sources.includes("claude-code") && p.sources.includes("codex"),
    );
    if (fused.length === 0) {
      console.log("[dashboard.test] no CC+Codex overlap project on this machine");
    }
  });
});
