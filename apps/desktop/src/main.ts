import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { app, BrowserWindow, dialog, Menu } from "electron";
import { createServerDeps, resolveConfig, startServerReady } from "@ai-dashboard/server";
import { prepareDataDirectory } from "./dataMigration.js";
import {
  createDesktopController,
  type DesktopRuntime,
  type DesktopWindow,
  type ManagedBackend,
} from "./lifecycle.js";

function debug(message: string): void {
  const logPath = process.env.AI_DASHBOARD_DESKTOP_DEBUG_LOG;
  if (!logPath) return;
  fs.appendFileSync(logPath, `${new Date().toISOString()} ${message}\n`, "utf8");
}

async function waitForRenderedApp(window: BrowserWindow): Promise<void> {
  const rendered = await window.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const deadline = Date.now() + 10000;
      const check = () => {
        const root = document.querySelector("#root");
        if (root && root.childElementCount > 0) return resolve(true);
        if (Date.now() >= deadline) return resolve(false);
        setTimeout(check, 50);
      };
      check();
    })
  `);
  if (rendered !== true) throw new Error("页面未能正常显示");
}

function uiDirectory(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, "ui")
    : path.resolve(app.getAppPath(), "..", "..", "packages", "ui", "dist");
}

async function startManagedBackend(): Promise<ManagedBackend> {
  debug("creating server dependencies");
  const explicitDataDir = process.env.AI_DASHBOARD_DATA_DIR;
  const userDataDir =
    process.env.AI_DASHBOARD_DESKTOP_USER_DATA_DIR?.trim() || app.getPath("userData");
  const legacyDataDir =
    process.env.AI_DASHBOARD_LEGACY_DATA_DIR?.trim() || path.join(os.homedir(), ".ai-dashboard");
  const preparedData = prepareDataDirectory({
    explicitDataDir,
    managedDataDir: path.join(userDataDir, "data"),
    legacyDataDir,
  });
  debug(`data directory ready at ${preparedData.dataDir} (${preparedData.mode})`);
  if (preparedData.backupDir) debug(`data migration backup at ${preparedData.backupDir}`);
  const config = resolveConfig({ dataDir: preparedData.dataDir });
  const deps = createServerDeps({ config, uiDir: uiDirectory() });
  let running;
  try {
    debug("starting local server");
    running = await startServerReady(deps, { port: 0, hostname: "127.0.0.1" });
    debug(`local server ready at ${running.url}`);
  } catch (error) {
    deps.store.close();
    throw error;
  }

  return {
    url: running.url,
    close: async () => {
      try {
        await running.close();
      } finally {
        deps.store.close();
      }
    },
  };
}

function wrapWindow(browserWindow: BrowserWindow): DesktopWindow {
  return {
    isMinimized: () => browserWindow.isMinimized(),
    restore: () => browserWindow.restore(),
    show: () => browserWindow.show(),
    focus: () => browserWindow.focus(),
  };
}

const runtime: DesktopRuntime = {
  requestSingleInstanceLock: () => {
    const acquired = app.requestSingleInstanceLock();
    debug(`single instance lock: ${acquired ? "acquired" : "denied"}`);
    return acquired;
  },
  onSecondInstance: (listener) => app.on("second-instance", listener),
  onAllWindowsClosed: (listener) => app.on("window-all-closed", listener),
  whenReady: async () => {
    await app.whenReady();
    debug("electron ready");
  },
  createWindow: async (url) => {
    debug(`creating window for ${url}`);
    Menu.setApplicationMenu(null);
    const window = new BrowserWindow({
      title: "AI Developer Dashboard",
      width: 1440,
      height: 900,
      minWidth: 960,
      minHeight: 640,
      show: false,
      backgroundColor: "#f5f2eb",
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        spellcheck: false,
      },
    });
    const allowedOrigin = new URL(url).origin;
    window.webContents.on("will-navigate", (event, targetUrl) => {
      if (new URL(targetUrl).origin !== allowedOrigin) event.preventDefault();
    });
    window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    try {
      await window.loadURL(url);
      await waitForRenderedApp(window);
    } catch (error) {
      window.destroy();
      throw error;
    }
    window.show();
    debug("window shown");
    return wrapWindow(window);
  },
  showStartupError: (message) => {
    console.error(message);
    dialog.showErrorBox("启动失败", message);
  },
  reportError: (message) => console.error(message),
  quit: () => app.quit(),
};

const controller = createDesktopController(runtime, startManagedBackend);
debug("desktop main loaded");
void controller.start();
