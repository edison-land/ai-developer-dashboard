import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { app, BrowserWindow, dialog, Menu, shell } from "electron";
import { createServerDeps, resolveConfig, startServerReady } from "@ai-dashboard/server";
import { prepareDataDirectory } from "./dataMigration.js";
import {
  createDesktopController,
  DesktopStartupCancelledError,
  type DesktopRuntime,
  type DesktopWindow,
  type ManagedBackend,
} from "./lifecycle.js";
import {
  checkMacOSFullDiskAccess,
  FULL_DISK_ACCESS_SETTINGS_URL,
} from "./macosPermissions.js";

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
  if (process.platform === "darwin") {
    const permission = checkMacOSFullDiskAccess();
    debug(`Full Disk Access probe: ${permission.status} (${permission.probePath})`);
    if (permission.status !== "granted") {
      const choice = dialog.showMessageBoxSync({
        type: "warning",
        title: "需要完全磁盘访问权限",
        message: "AI Developer Dashboard 需要读取本机项目和 Git 状态。",
        detail:
          "请在“系统设置 → 隐私与安全性 → 完全磁盘访问权限”中找到 AI Developer Dashboard 并打开权限，然后点击“退出”并重新启动应用。",
        buttons: ["打开系统设置", "退出"],
        defaultId: 0,
        cancelId: 1,
      });
      if (choice === 0) await shell.openExternal(FULL_DISK_ACCESS_SETTINGS_URL);
      throw new DesktopStartupCancelledError("未授予完全磁盘访问权限");
    }
  }

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
  const deps = createServerDeps({ config, uiDir: uiDirectory(), version: app.getVersion() });
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
  onActivate: (listener) => app.on("activate", listener),
  shouldQuitOnAllWindowsClosed: () => process.platform !== "darwin",
  whenReady: async () => {
    await app.whenReady();
    debug("electron ready");
  },
  createWindow: async (url) => {
    debug(`creating window for ${url}`);
    if (process.platform !== "darwin") Menu.setApplicationMenu(null);
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
