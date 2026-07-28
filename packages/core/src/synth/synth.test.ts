import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { computeInputHash } from "../aggregate.js";
import type { ProviderId, SynthProvider, TailReader, UnifiedProject } from "../domain.js";
import { SqliteStore } from "../store.js";
import { buildSynthBundle, SYNTH_SYSTEM_PROMPT } from "./bundle.js";
import { parseSynthJson, SynthSchema } from "./schema.js";
import { synthesize } from "./synth.js";

let dbPath: string;
beforeEach(() => {
  dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "addb-synth-")), "t.db");
});

function makeProject(o: Partial<UnifiedProject> = {}): UnifiedProject {
  return {
    canonicalPath: "D:/Foo",
    displayPath: "D:\\Foo",
    name: "Foo",
    sources: ["claude-code"],
    lastActiveMs: 1.7e12,
    recencyBucket: "today",
    liveStatus: "none",
    lastActionOneLiner: "fix the login bug",
    git: {
      branch: "main",
      headSha: "abc123",
      headCommit: { subject: "initial commit", author: "a", dateMs: 1 },
      dirtyFileCount: 0,
      aheadBehind: { ahead: 0, behind: 0, hasUpstream: true },
    },
    synthStale: false,
    signalsBySource: {},
    ...o,
  };
}

function mockProvider(opts: { json?: unknown; reject?: Error; id?: ProviderId } = {}): SynthProvider & {
  run: ReturnType<typeof vi.fn>;
} {
  const run = vi.fn(async () => {
    if (opts.reject) throw opts.reject;
    return {
      json: opts.json ?? { stage: "building", summary: "正在修复登录", nextStep: "补一个回归测试", blockers: [] },
      usage: { input: 120, output: 30 },
      model: "glm-4.7-flash",
    };
  });
  return { id: (opts.id ?? "zhipu") as ProviderId, run };
}

const stubTail: TailReader = {
  readTail: () => [
    { role: "user", text: "帮我把登录按钮修好" },
    { role: "assistant", text: "好的，我看一下 auth.ts" },
  ],
};

