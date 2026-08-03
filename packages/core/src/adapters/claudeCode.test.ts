import fs from "node:fs";
import os from "node:os";
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
const hasCurrentRepository = (() => {
  if (!hasClaude) return false;
  try {
    const parsed = JSON.parse(fs.readFileSync(cfg.claudeJson, "utf8")) as {
      projects?: Record<string, unknown>;
    };
    return Object.keys(parsed.projects ?? {}).some((project) => pathKey(project) === repositoryPath);
  } catch {
    return false;
  }
})();
const itCurrentRepository = hasCurrentRepository ? it : it.skip;

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

  itCurrentRepository("includes the current dashboard project when Claude has recorded it", async () => {
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

/** Build an adapter pointed at a temp .claude dir + .claude.json fixture. */
function fixtureAdapter(setup: (root: string) => void): { adapter: ClaudeCodeAdapter; root: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "addb-cc-"));
  setup(root);
  const adapter = new ClaudeCodeAdapter({
    ...resolveConfig(),
    claudeDir: root,
    claudeJson: path.join(root, ".claude.json"),
  });
  return { adapter, root };
}

function writeJsonl(file: string, rows: object[]): void {
  fs.writeFileSync(file, rows.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf8");
}

describe("ClaudeCodeAdapter history.jsonl fallback", () => {
  // Current Claude Code rarely writes lastSessionFirstPrompt/lastSessionModified
  // into ~/.claude.json; activity must come from ~/.claude/history.jsonl instead.
  it("fills lastActiveMs and one-liner from history when .claude.json lacks session fields", async () => {
    const { adapter } = fixtureAdapter((root) => {
      fs.writeFileSync(
        path.join(root, ".claude.json"),
        JSON.stringify({ projects: { "/Users/friend/proj-a": { lastSessionId: "s1" } } }),
      );
      writeJsonl(path.join(root, "history.jsonl"), [
        { display: "older prompt", timestamp: 1_750_000_000_000, project: "/Users/friend/proj-a", sessionId: "s0" },
        { display: "newest prompt\nwith a second line", timestamp: 1_750_000_100_000, project: "/Users/friend/proj-a", sessionId: "s1" },
        { display: "unrelated", timestamp: 1_750_000_200_000, project: "/Users/friend/other", sessionId: "s2" },
      ]);
    });

    const signals = await adapter.collect({});
    const sig = signals.find((s) => s.canonicalPath === "/Users/friend/proj-a");
    expect(sig).toBeDefined();
    expect(sig!.lastActiveMs).toBe(1_750_000_100_000);
    expect(sig!.lastActionOneLiner).toBe("newest prompt with a second line");
  });

  it("prefers .claude.json session fields over history when both exist", async () => {
    const { adapter } = fixtureAdapter((root) => {
      fs.writeFileSync(
        path.join(root, ".claude.json"),
        JSON.stringify({
          projects: {
            "D:/Foo": {
              lastSessionFirstPrompt: "first prompt from session",
              lastSessionModified: 1_750_000_300_000,
            },
          },
        }),
      );
      writeJsonl(path.join(root, "history.jsonl"), [
        { display: "history text", timestamp: 1_750_000_100_000, project: "D:\\Foo" },
      ]);
    });

    const [sig] = await adapter.collect({});
    expect(sig!.lastActionOneLiner).toBe("first prompt from session");
    // lastActiveMs still takes the max across .claude.json and history.
    expect(sig!.lastActiveMs).toBe(1_750_000_300_000);
  });

  it("matches history rows to projects across slash styles and case", async () => {
    const { adapter } = fixtureAdapter((root) => {
      fs.writeFileSync(
        path.join(root, ".claude.json"),
        JSON.stringify({ projects: { "D:\\PolyU\\Foo": {} } }),
      );
      writeJsonl(path.join(root, "history.jsonl"), [
        { display: "mixed style", timestamp: 1_750_000_100_000, project: "d:/polyu/foo" },
      ]);
    });

    const [sig] = await adapter.collect({});
    expect(sig!.lastActiveMs).toBe(1_750_000_100_000);
    expect(sig!.lastActionOneLiner).toBe("mixed style");
  });

  it("skips malformed history lines and missing files without failing", async () => {
    const { adapter } = fixtureAdapter((root) => {
      fs.writeFileSync(
        path.join(root, ".claude.json"),
        JSON.stringify({ projects: { "D:/Bar": {} } }),
      );
      fs.writeFileSync(
        path.join(root, "history.jsonl"),
        [
          "not json at all",
          JSON.stringify({ display: "no project field", timestamp: 1_750_000_100_000 }),
          JSON.stringify({ project: "D:/Bar", timestamp: "not-a-date" }),
          JSON.stringify({ display: "good row", timestamp: 1_750_000_100_000, project: "D:/Bar" }),
        ].join("\n"),
      );
    });

    const [sig] = await adapter.collect({});
    expect(sig!.lastActiveMs).toBe(1_750_000_100_000);
    expect(sig!.lastActionOneLiner).toBe("good row");
  });

  it("works when history.jsonl does not exist", async () => {
    const { adapter } = fixtureAdapter((root) => {
      fs.writeFileSync(
        path.join(root, ".claude.json"),
        JSON.stringify({ projects: { "D:/Solo": {} } }),
      );
    });

    const [sig] = await adapter.collect({});
    expect(sig).toBeDefined();
    expect(sig!.lastActiveMs).toBeUndefined();
    expect(sig!.lastActionOneLiner).toBeUndefined();
  });
});
