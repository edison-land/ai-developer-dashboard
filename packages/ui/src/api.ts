import type {
  ActivityTimeRange,
  ActivityItem,
  FocusPreferences,
  Settings,
  Stage,
  SourceId,
  SynthOutcome,
  UnifiedProject,
} from "@ai-dashboard/core";

export interface ProjectsResponse {
  projects: UnifiedProject[];
  generatedAtMs: number;
  synthesis?: RefreshSynthesisSummary;
}
export interface RefreshSynthesisSummary {
  enabled: boolean;
  total: number;
  fresh: number;
  cached: number;
  failed: number;
  errors: string[];
}
export interface ActivityResponse {
  items: ActivityItem[];
  generatedAtMs: number;
}
export interface ActivityFilters {
  sources?: SourceId[];
  project?: string;
  range?: ActivityTimeRange;
}
export interface SynthesizeAllResponse {
  total: number;
  cached: number;
  fresh: number;
  failed: number;
  generatedAtMs: number;
}
export interface SynthesizeAllProgressEvent {
  type: "progress";
  canonicalPath: string;
  completed: number;
  total: number;
  status: "cached" | "fresh" | "failed";
  cached: number;
  fresh: number;
  failed: number;
  project?: UnifiedProject;
  error?: string;
}
interface SynthesizeAllCompleteEvent extends SynthesizeAllResponse {
  type: "complete";
}
type SynthesizeAllEvent =
  | SynthesizeAllProgressEvent
  | SynthesizeAllCompleteEvent;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function parseSynthesizeAllEvent(value: unknown): SynthesizeAllEvent {
  if (!isRecord(value) || typeof value.type !== "string") {
    throw new ApiError({
      kind: "parse",
      message: "批量总结进度缺少事件类型",
      url: "/api/synthesize-all",
    });
  }

  if (value.type === "progress") {
    const validStatus = value.status === "cached" || value.status === "fresh" || value.status === "failed";
    const valid =
      typeof value.canonicalPath === "string" &&
      isNonNegativeNumber(value.completed) &&
      isNonNegativeNumber(value.total) &&
      validStatus &&
      isNonNegativeNumber(value.cached) &&
      isNonNegativeNumber(value.fresh) &&
      isNonNegativeNumber(value.failed) &&
      (value.project === undefined ||
        (isRecord(value.project) && typeof value.project.canonicalPath === "string")) &&
      (value.error === undefined || typeof value.error === "string");
    if (!valid) {
      throw new ApiError({
        kind: "parse",
        message: "批量总结进度字段不完整",
        url: "/api/synthesize-all",
      });
    }
    return value as unknown as SynthesizeAllProgressEvent;
  }

  if (value.type === "complete") {
    const valid =
      isNonNegativeNumber(value.total) &&
      isNonNegativeNumber(value.cached) &&
      isNonNegativeNumber(value.fresh) &&
      isNonNegativeNumber(value.failed) &&
      isNonNegativeNumber(value.generatedAtMs);
    if (!valid) {
      throw new ApiError({
        kind: "parse",
        message: "批量总结最终统计字段不完整",
        url: "/api/synthesize-all",
      });
    }
    return value as unknown as SynthesizeAllCompleteEvent;
  }

  throw new ApiError({
    kind: "parse",
    message: "批量总结返回了未知进度",
    url: "/api/synthesize-all",
  });
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

/** Settings returned to the local settings page, including the current provider's saved key. */
export type SettingsResponse = Settings & { apiKey: string };

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

async function fetchResponse(input: string, init?: RequestInit): Promise<Response> {
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

  return res;
}

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetchResponse(input, init);
  try {
    return (await res.json()) as T;
  } catch {
    throw new ApiError({ kind: "parse", message: "响应不是有效的 JSON", url: input });
  }
}

async function synthesizeAll(
  onProgress?: (
    event: SynthesizeAllProgressEvent,
  ) => void | Promise<void>,
): Promise<SynthesizeAllResponse> {
  const url = "/api/synthesize-all";
  const res = await fetchResponse(url, { method: "POST" });
  const reader = res.body?.getReader();
  if (!reader) {
    throw new ApiError({
      kind: "parse",
      message: "服务没有返回批量总结进度",
      url,
    });
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let complete: SynthesizeAllResponse | undefined;

  const consumeLine = async (line: string) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line) as unknown;
    } catch {
      throw new ApiError({
        kind: "parse",
        message: "批量总结进度不是有效的数据",
        url,
      });
    }
    const event = parseSynthesizeAllEvent(parsed);

    if (event.type === "progress") {
      await onProgress?.(event);
      return;
    }
    if (event.type === "complete") {
      const { type: _type, ...result } = event;
      complete = result;
      return;
    }
  };

  try {
    for (;;) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.trim()) await consumeLine(line);
      }
      if (done) break;
    }
    if (buffer.trim()) await consumeLine(buffer);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError({
      kind: "network",
      message: error instanceof Error ? error.message : "批量总结连接中断",
      url,
    });
  }

  if (!complete) {
    throw new ApiError({
      kind: "parse",
      message: "批量总结没有返回最终统计",
      url,
    });
  }
  return complete;
}

export const api = {
  health: (): Promise<HealthResponse> => request<HealthResponse>("/api/health"),
  projects: (): Promise<ProjectsResponse> => request<ProjectsResponse>("/api/projects"),
  archivedProjects: (): Promise<ProjectsResponse> =>
    request<ProjectsResponse>("/api/projects?includeArchived=true"),
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
  getSettings: (): Promise<SettingsResponse> => request<SettingsResponse>("/api/settings"),
  putSettings: (
    patch: Partial<Settings> & {
      apiKey?: string;
      anthropicApiKey?: string;
      openaiApiKey?: string;
      zhipuApiKey?: string;
    },
  ): Promise<SettingsResponse> =>
    request<SettingsResponse>("/api/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    }),
  synthesize: (canonical: string): Promise<{ project: UnifiedProject; outcome: SynthOutcome }> =>
    request(`/api/projects/${encodePath(canonical)}/synthesize`, { method: "POST" }),
  synthesizeAll,
  activity: (filters: ActivityFilters = {}): Promise<ActivityResponse> => {
    const params = new URLSearchParams();
    if (filters.sources?.length) params.set("sources", filters.sources.join(","));
    if (filters.project?.trim()) params.set("project", filters.project.trim());
    if (filters.range && filters.range !== "all") params.set("range", filters.range);
    const query = params.toString();
    return request<ActivityResponse>(`/api/activity${query ? `?${query}` : ""}`);
  },
  focusPreferences: (localDate: string): Promise<FocusPreferences> =>
    request<FocusPreferences>(
      `/api/focus-preferences?localDate=${encodeURIComponent(localDate)}`,
    ),
  putFocusPreferences: (preferences: FocusPreferences): Promise<FocusPreferences> =>
    request<FocusPreferences>("/api/focus-preferences", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(preferences),
    }),
  archive: async (canonical: string): Promise<void> => {
    await request(`/api/projects/${encodePath(canonical)}/archive`, { method: "POST" });
  },
  unarchive: async (canonical: string): Promise<void> => {
    await request(`/api/projects/${encodePath(canonical)}/archive`, { method: "DELETE" });
  },
};