describe("schema", () => {
  it("accepts a valid object and a valid JSON string", () => {
    expect(parseSynthJson({ stage: "building", summary: "s", nextStep: "n", blockers: [] }).ok).toBe(true);
    expect(parseSynthJson('{"stage":"idea","summary":"s","nextStep":"n"}').ok).toBe(true);
  });

  it("defaults blockers to [] when omitted", () => {
    const r = parseSynthJson({ stage: "done", summary: "s", nextStep: "n" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.blockers).toEqual([]);
      expect(r.value.attention).toBe("unknown");
    }
  });

  it("accepts the attention classification used by focus recommendations", () => {
    const r = parseSynthJson({
      stage: "stalled",
      summary: "等待接口恢复",
      nextStep: "限额恢复后重试",
      blockers: ["接口限额"],
      attention: "waiting",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.attention).toBe("waiting");
  });

  it("rejects a bad stage, a missing field, and garbage", () => {
    expect(parseSynthJson({ stage: "nope", summary: "s", nextStep: "n" }).ok).toBe(false);
    expect(parseSynthJson({ stage: "building", nextStep: "n" }).ok).toBe(false); // missing summary
    expect(parseSynthJson("not json{").ok).toBe(false);
  });

  it("recovers JSON from markdown fences and surrounding prose", () => {
    const fenced = '```json\n{"stage":"idea","summary":"s","nextStep":"n"}\n```';
    const prose = `好的，分析如下：\n{"stage":"building","summary":"s","nextStep":"n","blockers":[]}\n以上。`;
    expect(parseSynthJson(fenced).ok).toBe(true);
    expect(parseSynthJson(prose).ok).toBe(true);
  });

  it("the schema infers the stage literal union", () => {
    const v = SynthSchema.parse({ stage: "verifying", summary: "s", nextStep: "n", blockers: ["x"] });
    // compile-time: v.stage is Stage; runtime check:
    expect(v.stage).toBe("verifying");
  });
});

describe("buildSynthBundle", () => {
  it("includes one-liner, transcript tail, and git in a bounded prompt", () => {
    const p = makeProject({
      signalsBySource: {
        "claude-code": {
          source: "claude-code",
          canonicalPath: "D:/Foo",
          lastActionOneLiner: "fix the login bug",
          transcriptTailPath: "C:/fake/tail.jsonl",
        },
      },
    });
    const b = buildSynthBundle(p, stubTail);
    expect(b.systemPrompt).toBe(SYNTH_SYSTEM_PROMPT);
    expect(b.systemPrompt).toContain("user-action");
    expect(b.systemPrompt).toContain("waiting");
    expect(b.userPrompt).toContain("fix the login bug");
    expect(b.userPrompt).toContain("用户：帮我把登录按钮修好");
    expect(b.userPrompt).toContain("分支 main");
  });

  it("hard-truncates pathological inputs so the bundle stays small", () => {
    const huge = "x".repeat(5000);
    const fatTail: TailReader = { readTail: () => [{ role: "user", text: "y".repeat(5000) }] };
    const p = makeProject({
      lastActionOneLiner: huge,
      git: {
        branch: "main",
        headSha: "abc",
        headCommit: { subject: "s".repeat(500), author: "a", dateMs: 1 },
        dirtyFileCount: 999,
        dirtySample: Array.from({ length: 30 }, (_, i) => `file${i}.ts`),
        aheadBehind: { ahead: 5, behind: 3, hasUpstream: true },
      },
    });
    const b = buildSynthBundle(p, fatTail);
    // oneLiner capped at 300(+…), each tail record at 600, commit subject at 80.
    expect(b.userPrompt.length).toBeLessThan(2000);
    expect(b.userPrompt).not.toContain("x".repeat(301));
  });

  it("works without a transcript and without git", () => {
    const b1 = buildSynthBundle(makeProject({ signalsBySource: {} }), stubTail);
    expect(b1.userPrompt).toContain("Foo");
    expect(b1.userPrompt).not.toContain("用户："); // no tail
    const b2 = buildSynthBundle(makeProject({ git: { branch: "main", headSha: null, headCommit: null, dirtyFileCount: 0, aheadBehind: { ahead: 0, behind: 0, hasUpstream: false }, gitError: "not a repo" } }), stubTail);
    expect(b2.userPrompt).not.toContain("分支"); // git line omitted on error
  });
});

describe("synthesize", () => {
  it("skips the provider entirely on an input-hash cache hit", async () => {
    const store = new SqliteStore(dbPath);
    const p = makeProject();
    const hash = computeInputHash({ lastActiveMs: p.lastActiveMs, git: p.git ?? null, lastActionOneLiner: p.lastActionOneLiner });
    store.setSynth(p.canonicalPath, {
      stage: "building", summary: "cached", nextStep: "cached-next", blockers: [],
      model: "glm-4.7-flash", provider: "zhipu", generatedAtMs: 1, inputHash: hash,
    });
    const provider = mockProvider(); // run throws if called? no — but we assert not-called
    const out = await synthesize(p, { provider, tailReader: stubTail, store, model: "glm-4.7-flash" });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.fromCache).toBe(true);
      expect(out.result.summary).toBe("cached");
    }
    expect(provider.run).not.toHaveBeenCalled();
  });

  it("calls the provider on a miss, validates, persists, and returns fresh", async () => {
    const store = new SqliteStore(dbPath);
    const p = makeProject();
    const provider = mockProvider();
    const out = await synthesize(p, { provider, tailReader: stubTail, store, model: "glm-4.7-flash" });
    expect(provider.run).toHaveBeenCalledTimes(1);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.fromCache).toBe(false);
      expect(out.result.stage).toBe("building");
      expect(out.result.provider).toBe("zhipu");
      expect(out.result.inputHash).toBeTruthy();
      // persisted — a second call hits cache without calling the provider again
      const provider2 = mockProvider();
      const out2 = await synthesize(p, { provider: provider2, tailReader: stubTail, store, model: "glm-4.7-flash" });
      expect(out2.ok).toBe(true);
      if (out2.ok) expect(out2.fromCache).toBe(true);
      expect(provider2.run).not.toHaveBeenCalled();
    }
  });

  it("returns an error (no cached) when the provider throws", async () => {
    const store = new SqliteStore(dbPath);
    const out = await synthesize(makeProject(), {
      provider: mockProvider({ reject: new Error("rate limited") }),
      tailReader: stubTail,
      store,
      model: "glm-4.7-flash",
    });
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.error).toContain("模型调用失败");
      expect(out.cached).toBeUndefined();
    }
  });

  it("returns an error when the model emits invalid JSON", async () => {
    const store = new SqliteStore(dbPath);
    const out = await synthesize(makeProject(), {
      provider: mockProvider({ json: { stage: "nope" } }),
      tailReader: stubTail,
      store,
      model: "glm-4.7-flash",
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toContain("解析失败");
  });
});
