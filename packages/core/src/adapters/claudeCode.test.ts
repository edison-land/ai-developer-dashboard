import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { resolveConfig } from "../config.js";
import { pathKey } from "../paths.js";
import { ClaudeCodeAdapter } from "./claudeCode.js";

const cfg = resolveConfig();
const hasClaude = fs.existsSync(cfg.claudeJson);
const itReal = hasClaude ? it : it.skip;
const repositoryPath = pathKey(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", ".."),
);

describe("ClaudeCodeAdapter", () => {
  it("reports availability based on ~/.claude.json", () => {
    const a = new ClaudeCodeAdapter(cfg);
    expect(a.available()).toBe(hasClaude);
  });

  itReal("returns at least one project signal with well-formed fields", async () => {
    const a = new ClaudeCodeAdapter(cfg);
    const signals = await a.collect({});
    expect(signals.length).toBeGreaterThan(0);
    for (const s of signals) {
      expect(s.source).toBe("claude-code");
      expect(s.canonicalPath).toMatch(/^(?:[A-Z]:\/|\/)/); // canonical Windows or POSIX absolute path
      if (s.liveStatus !== undefined) expect(["busy", "idle"]).toContain(s.liveStatus);
      if (s.lastActiveMs !== undefined) expect(s.lastActiveMs).toBeGreaterThan(1.6e12); // ~2023+ epoch ms
    }
  });

  itReal("includes the current dashboard project (this repo)", async () => {
    const a = new ClaudeCodeAdapter(cfg);
    const signals = await a.collect({});
    const paths = signals.map((s) => pathKey(s.canonicalPath));
    expect(paths).toContain(repositoryPath);
  });

  itReal("stashes a transcriptTailPath ending in .jsonl when a last session exists", async () => {
    const a = new ClaudeCodeAdapter(cfg);
    const signals = await a.collect({});
    const withTail = signals.find((s) => s.transcriptTailPath);
    expect(withTail).toBeDefined();
    expect(withTail!.transcriptTailPath).toMatch(/\.jsonl$/);
  });
});
