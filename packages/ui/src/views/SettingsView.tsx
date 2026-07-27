import { useEffect, useState } from "react";
import { useSaveSettings, useSettings } from "../hooks";

export function SettingsView() {
  const { data } = useSettings();
  const save = useSaveSettings();

  const [provider, setProvider] = useState<"anthropic" | "openai">("anthropic");
  const [model, setModel] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [autoRefreshMins, setAutoRefreshMins] = useState(0);
  const [synthOnRefresh, setSynthOnRefresh] = useState(false);

  useEffect(() => {
    if (!data) return;
    setProvider(data.provider);
    setModel(data.model);
    setAutoRefreshMins(data.autoRefreshMins);
    setSynthOnRefresh(data.synthOnRefresh);
  }, [data]);

  const onSave = () => {
    save.mutate({
      provider,
      model,
      autoRefreshMins,
      synthOnRefresh,
      anthropicApiKey: anthropicKey || undefined,
      openaiApiKey: openaiKey || undefined,
    });
  };

  return (
    <div className="mx-auto max-w-xl space-y-4 rounded-xl border border-slate-800 bg-slate-900/40 p-5">
      <Field label="AI 总结的模型提供商">
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value as "anthropic" | "openai")}
          className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm"
        >
          <option value="anthropic">Anthropic (Claude)</option>
          <option value="openai">OpenAI (GPT)</option>
        </select>
      </Field>

      <Field label="模型（如 claude-haiku-4-5 / gpt-4o-mini）">
        <input
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm"
        />
      </Field>

      <Field label={`Anthropic API Key${data?.hasAnthropicKey ? "（已设置，留空则不修改）" : ""}`}>
        <input
          type="password"
          value={anthropicKey}
          onChange={(e) => setAnthropicKey(e.target.value)}
          placeholder={data?.hasAnthropicKey ? "••••••••" : "sk-ant-..."}
          className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm"
        />
      </Field>

      <Field label={`OpenAI API Key${data?.hasOpenAIKey ? "（已设置，留空则不修改）" : ""}`}>
        <input
          type="password"
          value={openaiKey}
          onChange={(e) => setOpenaiKey(e.target.value)}
          placeholder={data?.hasOpenAIKey ? "••••••••" : "sk-..."}
          className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm"
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="自动刷新（分钟，0=关）">
          <input
            type="number"
            min={0}
            value={autoRefreshMins}
            onChange={(e) => setAutoRefreshMins(Number(e.target.value) || 0)}
            className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm"
          />
        </Field>
        <label className="flex items-end gap-2 pb-1.5 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={synthOnRefresh}
            onChange={(e) => setSynthOnRefresh(e.target.checked)}
          />
          刷新时一并总结
        </label>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={onSave}
          disabled={save.isPending}
          className="rounded-lg bg-sky-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
        >
          {save.isPending ? "保存中…" : "保存"}
        </button>
        {save.isSuccess && <span className="text-xs text-emerald-400">已保存</span>}
        {save.isError && <span className="text-xs text-rose-400">保存失败</span>}
      </div>

      <p className="text-xs text-slate-600">
        所有数据保存在本机（<code className="text-slate-500">~/.ai-dashboard/</code>），API Key 仅用于按需总结，不会被任何接口回显。
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-slate-400">{label}</span>
      {children}
    </label>
  );
}
