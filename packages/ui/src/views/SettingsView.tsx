import { useEffect, useState, type ReactNode } from "react";
import {
  PROVIDER_PRESETS,
  providerPreset,
  type ProviderId,
} from "@ai-dashboard/core";
import { Icon } from "../components/Icons";
import { api } from "../api";
import { useSaveSettings, useSettings } from "../hooks";
import { useTheme, type ThemePreference } from "../theme";

export function SettingsView() {
  const { data } = useSettings();
  const save = useSaveSettings();
  const { preference, setPreference } = useTheme();

  const [provider, setProvider] = useState<ProviderId>("zhipu");
  const [requestUrl, setRequestUrl] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [autoRefreshMins, setAutoRefreshMins] = useState(0);
  const [synthOnRefresh, setSynthOnRefresh] = useState(false);

  // Model-list dropdown state: fetched from the endpoint, never persisted.
  const [models, setModels] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsMessage, setModelsMessage] = useState("");
  const [modelsError, setModelsError] = useState(false);

  // The fetched list belongs to a specific (requestUrl, apiKey) pair — drop it
  // as soon as either input changes so a stale list can't mislead selection.
  useEffect(() => {
    setModels([]);
    setModelsMessage("");
    setModelsError(false);
  }, [requestUrl, apiKey]);

  useEffect(() => {
    if (!data) return;
    setProvider(data.provider);
    setRequestUrl(data.requestUrl || providerPreset(data.provider)?.requestUrl || "");
    setModel(data.model || providerPreset(data.provider)?.recommendedModel || "");
    setApiKey(data.apiKey);
    setAutoRefreshMins(data.autoRefreshMins);
    setSynthOnRefresh(data.synthOnRefresh);
  }, [data]);

  const dirty =
    !!data &&
    (provider !== data.provider ||
      requestUrl !== (data.requestUrl || providerPreset(data.provider)?.requestUrl || "") ||
      model !== data.model ||
      autoRefreshMins !== data.autoRefreshMins ||
      synthOnRefresh !== data.synthOnRefresh ||
      apiKey !== data.apiKey);

  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const onFetchModels = async () => {
    if (!requestUrl.trim()) {
      setModelsError(true);
      setModelsMessage("请先填写请求地址，再拉取模型列表");
      return;
    }
    setModelsLoading(true);
    setModelsMessage("");
    setModelsError(false);
    try {
      const list = await api.listModels(requestUrl, apiKey);
      setModels(list);
      setModelsMessage(
        list.length
          ? `已获取 ${list.length} 个可用模型，可在模型框中下拉选择`
          : "该服务没有返回任何模型，请手动输入模型名",
      );
    } catch (error) {
      setModels([]);
      setModelsError(true);
      setModelsMessage(error instanceof Error ? error.message : "拉取模型列表失败");
    } finally {
      setModelsLoading(false);
    }
  };

  const onSave = () => {
    save.mutate({
      provider,
      requestUrl,
      model,
      autoRefreshMins,
      synthOnRefresh,
      apiKey: apiKey || undefined,
      // Keep the original field for a seamless migration of existing Zhipu keys.
      zhipuApiKey: provider === "zhipu" ? apiKey || undefined : undefined,
    });
  };

  return (
    <div className="page-rise mx-auto max-w-4xl space-y-6">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] ui-accent">
          Preferences
        </p>
        <h2 className="mt-1 text-2xl font-bold tracking-[-0.035em] ui-text">设置</h2>
        <p className="mt-1 text-sm ui-muted">
          控制总结模型、自动刷新与界面外观。所有设置只保存在本机。
        </p>
      </div>

      <SettingsSection
        eyebrow="AI summary"
        title="AI 总结"
        description="只在你主动生成或允许刷新总结时调用模型。"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="模型提供商">
            <select
              value={provider}
              onChange={(event) => {
                const next = event.target.value as ProviderId;
                const preset = providerPreset(next);
                setProvider(next);
                // Keep the typed API Key — switching provider must not wipe it.
                if (!preset || preset.protocol !== "openai-chat-completions") return;
                setRequestUrl(preset.requestUrl);
                setModel(preset.recommendedModel);
              }}
              className="ui-input"
            >
              {PROVIDER_PRESETS.map((preset) => (
                <option
                  key={preset.id}
                  value={preset.id}
                  disabled={preset.protocol !== "openai-chat-completions"}
                >
                  {preset.label}{preset.id === "zhipu" ? "（默认）" : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="请求地址（OpenAI Chat Completions）">
            <input
              name="requestUrl"
              autoComplete="off"
              spellCheck={false}
              value={requestUrl}
              onChange={(event) => setRequestUrl(event.target.value)}
              placeholder="https://api.openai.com/v1/"
              className="ui-input"
            />
          </Field>
          <Field label="模型">
            <div className="flex gap-2">
              <input
                name="model"
                autoComplete="off"
                spellCheck={false}
                value={model}
                onChange={(event) => setModel(event.target.value)}
                placeholder="glm-4-flash-250414"
                className="ui-input"
              />
              <button
                type="button"
                onClick={onFetchModels}
                disabled={modelsLoading}
                title="按当前请求地址和 API Key 拉取可用模型列表"
                className="ui-button shrink-0 px-2.5 py-1.5 text-xs"
              >
                {modelsLoading ? "拉取中…" : "拉取模型"}
              </button>
            </div>
            {models.length > 0 && (
              <select
                value=""
                onChange={(event) => {
                  if (event.target.value) setModel(event.target.value);
                }}
                aria-label="从可用模型中选择"
                className="ui-input mt-2"
              >
                <option value="" disabled>
                  从 {models.length} 个可用模型中选择…
                </option>
                {models.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            )}
            {modelsMessage && (
              <p className={`mt-1.5 text-xs ${modelsError ? "ui-danger" : "ui-muted"}`}>
                {modelsMessage}
              </p>
            )}
          </Field>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <SecretField
            name="apiKey"
            value={apiKey}
            onChange={setApiKey}
            emptyPlaceholder="粘贴 API Key（仅保存在本机）"
          />
          <div className="rounded-xl border p-3 text-xs leading-5 ui-muted ui-divider">
            预设只会填入推荐地址和模型；地址、模型和 API Key 都可以自行修改。已保存的 Key 会回显在本机设置页，请注意屏幕共享。
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        eyebrow="Refresh"
        title="自动刷新"
        description="机械状态刷新免费；自动总结可能产生模型调用。"
      >
        <div className="grid items-end gap-5 md:grid-cols-2">
          <Field label="刷新间隔（分钟，0 表示关闭）">
            <input
              type="number"
              name="autoRefreshMins"
              autoComplete="off"
              inputMode="numeric"
              min={0}
              value={autoRefreshMins}
              onChange={(event) => setAutoRefreshMins(Number(event.target.value) || 0)}
              className="ui-input"
            />
          </Field>
          <label
            className="flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm ui-text-soft ui-divider"
            style={{ background: "var(--surface-soft)" }}
          >
            <input
              type="checkbox"
              checked={synthOnRefresh}
              onChange={(event) => setSynthOnRefresh(event.target.checked)}
              style={{ accentColor: "var(--accent)" }}
            />
            刷新时一并更新 AI 总结
          </label>
        </div>
      </SettingsSection>

      <SettingsSection
        eyebrow="Appearance"
        title="界面外观"
        description="暖白与深墨使用同一套信息层级，只替换颜色。"
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <ThemeOption
            value="system"
            current={preference}
            icon="settings"
            title="跟随系统"
            description="随系统明暗设置变化"
            onSelect={setPreference}
          />
          <ThemeOption
            value="light"
            current={preference}
            icon="sun"
            title="暖白编辑台"
            description="明亮、安静、适合阅读"
            onSelect={setPreference}
          />
          <ThemeOption
            value="dark"
            current={preference}
            icon="moon"
            title="深墨专注台"
            description="低眩光、适合夜间工作"
            onSelect={setPreference}
          />
        </div>
      </SettingsSection>

      <SettingsSection
        eyebrow="Local first"
        title="本地数据"
        description="项目状态、偏好和密钥都保存在当前电脑。"
      >
        <div className="flex items-start gap-3 rounded-xl p-4 text-sm leading-6 ui-text-soft" style={{ background: "var(--surface-soft)" }}>
          <Icon name="check" size={17} className="mt-0.5 shrink-0 ui-success" />
          <p>
            数据目录为 <code className="font-mono text-xs ui-text">~/.ai-dashboard/</code>。
            API Key 会回显在本机设置页；网页不会把会话内容上传到看板服务之外。
          </p>
        </div>
      </SettingsSection>

      <div className="sticky bottom-4 flex items-center gap-3 rounded-2xl border p-3 shadow-xl ui-divider" style={{ background: "color-mix(in srgb, var(--surface) 94%, transparent)", backdropFilter: "blur(14px)" }} aria-live="polite">
        <button
          type="button"
          onClick={onSave}
          disabled={save.isPending || !dirty}
          className="ui-button ui-button-primary"
        >
          <Icon name="check" size={15} />
          {save.isPending ? "保存中…" : dirty ? "保存设置" : "设置已保存"}
        </button>
        {save.isSuccess && <span className="text-xs ui-success">保存成功</span>}
        {save.isError && <span className="text-xs ui-danger">保存失败，请重试</span>}
      </div>
    </div>
  );
}

function SettingsSection({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="ui-panel p-5 sm:p-6">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] ui-faint">{eyebrow}</p>
      <h3 className="mt-1 text-lg font-bold ui-text">{title}</h3>
      <p className="mt-1 text-sm ui-muted">{description}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold ui-muted">{label}</span>
      {children}
    </label>
  );
}

function SecretField({
  name,
  value,
  onChange,
  emptyPlaceholder,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  emptyPlaceholder: string;
}) {
  const [visible, setVisible] = useState(true);
  const labelId = `${name}-label`;
  const toggleLabel = visible ? "隐藏 API Key" : "显示 API Key";

  return (
    <div className="block">
      <label id={labelId} htmlFor={name} className="mb-1.5 block text-xs font-semibold ui-muted">
        API Key
      </label>
      <div className="relative">
        <input
          id={name}
          type={visible ? "text" : "password"}
          name={name}
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={emptyPlaceholder}
          className="ui-input pr-10"
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={toggleLabel}
          title={toggleLabel}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 ui-muted hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          <Icon name={visible ? "eye-off" : "eye"} size={18} />
        </button>
      </div>
    </div>
  );
}

function ThemeOption({
  value,
  current,
  icon,
  title,
  description,
  onSelect,
}: {
  value: ThemePreference;
  current: ThemePreference;
  icon: "settings" | "sun" | "moon";
  title: string;
  description: string;
  onSelect: (preference: ThemePreference) => void;
}) {
  const active = value === current;
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className="rounded-xl border p-4 text-left transition hover:-translate-y-0.5 ui-divider"
      style={{
        borderColor: active ? "var(--accent)" : "var(--border)",
        background: active ? "var(--accent-soft)" : "var(--surface-elevated)",
      }}
      aria-pressed={active}
    >
      <span className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${active ? "ui-accent" : "ui-muted"}`} style={{ background: "var(--surface-soft)" }}>
        <Icon name={icon} size={17} />
      </span>
      <span className="mt-3 block text-sm font-bold ui-text">{title}</span>
      <span className="mt-1 block text-xs leading-5 ui-muted">{description}</span>
    </button>
  );
}
