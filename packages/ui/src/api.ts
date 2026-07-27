import type { Settings, Stage, UnifiedProject } from "@ai-dashboard/core";

export interface ProjectsResponse {
  projects: UnifiedProject[];
  generatedAtMs: number;
}
export interface HealthResponse {
  ok: boolean;
  dataRoot: string;
  dbPath: string;
  claudeCodeAvailable: boolean;
  codexAvailable: boolean;
  gitAvailable: boolean;
  projectCount: number;
  generatedAtMs: number;
}

/** base64url-encode a canonical path for the :enc route param (mirrors the server). */
export function encodePath(canonical: string): string {
  const b64 = btoa(unescape(encodeURIComponent(canonical)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Why an API call failed. Lets the UI tell "can't reach server" from "server errored". */
export type ApiErrorKind = "network" | "http" | "parse";

/**
 * Structured fetch failure. `fetch()` only rejects on network-layer problems
 * (connection refused, DNS, offline, CORS) — never on an HTTP status — so we
 * wrap every code path to keep the cause distinguishable for the UI.
 */
export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  readonly statusText?: string;
  /** The server's own error message when we could read one (HTTP errors only). */
  readonly serverMessage?: string;
  readonly url: string;
  constructor(opts: {
    kind: ApiErrorKind;
    message: string;
    url: string;
    status?: number;
    statusText?: string;
    serverMessage?: string;
  }) {
    super(opts.message);
    this.name = "ApiError";
    this.kind = opts.kind;
    this.status = opts.status;
    this.statusText = opts.statusText;
    this.serverMessage = opts.serverMessage;
    this.url = opts.url;
  }
}

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(input, init);
  } catch (e) {
    // fetch rejects only on network-layer failure — never on HTTP status.
    throw new ApiError({
      kind: "network",
      message: e instanceof Error ? e.message : "网络请求失败",
      url: input,
    });
  }

  if (!res.ok) {
    // Try to surface the server's own reason (our app.onError returns
    // { error, message } JSON). Fall back silently for non-JSON bodies.
    let serverMessage: string | undefined;
    try {
      const body = (await res.clone().json()) as { error?: string; message?: string };
      serverMessage = body?.message ?? body?.error;
    } catch {
      // body wasn't JSON (e.g. a proxy's HTML error page) — nothing to read
    }
    throw new ApiError({
      kind: "http",
      message: serverMessage ?? `服务返回 HTTP ${res.status}`,
      url: input,
      status: res.status,
      statusText: res.statusText,
      serverMessage,
    });
  }

  try {
    return (await res.json()) as T;
  } catch {
    throw new ApiError({ kind: "parse", message: "响应不是有效的 JSON", url: input });
  }
}

export const api = {
  health: (): Promise<HealthResponse> => request<HealthResponse>("/api/health"),
  projects: (): Promise<ProjectsResponse> => request<ProjectsResponse>("/api/projects"),
  refresh: (): Promise<ProjectsResponse> =>
    request<ProjectsResponse>("/api/refresh", { method: "POST" }),
  setStage: async (canonical: string, stage: Stage): Promise<void> => {
    await request(`/api/projects/${encodePath(canonical)}/stage`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ stage }),
    });
  },
  clearStage: async (canonical: string): Promise<void> => {
    await request(`/api/projects/${encodePath(canonical)}/stage`, { method: "DELETE" });
  },
  getSettings: (): Promise<Settings> => request<Settings>("/api/settings"),
  putSettings: (
    patch: Partial<Settings> & { anthropicApiKey?: string; openaiApiKey?: string },
  ): Promise<Settings> =>
    request<Settings>("/api/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    }),
};
