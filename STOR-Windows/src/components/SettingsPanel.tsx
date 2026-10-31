import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LANGS } from "./ui/LanguageSegment";
import { SettingsCard } from "./ui/SettingsCard";
import { ToggleSwitch } from "./ui/ToggleSwitch";
import { WindowHeader } from "./ui/WindowHeader";
import { ConnectionProfiles } from "./settings/ConnectionProfiles";
import type { AppConfig, ConnectionProfile, KeyEdit, KeyStatus } from "../types/config";

interface HotkeyStatus {
  activeHotkey: string | null;
  error: string | null;
}

interface OcrStatus {
  model: string;
  state: "starting" | "ready" | "error";
  error: string | null;
}

export function SettingsPanel() {
  const [config, setConfig] = useState<AppConfig>({
    hotkey: "Ctrl+Shift+T",
    defaultTargetLang: "zh",
    ocrLanguage: "auto",
    freezeFrameOnSelect: true,
    enableTranslationCache: true,
    popupOpacity: 0.95,
    deepseekModel: "deepseek-chat",
    profiles: [],
    activeProfileId: "",
  });
  const [savedConfig, setSavedConfig] = useState<AppConfig>(config);
  const [defaults, setDefaults] = useState<ConnectionProfile | null>(null);
  const [keyEdits, setKeyEdits] = useState<Record<string, KeyEdit>>({});
  const [keyStatuses, setKeyStatuses] = useState<KeyStatus[]>([]);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hotkeyStatus, setHotkeyStatus] = useState<HotkeyStatus | null>(null);
  const [ocrStatus, setOcrStatus] = useState<OcrStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [connectionBusy, setConnectionBusy] = useState(false);
  const savingRef = useRef(false);
  const locked = !ready || saving || connectionBusy;

  useEffect(() => {
    let alive = true;
    let unlisten: (() => void) | undefined;
    void (async () => {
      try {
        unlisten = await listen<OcrStatus>("ocr-status", ({ payload }) => {
          if (alive) setOcrStatus(payload);
        });
        if (!alive) { unlisten(); return; }
        const status = await invoke<OcrStatus>("get_ocr_status");
        if (alive) setOcrStatus(status);
      } catch {
        if (alive) setOcrStatus({ model: "PP-OCRv6 small", state: "error", error: "无法读取识别服务状态，请重启 STOR" });
      }
    })();
    return () => { alive = false; unlisten?.(); };
  }, []);

  useEffect(() => {
    Promise.all([
      invoke<AppConfig>("get_app_config"),
      invoke<KeyStatus[]>("get_credential_status"),
      invoke<HotkeyStatus>("get_hotkey_status"),
      invoke<ConnectionProfile>("get_service_defaults"),
    ]).then(([loaded, statuses, status, serviceDefaults]) => {
      setConfig(loaded);
      setSavedConfig(loaded);
      setKeyStatuses(statuses);
      setDefaults(serviceDefaults);
      if (loaded.configurationError) setError(loaded.configurationError);
      setHotkeyStatus(status);
      setReady(true);
    }).catch((err) => setError(String(err)));

    let alive = true;
    let unlisten: (() => void) | undefined;
    void (async () => {
      unlisten = await listen<{ sessionId: string; message: string; surface: string }>(
        "overlay-prepare-error",
        (event) => {
          if (event.payload.surface === "settings") setError(event.payload.message);
        },
      );
      if (!alive) {
        unlisten();
        return;
      }
      const pending = await invoke<{ sessionId: string; message: string; surface: string } | null>(
        "get_prepare_error",
      );
      if (alive && pending?.surface === "settings") setError(pending.message);
    })();
    return () => {
      alive = false;
      unlisten?.();
    };
  }, []);

  const handleSave = async () => {
    if (!ready || savingRef.current || connectionBusy) return;
    savingRef.current = true;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const loaded = await invoke<AppConfig>("save_settings", { config, credentials: Object.entries(keyEdits).map(([profileId, edit]) => ({ profileId, ...edit })) });
      setConfig(loaded);
      setSavedConfig(loaded);
      setKeyEdits({});
      const [status, statuses] = await Promise.all([
        invoke<HotkeyStatus>("get_hotkey_status"),
        invoke<KeyStatus[]>("get_credential_status"),
      ]);
      setHotkeyStatus(status);
      setKeyStatuses(statuses);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(String(err));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const dirty = JSON.stringify(config) !== JSON.stringify(savedConfig) || Object.values(keyEdits).some((edit) => edit.action !== "keep");
  const feedback = !ready
    ? "正在读取配置..."
    : saving
      ? "保存中..."
      : error
        ? error
        : saved && hotkeyStatus?.error
          ? `设置已保存。${hotkeyStatus.error}`
          : hotkeyStatus?.error
            ? hotkeyStatus.error
            : saved && !dirty
              ? "设置已保存"
              : dirty ? "有未保存的修改" : "修改后点击保存";
  const usage = hotkeyStatus?.activeHotkey
    ? `按 ${hotkeyStatus.activeHotkey} 框选翻译，或点击系统托盘图标打开翻译窗口。`
    : "当前没有可用快捷键。仍可点击系统托盘图标打开翻译窗口。";

  return (
    <div className="settings-root">
      <WindowHeader
        subtitle="设置"
        onMinimize={() => void getCurrentWindow().minimize()}
        onClose={() => void getCurrentWindow().close()}
      />

      <div className="panel-scroll">
        <div className="page-intro">
          <h1>设置</h1>
          <p>配置翻译服务、目标语言，以及框选时的使用方式。</p>
        </div>

        <ConnectionProfiles config={config} savedConfig={savedConfig} defaults={defaults} keys={keyEdits}
          statuses={keyStatuses} locked={locked} onChange={setConfig} onKeysChange={setKeyEdits} onBusyChange={setConnectionBusy} />

        <SettingsCard title="语言">
          <div className="settings-grid">
            <label>
              默认目标语言
              <select
                className="select-input"
                value={config.defaultTargetLang}
                disabled={locked}
                onChange={(event) =>
                  setConfig({ ...config, defaultTargetLang: event.target.value })
                }
              >
                {LANGS.map((lang) => (
                  <option key={lang.id} value={lang.id}>{lang.label}</option>
                ))}
              </select>
            </label>
            <label>
              OCR 模型
              <input className="text-input" value="PP-OCRv6 small" readOnly />
            </label>
          </div>
          <p className="hint">本地识别中、英、日混合文字，无需切换识别语言。</p>
          <p className="hint" role="status">
            {ocrStatus?.state === "ready" ? "识别服务已就绪 · CPU 离线运行" :
              ocrStatus?.state === "error" ? ocrStatus.error : "正在准备识别服务…"}
          </p>
        </SettingsCard>

        <SettingsCard title="框选与使用">
          <div className="hotkey-row">
            <div>
              <p className="field-title">框选快捷键</p>
              <p className="hint">保存后重新注册。默认 Ctrl+Shift+T。</p>
            </div>
            <label className="hotkey-field">
              <span className="sr-only">框选快捷键</span>
              <input
                className="text-input"
                value={config.hotkey}
                disabled={locked}
                onChange={(event) => setConfig({ ...config, hotkey: event.target.value })}
              />
            </label>
          </div>
          <div className="settings-grid">
            <ToggleSwitch
              label="框选时冻结画面"
              description="用当前显示器的截图作为框选底图。"
              checked={config.freezeFrameOnSelect}
              disabled={locked}
              onChange={(checked) =>
                setConfig({ ...config, freezeFrameOnSelect: checked })
              }
            />
            <ToggleSwitch
              label="启用翻译缓存"
              description="相同原文和语言直接使用本地结果。"
              checked={config.enableTranslationCache}
              disabled={locked}
              onChange={(checked) =>
                setConfig({ ...config, enableTranslationCache: checked })
              }
            />
          </div>
        </SettingsCard>

        <aside className="settings-note">{usage}</aside>
      </div>

      <footer className="panel-footer">
        <p className={error || hotkeyStatus?.error ? "is-error" : ""} role="status">{feedback}</p>
        <button type="button" className="primary-btn" onClick={() => void handleSave()} disabled={locked}>
          {saving ? "保存中..." : "保存设置"}
        </button>
      </footer>
    </div>
  );
}
