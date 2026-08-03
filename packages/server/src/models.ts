import OpenAI from "openai";

/**
 * Fetch available model ids from an OpenAI-compatible service
 * (GET {baseURL}/models). Backs the settings page dropdown so users can pick
 * a model instead of typing the exact id. Errors are re-thrown with
 * user-facing Chinese messages; the route maps them to HTTP responses.
 */
export async function listModels(requestUrl: string, apiKey: string): Promise<string[]> {
  const client = new OpenAI({
    // Some services list models without auth; the SDK still requires a
    // non-empty key, so fall back to a placeholder when none was entered.
    apiKey: apiKey || "no-key",
    baseURL: requestUrl,
    timeout: 15_000,
    maxRetries: 0,
  });
  try {
    const page = await client.models.list();
    const ids = page.data
      .map((model) => model.id)
      .filter((id): id is string => typeof id === "string" && id.length > 0);
    return [...new Set(ids)].sort((a, b) => a.localeCompare(b));
  } catch (error) {
    throw new Error(describeListModelsError(error));
  }
}

function describeListModelsError(error: unknown): string {
  if (error instanceof OpenAI.APIConnectionTimeoutError) {
    return "连接模型服务超时，请检查请求地址和网络";
  }
  if (error instanceof OpenAI.APIConnectionError) {
    return "无法连接到请求地址，请检查地址是否正确、网络是否可用";
  }
  if (error instanceof OpenAI.APIError) {
    const status = error.status;
    if (status === 401 || status === 403) return `API Key 无效或没有访问权限（HTTP ${status}）`;
    if (status === 404) return "该服务没有模型列表接口（HTTP 404），请手动输入模型名";
    if (status === 429) return "请求过于频繁，请稍后再试（HTTP 429）";
    return `模型服务返回错误（HTTP ${status ?? "未知"}）：${error.message}`;
  }
  return `拉取模型列表失败：${error instanceof Error ? error.message : String(error)}`;
}
