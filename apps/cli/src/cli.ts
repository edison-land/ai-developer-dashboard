#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { createServerDeps, resolveConfig, startServer } from "@ai-dashboard/server";

const USAGE = `AI Developer Dashboard — local project kanban for Claude Code / Codex / git.

Usage:
  ai-dashboard [options]

Options:
  --port <n>         Port to serve on (default 7777)
  --data-dir <path>  Override the data directory (default ~/.ai-dashboard)
  --no-browser       Do not open a browser on start
  -h, --help         Show this help
`;

function openBrowser(url: string): void {
  try {
    if (process.platform === "win32") {
      spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref();
    } else if (process.platform === "darwin") {
      spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
    } else {
      spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
    }
  } catch {
    // ignore — the URL is printed so the user can open it manually
  }
}

async function main(): Promise<void> {
  // Drop a literal "--" (pnpm/npm may forward it) so option parsing isn't derailed.
  const argv = process.argv.slice(2).filter((a) => a !== "--");
  const { values } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      port: { type: "string", default: "7777" },
      "data-dir": { type: "string" },
      "no-browser": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  if (values.help) {
    process.stdout.write(USAGE);
    return;
  }

  const port = Number(values.port) || 7777;
  const config = resolveConfig({ dataDir: values["data-dir"] });

  // ui/dist lives three levels up from apps/cli/src/cli.ts (the repo root).
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, "..", "..", "..");
  const uiDir = path.join(repoRoot, "packages", "ui", "dist");

  const deps = createServerDeps({ config, uiDir });
  const server = startServer(deps, { port });
  const url = `http://127.0.0.1:${port}`;

  process.stdout.write(`\n  AI Developer Dashboard → ${url}\n  Data dir: ${config.dataDir}\n\n`);

  if (!values["no-browser"]) openBrowser(url);

  const shutdown = (): never => {
    server.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
