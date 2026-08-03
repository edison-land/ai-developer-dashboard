import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsView } from "./SettingsView";
import { ThemeProvider } from "../theme";
import { jsonResponse } from "../test/fixtures";

describe("settings startup and provider guard", () => {
  let requests: { url: string; body?: string }[];
  let savedApiKey: string;

  beforeEach(() => {
    requests = [];
    savedApiKey = "stored-key";
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      requests.push({ url, body: init?.body?.toString() });
      if (url.endsWith("/api/models")) {
        const body = JSON.parse(init?.body?.toString() ?? "{}") as { apiKey?: string };
        if (body.apiKey === "bad-key") {
          return jsonResponse({ error: "API Key 无效或没有访问权限（HTTP 401）" }, 502);
        }
        return jsonResponse({ models: ["glm-4-air", "glm-4-flash"] });
      }
      if (init?.method === "PUT") {
        const patch = JSON.parse(init.body?.toString() ?? "{}") as { apiKey?: string; zhipuApiKey?: string };
        savedApiKey = patch.zhipuApiKey ?? patch.apiKey ?? savedApiKey;
      }
      return jsonResponse({
        provider: "zhipu",
        model: "qa-model",
        apiKey: savedApiKey,
        hasAnthropicKey: false,
        hasOpenAIKey: false,
        hasZhipuKey: false,
        autoRefreshMins: 0,
        synthOnRefresh: false,
      });
    }));
  });

  afterEach(() => vi.unstubAllGlobals());

  it("keeps incompatible protocols disabled and saves the refresh switch", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(<ThemeProvider><QueryClientProvider client={client}><SettingsView /></QueryClientProvider></ThemeProvider>);
    await screen.findByDisplayValue("qa-model");
    expect(screen.getByRole("option", { name: /Anthropic Claude/ })).toBeDisabled();
    expect(screen.getByRole("option", { name: /OpenAI GPT/ })).not.toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox", { name: "刷新时一并更新 AI 总结" }));
    fireEvent.click(screen.getByRole("button", { name: "保存设置" }));
    await waitFor(() => expect(requests.some((request) => request.url.endsWith("/api/settings") && request.body?.includes('"synthOnRefresh":true'))).toBe(true));
  });

  it("shows the saved API Key by default and toggles masking without clearing it after save", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(<ThemeProvider><QueryClientProvider client={client}><SettingsView /></QueryClientProvider></ThemeProvider>);

    const apiKey = await screen.findByRole("textbox", { name: "API Key" });
    await waitFor(() => expect(apiKey).toHaveValue("stored-key"));
    expect(apiKey).toHaveAttribute("type", "text");

    fireEvent.click(screen.getByRole("button", { name: "隐藏 API Key" }));
    expect(apiKey).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByRole("button", { name: "显示 API Key" }));
    expect(apiKey).toHaveAttribute("type", "text");

    fireEvent.change(apiKey, { target: { value: "replacement-key" } });
    fireEvent.click(screen.getByRole("button", { name: "保存设置" }));
    await waitFor(() => expect(requests.some((request) => request.body?.includes('"zhipuApiKey":"replacement-key"'))).toBe(true));
    await waitFor(() => expect(screen.getByDisplayValue("replacement-key")).toHaveAttribute("type", "text"));
  });

  it("keeps the typed API Key when switching providers", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(<ThemeProvider><QueryClientProvider client={client}><SettingsView /></QueryClientProvider></ThemeProvider>);
    const apiKeyInput = await screen.findByRole("textbox", { name: "API Key" });
    await waitFor(() => expect(apiKeyInput).toHaveValue("stored-key"));

    fireEvent.change(screen.getByRole("combobox", { name: "模型提供商" }), { target: { value: "openai" } });
    expect(apiKeyInput).toHaveValue("stored-key");
  });

  it("fetches available models into a dropdown and keeps manual input working", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(<ThemeProvider><QueryClientProvider client={client}><SettingsView /></QueryClientProvider></ThemeProvider>);
    await screen.findByDisplayValue("qa-model");

    fireEvent.click(screen.getByRole("button", { name: "拉取模型" }));

    await screen.findByText(/已获取 2 个可用模型/);
    const picker = screen.getByRole("combobox", { name: "从可用模型中选择" });
    const options = Array.from(picker.querySelectorAll("option")).map((option) => option.getAttribute("value"));
    expect(options).toEqual(["", "glm-4-air", "glm-4-flash"]);

    // Picking from the dropdown fills the input; manual typing still works.
    fireEvent.change(picker, { target: { value: "glm-4-air" } });
    expect(screen.getByPlaceholderText("glm-4-flash-250414")).toHaveValue("glm-4-air");
    fireEvent.change(screen.getByPlaceholderText("glm-4-flash-250414"), { target: { value: "custom-model" } });
    expect(screen.getByPlaceholderText("glm-4-flash-250414")).toHaveValue("custom-model");
  });

  it("asks for the request URL instead of silently disabling the fetch", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(<ThemeProvider><QueryClientProvider client={client}><SettingsView /></QueryClientProvider></ThemeProvider>);
    await screen.findByDisplayValue("qa-model");

    const urlInput = screen.getByPlaceholderText("https://api.openai.com/v1/");
    fireEvent.change(urlInput, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "拉取模型" }));

    await screen.findByText(/请先填写请求地址/);
    expect(requests.some((request) => request.url.endsWith("/api/models"))).toBe(false);
  });

  it("fetches models without an API Key", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(<ThemeProvider><QueryClientProvider client={client}><SettingsView /></QueryClientProvider></ThemeProvider>);
    await screen.findByDisplayValue("qa-model");

    const apiKeyInput = screen.getByRole("textbox", { name: "API Key" });
    fireEvent.change(apiKeyInput, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "拉取模型" }));

    await screen.findByText(/已获取 2 个可用模型/);
    const modelsRequest = requests.find((request) => request.url.endsWith("/api/models"));
    expect(modelsRequest?.body).toContain('"apiKey":""');
  });

  it("surfaces a readable message when the model list request fails", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(<ThemeProvider><QueryClientProvider client={client}><SettingsView /></QueryClientProvider></ThemeProvider>);
    await screen.findByDisplayValue("qa-model");

    const apiKeyInput = screen.getByRole("textbox", { name: "API Key" });
    fireEvent.change(apiKeyInput, { target: { value: "bad-key" } });
    fireEvent.click(screen.getByRole("button", { name: "拉取模型" }));

    await screen.findByText(/API Key 无效或没有访问权限/);
  });
});
