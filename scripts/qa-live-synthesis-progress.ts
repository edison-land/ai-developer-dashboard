#!/usr/bin/env tsx
/**
 * Cost-free browser QA fixture for the "synthesize all" live progress flow.
 *
 * Serves the production UI with three in-memory projects on 127.0.0.1:7788.
 * No API key, user database, project transcript, or model provider is touched.
 */
import os from "node:os";
import path from "node:path";
import {
  resolveConfig,
  SqliteStore,
  type SynthOutcome,
  type SynthResult,
  type UnifiedProject,
} from "../packages/core/src/node.ts";
import {
  startServer,
  type ServerDeps,
} from "../packages/server/src/index.ts";

const PORT = 7788;
const config = resolveConfig({
  dataDir: path.join(os.tmpdir(), "addb-live-progress-qa"),
});
const store = new SqliteStore(":memory:");
const uiDir = path.resolve("packages", "ui", "dist");

function makeProject(
  canonicalPath: string,
  name: string,
  lastActiveMs: number,
): UnifiedProject {
  return {
    canonicalPath,
    displayPath: canonicalPath.replace(/\//g, "\\"),
    name,
    sources: ["codex", "git"],
    lastActiveMs,
    recencyBucket: "today",
    liveStatus: "none",
    lastActionOneLiner: `${name} 正在等待批量总结`,
    stage: "building",
    stageSource: "synth",
    synthStale: false,
    signalsBySource: {},
  };
}

let projects = [
  makeProject("D:/QA/Alpha", "Alpha", Date.now()),
  makeProject("D:/QA/Beta", "Beta", Date.now() - 60_000),
  makeProject("D:/QA/Gamma", "Gamma", Date.now() - 120_000),
];

const deps: ServerDeps = {
  config,
  store,
  uiDir,
  collect: async () => projects,
  synthesize: async (project): Promise<SynthOutcome> => {
    await new Promise((resolve) => setTimeout(resolve, 900));
    const result: SynthResult = {
      stage: "building",
      summary: `${project.name} 已完成逐项总结`,
      nextStep: `检查 ${project.name} 的即时卡片更新`,
      blockers: [],
      attention: "none",
      model: "qa-mock",
      provider: "zhipu",
      generatedAtMs: Date.now(),
      inputHash: `qa-${project.name.toLowerCase()}`,
    };
    projects = projects.map((item) =>
      item.canonicalPath === project.canonicalPath
        ? {
            ...item,
            synth: result,
            stage: result.stage,
            stageSource: "synth",
            synthStale: false,
          }
        : item,
    );
    return { ok: true, result, fromCache: false };
  },
};

const server = startServer(deps, { port: PORT });
process.stdout.write(
  `Cost-free live progress QA → http://127.0.0.1:${PORT}\n`,
);

const shutdown = (): never => {
  server.close();
  store.close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
