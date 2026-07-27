#!/usr/bin/env tsx
/**
 * Phase 3 smoke test — exercises the full synthesis path against the user's
 * REAL Zhipu key + REAL project data.
 *
 * Safety: the API key is read at runtime from the local store
 * (`store.getApiKey("zhipu")`) and passed straight to the provider. It is never
 * printed, logged, or exposed. Claude never touches the plaintext.
 *
 * Run:  pnpm smoke:synth   (after pasting a Zhipu key in the Settings page)
 */
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { Dashboard, resolveConfig, SqliteStore, synthesize } from "@ai-dashboard/core/node";
import { NodeTailReader, ZhipuProvider } from "@ai-dashboard/server";

const MAX_INPUT_TOKENS = 2500;
const PICK = 3;

async function main(): Promise<void> {
  const cfg = resolveConfig();

  // Read the key + model from the REAL store (where the user pasted them).
  const keyStore = new SqliteStore(cfg.dbPath);
  const settings = keyStore.getSettings();
  const apiKey = keyStore.getApiKey("zhipu");
  keyStore.close();
  if (!apiKey) {
    console.error(
      "✗ 未在本地设置中找到 zhipu API key。\n  请在应用「设置」页粘贴智谱 BigModel key，再重跑本脚本。\n  （key 生成：open.bigmodel.cn → API Keys，免费 flash 模型即可）",
    );
    process.exit(1);
  }
  const model = settings.model || "glm-4-flash-250414";
  console.log(`provider: zhipu | model: ${model} | projects root: ${cfg.dataDir}`);

  // Collect real projects.
  const projects = await new Dashboard(cfg).collect({ overrides: new Map(), synthCache: new Map() });
  if (projects.length === 0) {
    console.error("✗ 没有收集到任何项目（CC / Codex 数据源是否可用？）");
    process.exit(1);
  }
  // Prefer projects with a Claude Code transcript tail (richest synthesis signal).
  const ranked = [
    ...projects.filter((p) => p.signalsBySource["claude-code"]?.transcriptTailPath),
    ...projects,
  ];
  const picks = ranked.slice(0, PICK);
  console.log(`\npicked ${picks.length} of ${projects.length} projects:`);
  for (const p of picks) console.log("  -", p.canonicalPath);

  // Synthesize into a TEMP store so the real dashboard cache isn't polluted.
  const tempDb = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "addb-smoke-")), "smoke.db");
  const store = new SqliteStore(tempDb);
  const tailReader = new NodeTailReader();
  const provider = new ZhipuProvider({ apiKey, defaultModel: model });

  let totalIn = 0;
  let totalOut = 0;
  let failures = 0;

  console.log("\n--- synthesizing ---");
  for (const p of picks) {
    const r1 = await synthesize(p, { provider, tailReader, store, model });
    if (!r1.ok) {
      console.error(`  ✗ ${p.name}: ${r1.error}`);
      failures++;
      continue;
    }
    const inTok = r1.result.tokenUsage?.input ?? 0;
    const outTok = r1.result.tokenUsage?.output ?? 0;
    totalIn += inTok;
    totalOut += outTok;
    console.log(
      `  ✓ ${p.name} | stage=${r1.result.stage} | in=${inTok} out=${outTok}${r1.fromCache ? " (cached)" : ""}`,
    );
    console.log(`     summary: ${r1.result.summary}`);
    console.log(`     nextStep: ${r1.result.nextStep}`);
    if (inTok > MAX_INPUT_TOKENS) {
      console.warn(`  ⚠ input ${inTok} 超过 ${MAX_INPUT_TOKENS} token（bundle 过大？）`);
    }

    // Second call must hit the input-hash cache (provider NOT called again).
    const r2 = await synthesize(p, { provider, tailReader, store, model });
    if (!r2.ok || !r2.fromCache) {
      console.error(`  ✗ ${p.name}: 第二次调用未命中缓存`);
      failures++;
    }
  }

  store.close();
  console.log(`\n--- totals ---`);
  console.log(`input=${totalIn} output=${totalOut} tokens | failures=${failures}`);
  console.log(`成本估算：glm-4.7-flash 为免费模型 → ≈ ¥0（付费模型按官网单价 × token 估算）`);
  console.log(failures === 0 ? "\n✓ 冒烟通过" : `\n✗ ${failures} 项失败`);
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
