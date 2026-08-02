export interface DesktopWindow {
  isMinimized(): boolean;
  restore(): void;
  show(): void;
  focus(): void;
}

export interface DesktopRuntime {
  requestSingleInstanceLock(): boolean;
  onSecondInstance(listener: () => void): void;
  onAllWindowsClosed(listener: () => void): void;
  whenReady(): Promise<void>;
  createWindow(url: string): Promise<DesktopWindow>;
  showStartupError(message: string): void;
  reportError(message: string): void;
  quit(): void;
}

export interface ManagedBackend {
  url: string;
  close(): Promise<void>;
}

export type StartBackend = () => Promise<ManagedBackend>;

export interface DesktopController {
  start(): Promise<void>;
  stop(): Promise<void>;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Coordinates the product-visible desktop lifecycle without Electron details. */
export function createDesktopController(
  runtime: DesktopRuntime,
  startBackend: StartBackend,
): DesktopController {
  let backend: ManagedBackend | undefined;
  let window: DesktopWindow | undefined;
  let stopping: Promise<void> | undefined;

  const stop = (): Promise<void> => {
    if (stopping) return stopping;
    stopping = (async () => {
      try {
        if (backend) {
          const current = backend;
          backend = undefined;
          await current.close();
        }
      } catch (error) {
        runtime.reportError(`桌面后端清理失败：${errorMessage(error)}`);
      } finally {
        runtime.quit();
      }
    })();
    return stopping;
  };

  const start = async (): Promise<void> => {
    if (!runtime.requestSingleInstanceLock()) {
      runtime.quit();
      return;
    }

    runtime.onSecondInstance(() => {
      if (!window) return;
      if (window.isMinimized()) window.restore();
      window.show();
      window.focus();
    });
    runtime.onAllWindowsClosed(() => {
      void stop();
    });

    try {
      await runtime.whenReady();
      backend = await startBackend();
      window = await runtime.createWindow(backend.url);
    } catch (error) {
      runtime.showStartupError(`AI Developer Dashboard 启动失败：${errorMessage(error)}`);
      await stop();
    }
  };

  return { start, stop };
}
