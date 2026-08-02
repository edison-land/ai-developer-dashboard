import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveConfig, SqliteStore, type UnifiedProject } from "@ai-dashboard/core/node";
import { startServerReady, type RunningServer } from "./index.js";

let running: RunningServer | undefined;
let store: SqliteStore | undefined;

afterEach(async () => {
  await running?.close();
  store?.close();
  running = undefined;
  store = undefined;
});

describe("startServerReady", () => {
  it("uses an operating-system-selected loopback port and serves the existing app", async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "addb-server-ready-"));
    const config = resolveConfig({ dataDir });
    store = new SqliteStore(config.dbPath);
    const projects: UnifiedProject[] = [];

    running = await startServerReady(
      {
        config,
        store,
        collect: async () => projects,
        synthesize: async () => ({ ok: false, error: "not used" }),
      },
      { port: 0 },
    );

    expect(running.port).toBeGreaterThan(0);
    expect(running.url).toBe(`http://127.0.0.1:${running.port}`);
    const response = await fetch(`${running.url}/api/health`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, dataRoot: dataDir });
  });
});
