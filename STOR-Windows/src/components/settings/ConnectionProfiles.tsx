import { LocalModelSettings } from "./LocalModelSettings";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { SettingsCard } from "../ui/SettingsCard";
import { ToggleSwitch } from "../ui/ToggleSwitch";
import { SERVICE_PRESETS } from "../../types/config";
import type { AppConfig, ConnectionProfile, KeyEdit, KeyStatus, ServicePreset } from "../../types/config";

interface Props {
  config: AppConfig;
  savedConfig: AppConfig;
  defaults: ConnectionProfile | null;
  keys: Record<string, KeyEdit>;
  statuses: KeyStatus[];
  locked: boolean;
  onChange: (config: AppConfig) => void;
  onKeysChange: (keys: Record<string, KeyEdit>) => void;
  onBusyChange: (busy: boolean) => void;
}

export function ConnectionProfiles({ config, savedConfig, defaults, keys, statuses, locked, onChange, onKeysChange, onBusyChange }: Props) {
  const [editingId, setEditingId] = useState("");
  const [localBusy, setLocalBusy] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [busy, setBusy] = useState<"models" | "test" | null>(null);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { onBusyChange(localBusy || busy !== null); }, [localBusy, busy, onBusyChange]);
  const profile = config.profiles.find((p) => p.id === editingId) ?? config.profiles.find((p) => p.id === config.activeProfileId) ?? config.profiles[0];
  const active = config.profiles.find((p) => p.id === config.activeProfileId);
  if (!profile) return <SettingsCard title="翻译服务">
    <p className="hint">{defaults ? "没有连接方案，请先创建一个方案。" : "正在读取连接方案…"}</p>
    {defaults && <button type="button" className="secondary-btn" disabled={locked} onClick={() => onChange({ ...config, profiles: [{ ...defaults }], activeProfileId: defaults.id })}>创建默认方案</button>}
  </SettingsCard>;

  const keyEdit = keys[profile.id] ?? { action: "keep" };
  const keyStatus = statuses.find((s) => s.profileId === profile.id);
  const saved = savedConfig.profiles.find((p) => p.id === profile.id);
  const changedAddress = !!saved && saved.baseUrl.trim().replace(/\/+$/, "") !== profile.baseUrl.trim().replace(/\/+$/, "");
  const mustChooseKey = changedAddress && keyStatus?.present && keyEdit.action === "keep";

  const resetFeedback = () => { setModels([]); setResult(""); setError(""); };
  const editKey = (edit: KeyEdit) => { onKeysChange({ ...keys, [profile.id]: edit }); setResult(""); setError(""); };
  const patch = (change: Partial<ConnectionProfile>) => {
    if (change.baseUrl !== undefined && change.baseUrl !== profile.baseUrl && keyEdit.action === "reuse") editKey({ action: "keep" });
    onChange({ ...config, profiles: config.profiles.map((p) => p.id === profile.id ? { ...p, ...change } : p) });
    resetFeedback();
  };

  const add = () => {
    if (!defaults) return;
    const { baseUrl, authMode, model } = SERVICE_PRESETS.lmstudio;
    const next: ConnectionProfile = { ...defaults, baseUrl, authMode, model, preset: "lmstudio", name: `本地方案 ${config.profiles.length}`, id: crypto.randomUUID() };
    onChange({ ...config, profiles: [...config.profiles, next] });
    setEditingId(next.id); resetFeedback();
  };

  const remove = () => {
    if (!window.confirm(`删除方案「${profile.name}」？保存设置后将同时清除该方案密钥。`)) return;
    onChange({ ...config, profiles: config.profiles.filter((p) => p.id !== profile.id) });
    const next = { ...keys }; delete next[profile.id]; onKeysChange(next);
    setEditingId(config.activeProfileId); resetFeedback();
  };

  const diagnose = async (kind: "models" | "test") => {
    setBusy(kind); setError(""); setResult("");
    try {
      if (kind === "models") {
        const list = await invoke<string[]>("list_models", { profile, keyEdit });
        setModels(list); setResult(`已获取 ${list.length} 个模型；请选择可聊天的模型，列表不代表模型已加载。`);
      } else {
        const response = await invoke<{ text: string; latencyMs: number }>("test_generation", { profile, keyEdit });
        setResult(`生成成功 · ${(response.latencyMs / 1000).toFixed(1)} 秒\n${response.text}`);
      }
    } catch (err) { setError(String(err)); }
    finally { setBusy(null); }
  };

  return <SettingsCard title="翻译服务" status={`当前方案：${active?.name ?? "尚未选择"}`}>
    <fieldset className="connection-fields" disabled={locked || busy !== null || localBusy}>
      <div className="profile-toolbar">
        <label className="profile-picker">编辑连接方案
          <select className="select-input" value={profile.id} onChange={(e) => { setEditingId(e.target.value); resetFeedback(); }}>
            {config.profiles.map((p) => <option key={p.id} value={p.id}>{p.name}{p.id === config.activeProfileId ? " · 当前" : ""}</option>)}
          </select>
        </label>
        <button type="button" className="secondary-btn" onClick={add} disabled={!defaults}>新增方案</button>
        <button type="button" className="secondary-btn" disabled={profile.id === config.activeProfileId} onClick={() => onChange({ ...config, activeProfileId: profile.id })}>设为当前</button>
      </div>
      <p className="hint">翻译和查词共用当前方案。修改及切换须点击底部“保存设置”后生效。</p>
      <div className="settings-grid">
        <label>方案名称<input className="text-input" value={profile.name} onChange={(e) => patch({ name: e.target.value })} /></label>
        <label>服务预设<select className="select-input" value={profile.preset} onChange={(e) => {
          const preset = e.target.value as ServicePreset;
          const { baseUrl, authMode, model } = SERVICE_PRESETS[preset];
          patch({ preset, baseUrl, authMode, model, ...(preset === "local" ? { local: profile.local ?? { modelPath: "", compute: "gpu", contextLength: 4096 } } : {}) });
        }}>{Object.entries(SERVICE_PRESETS).map(([id, value]) => <option key={id} value={id}>{value.label}</option>)}</select></label>
      </div>
      {profile.preset === "local" && profile.local ? <LocalModelSettings key={profile.id} value={profile.local} onChange={local => patch({ local })} onBusy={setLocalBusy} /> : <>
      <label>API 基础地址<input className="text-input" value={profile.baseUrl} placeholder="http://127.0.0.1:1234/v1" onChange={(e) => patch({ baseUrl: e.target.value })} /></label>
      <p className="hint">填写服务基础路径，通常以 /v1 结尾；不要包含 /chat/completions。</p>
      <div className="profile-toolbar">
        <label className="profile-picker">模型标识<input className="text-input" value={profile.model} placeholder="填写服务实际使用的模型标识" onChange={(e) => patch({ model: e.target.value })} /></label>
        <button type="button" className="secondary-btn" onClick={() => void diagnose("models")}>获取模型列表</button>
      </div>
      {models.length > 0 && <label>可用模型<select className="select-input" value={models.includes(profile.model) ? profile.model : ""} onChange={(e) => {
        onChange({ ...config, profiles: config.profiles.map((p) => p.id === profile.id ? { ...p, model: e.target.value } : p) });
        setResult(""); setError("");
      }}><option value="" disabled>选择模型，也可在上方手动填写</option>{models.map((m) => <option key={m} value={m}>{m}</option>)}</select></label>}
      <label>认证方式<select className="select-input" value={profile.authMode} onChange={(e) => patch({ authMode: e.target.value as "none" | "bearer" })}>
        <option value="none">无认证（本地服务默认）</option><option value="bearer">Bearer API Key</option>
      </select></label>
      {(profile.authMode === "bearer" || keyStatus?.present || keyEdit.action !== "keep") && <div className="profile-key">
        <label>API Key<input type="password" className="text-input" autoComplete="off" value={keyEdit.action === "set" ? keyEdit.value : ""}
          placeholder={keyEdit.action === "clear" ? "保存后清除" : keyStatus?.present ? "已配置，留空保留" : "尚未配置"}
          onChange={(e) => editKey(e.target.value ? { action: "set", value: e.target.value } : { action: "keep" })} /></label>
        <div className="profile-actions">
          <button type="button" className="text-action" onClick={() => editKey({ action: "clear" })}>清除密钥</button>
          {keyEdit.action !== "keep" && <button type="button" className="text-action" onClick={() => editKey({ action: "keep" })}>撤销密钥修改</button>}
        </div>
        {keyEdit.action === "clear" && <p className="hint">测试与保存均按“无密钥”处理。</p>}
        {keyEdit.action === "reuse" && <p className="hint">已明确选择将原密钥用于当前地址。</p>}
        {mustChooseKey && <div className="profile-warning"><p>服务地址已改变。请重新输入密钥、清除密钥，或明确选择沿用。</p>
          <button type="button" className="secondary-btn" onClick={() => editKey({ action: "reuse" })}>将原密钥用于此地址</button>
        </div>}
      </div>}
      {keyStatus?.error && <p className="is-error" role="alert">{keyStatus.error}</p>}
      </>}
      <details className="profile-advanced"><summary>高级设置</summary>
        {profile.preset === "local" && profile.local && <label>上下文长度<input className="text-input" type="number" min={512} max={131072} step={512} value={profile.local.contextLength} onChange={e => patch({ local: { ...profile.local!, contextLength: Number(e.target.value) } })} /></label>}
        <ToggleSwitch label="流式输出" description="逐步显示内容；不兼容时可关闭。" checked={profile.stream} onChange={(stream) => patch({ stream })} />
        <label>请求超时（秒）<input className="text-input" type="number" min={5} max={600} step={1} value={profile.requestTimeoutSecs} onChange={(e) => patch({ requestTimeoutSecs: Number(e.target.value) })} /></label>
        <label>翻译提示词<textarea className="text-area profile-prompt" rows={4} value={profile.translationPrompt} onChange={(e) => patch({ translationPrompt: e.target.value })} /></label>
        <button type="button" className="text-action" onClick={() => defaults && patch({ translationPrompt: defaults.translationPrompt })}>恢复默认翻译提示词</button>
        <label>查词提示词<textarea className="text-area profile-prompt" rows={4} value={profile.lookupPrompt} onChange={(e) => patch({ lookupPrompt: e.target.value })} /></label>
        <button type="button" className="text-action" onClick={() => defaults && patch({ lookupPrompt: defaults.lookupPrompt })}>恢复默认查词提示词</button>
        <p className="hint">使用 {"{{language}}"} 表示目标语言。专用翻译模型的查词效果需要单独判断。</p>
      </details>
      <div className="profile-actions">
        <button type="button" className="secondary-btn" onClick={() => void diagnose("test")}>测试生成</button>
        <button type="button" className="text-action danger-action" onClick={remove} disabled={config.profiles.length <= 1 || profile.id === config.activeProfileId}>删除该方案</button>
      </div>
      <p className="hint">测试会调用当前草稿中的服务，只发送固定短句；云端服务可能计费。删除当前方案前请先将其他方案设为当前。</p>
    </fieldset>
    {busy && <p className="hint" role="status">{busy === "models" ? "正在获取模型列表…" : "正在测试生成，请等待模型响应…"}</p>}
    {result && <p className="profile-result" role="status">{result}</p>}
    {error && <p className="profile-result is-error" role="alert">{error}</p>}
  </SettingsCard>;
}
