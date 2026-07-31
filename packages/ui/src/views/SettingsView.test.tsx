import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsView } from "./SettingsView";
import { ThemeProvider } from "../theme";
import { jsonResponse } from "../test/fixtures";

describe("settings startup and provider guard", () => {
  let requests: { url: string; body?: string }[];

  beforeEach(() => {
    requests = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      requests.push({ url, body: init?.body?.toString() });
      return jsonResponse({
        provider: "zhipu",
        model: "qa-model",
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
});
