import { ApiError } from "../api";
import { Icon } from "./Icons";

interface ErrorInfo {
  title: string;
  detail?: string;
  hint?: string;
}

function describe(err: unknown): ErrorInfo {
  if (err instanceof ApiError) {
    if (err.kind === "network") {
      return {
        title: "无法连接本地服务",
        detail: err.message,
        hint: "请确认已运行 pnpm start，默认地址为 127.0.0.1:7777。",
      };
    }
    if (err.kind === "http") {
      const status = err.status ?? 0;
      return {
        title: `服务返回错误（HTTP ${status}）`,
        detail: err.serverMessage ?? err.message,
        hint:
          status >= 500
            ? "请查看启动服务的终端输出。"
            : "请求被拒绝，请刷新或重试。",
      };
    }
    return {
      title: "服务响应格式异常",
      detail: err.message,
      hint: "请确认当前页面由本地看板服务打开。",
    };
  }
  return {
    title: "无法加载项目",
    detail: err instanceof Error ? err.message : String(err),
    hint: "请确认本地看板服务正在运行。",
  };
}

export function ErrorBanner({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  const info = describe(error);
  return (
    <div
      role="alert"
      className="mb-5 flex items-start gap-3 rounded-xl border p-3.5"
      style={{ borderColor: "var(--danger)", background: "var(--danger-soft)" }}
    >
      <span className="mt-0.5 ui-danger">
        <Icon name="alert" size={17} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold ui-text">{info.title}</div>
        {info.detail && (
          <div className="mt-1 break-all text-xs leading-5 ui-danger">{info.detail}</div>
        )}
        {info.hint && <div className="mt-1 text-xs leading-5 ui-text-soft">{info.hint}</div>}
      </div>
      {onRetry && (
        <button type="button" onClick={onRetry} className="ui-button shrink-0 px-2.5 py-1.5 text-xs">
          重试
        </button>
      )}
    </div>
  );
}
