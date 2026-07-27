import { ApiError } from "../api";

interface ErrorInfo {
  title: string;
  detail?: string;
  hint?: string;
}

/**
 * Turn a failed-query error into something actionable. The whole point is to
 * replace the old "请确认看板服务正在运行" catch-all, which hid whether the
 * server was unreachable, returned an error, or returned garbage.
 */
function describe(err: unknown): ErrorInfo {
  if (err instanceof ApiError) {
    if (err.kind === "network") {
      return {
        title: "无法连接看板服务",
        detail: err.message,
        hint: "请确认已运行 pnpm start（默认 http://127.0.0.1:7777），且本页地址与之匹配。",
      };
    }
    if (err.kind === "http") {
      const status = err.status ?? 0;
      const serverFault = status >= 500 && status < 600;
      return {
        title: `服务返回错误（HTTP ${status}${err.statusText ? " " + err.statusText : ""}）`,
        detail: err.serverMessage ?? err.message,
        hint: serverFault
          ? "服务正在运行但处理请求时出错，请查看 pnpm start 终端的报错日志。"
          : "请求被服务拒绝，请刷新或重试。",
      };
    }
    return {
      title: "服务响应格式异常",
      detail: err.message,
      hint: "可能打开了错误地址或被代理拦截，请确认是 http://127.0.0.1:7777。",
    };
  }
  return {
    title: "无法加载项目",
    detail: err instanceof Error ? err.message : String(err),
    hint: "请确认看板服务正在运行（pnpm start）。",
  };
}

export function ErrorBanner({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const info = describe(error);
  return (
    <div className="mb-4 rounded-lg border border-rose-900 bg-rose-950/40 p-3 text-sm text-rose-300">
      <div className="font-medium">❌ {info.title}</div>
      {info.detail && (
        <div className="mt-1 break-all text-xs text-rose-400/80">详情：{info.detail}</div>
      )}
      {info.hint && <div className="mt-1 text-xs text-rose-300/90">建议：{info.hint}</div>}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 rounded bg-rose-800/60 px-2.5 py-1 text-xs text-rose-100 hover:bg-rose-700/60"
        >
          重试
        </button>
      )}
    </div>
  );
}
