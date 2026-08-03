import { describe, expect, it, vi } from "vitest";
import {
  createDesktopController,
  DesktopStartupCancelledError,
  type DesktopRuntime,
  type DesktopWindow,
  type ManagedBackend,
} from "./lifecycle.js";

function harness(hasLock = true) {
  let secondInstance: (() => void) | undefined;
  let allWindowsClosed: (() => void) | undefined;
  let activate: (() => void) | undefined;
  const window: DesktopWindow = {
    isMinimized: vi.fn(() => true),
    restore: vi.fn(),
    show: vi.fn(),
    focus: vi.fn(),
  };
  const backend: ManagedBackend = {
    url: "http://127.0.0.1:43123",
    close: vi.fn(async () => undefined),
  };
  const runtime: DesktopRuntime = {
    requestSingleInstanceLock: vi.fn(() => hasLock),
    onSecondInstance: vi.fn((listener) => {
      secondInstance = listener;
    }),
    onAllWindowsClosed: vi.fn((listener) => {
      allWindowsClosed = listener;
    }),
    onActivate: vi.fn((listener) => {
      activate = listener;
    }),
    shouldQuitOnAllWindowsClosed: vi.fn(() => true),
    whenReady: vi.fn(async () => undefined),
    createWindow: vi.fn(async () => window),
    showStartupError: vi.fn(),
    reportError: vi.fn(),
    quit: vi.fn(),
  };
  const startBackend = vi.fn(async () => backend);
  return {
    runtime,
    window,
    backend,
    startBackend,
    secondInstance: () => secondInstance?.(),
    allWindowsClosed: () => allWindowsClosed?.(),
    activate: () => activate?.(),
  };
}

describe("desktop lifecycle", () => {
  it("starts one backend and loads its private URL after Electron is ready", async () => {
    const h = harness();
    const controller = createDesktopController(h.runtime, h.startBackend);

    await controller.start();

    expect(h.runtime.requestSingleInstanceLock).toHaveBeenCalledOnce();
    expect(h.startBackend).toHaveBeenCalledOnce();
    expect(h.runtime.createWindow).toHaveBeenCalledWith("http://127.0.0.1:43123");
  });

  it("quits before starting a backend when another desktop instance owns the lock", async () => {
    const h = harness(false);

    await createDesktopController(h.runtime, h.startBackend).start();

    expect(h.runtime.quit).toHaveBeenCalledOnce();
    expect(h.startBackend).not.toHaveBeenCalled();
    expect(h.runtime.createWindow).not.toHaveBeenCalled();
  });

  it("restores and focuses the existing window on a second launch", async () => {
    const h = harness();
    await createDesktopController(h.runtime, h.startBackend).start();

    h.secondInstance();

    expect(h.window.restore).toHaveBeenCalledOnce();
    expect(h.window.show).toHaveBeenCalledOnce();
    expect(h.window.focus).toHaveBeenCalledOnce();
  });

  it("closes its backend before quitting when the last window closes", async () => {
    const h = harness();
    await createDesktopController(h.runtime, h.startBackend).start();

    h.allWindowsClosed();
    await vi.waitFor(() => expect(h.backend.close).toHaveBeenCalledOnce());

    expect(h.runtime.quit).toHaveBeenCalledOnce();
  });

  it("keeps the backend alive and recreates the window after macOS activation", async () => {
    const h = harness();
    h.runtime.shouldQuitOnAllWindowsClosed = vi.fn(() => false);
    await createDesktopController(h.runtime, h.startBackend).start();

    h.allWindowsClosed();
    expect(h.backend.close).not.toHaveBeenCalled();
    expect(h.runtime.quit).not.toHaveBeenCalled();

    h.activate();
    await vi.waitFor(() => expect(h.runtime.createWindow).toHaveBeenCalledTimes(2));
    expect(h.startBackend).toHaveBeenCalledOnce();
  });

  it("still quits and records the problem when backend cleanup fails", async () => {
    const h = harness();
    h.backend.close = vi.fn(async () => {
      throw new Error("server close failed");
    });
    const controller = createDesktopController(h.runtime, h.startBackend);
    await controller.start();

    await expect(controller.stop()).resolves.toBeUndefined();

    expect(h.runtime.reportError).toHaveBeenCalledWith(
      expect.stringContaining("server close failed"),
    );
    expect(h.runtime.quit).toHaveBeenCalledOnce();
  });

  it("shows a readable startup failure and leaves no backend behind", async () => {
    const h = harness();
    h.runtime.createWindow = vi.fn(async () => {
      throw new Error("UI failed to load");
    });

    await createDesktopController(h.runtime, h.startBackend).start();

    expect(h.runtime.showStartupError).toHaveBeenCalledWith(
      expect.stringContaining("UI failed to load"),
    );
    expect(h.backend.close).toHaveBeenCalledOnce();
    expect(h.runtime.quit).toHaveBeenCalledOnce();
  });

  it("quietly quits when startup is cancelled by a required permission gate", async () => {
    const h = harness();
    h.startBackend.mockRejectedValueOnce(new DesktopStartupCancelledError("permission required"));

    await createDesktopController(h.runtime, h.startBackend).start();

    expect(h.runtime.showStartupError).not.toHaveBeenCalled();
    expect(h.runtime.quit).toHaveBeenCalledOnce();
  });
});
