export type ServicePreset = "deepseek" | "lmstudio" | "ollama" | "custom" | "local";
export interface LocalModelConfig {
  modelPath: string;
  compute: "gpu" | "cpu";
  contextLength: number;
}
export interface ConnectionProfile {
  id: string;
  name: string;
  preset: ServicePreset;
  baseUrl: string;
  model: string;
  authMode: "none" | "bearer";
  stream: boolean;
  requestTimeoutSecs: number;
  translationPrompt: string;
  lookupPrompt: string;
  local?: LocalModelConfig;
}

export interface AppConfig {
  hotkey: string;
  defaultTargetLang: string;
  ocrLanguage: string;
  freezeFrameOnSelect: boolean;
  enableTranslationCache: boolean;
  popupOpacity: number;
  deepseekModel: string;
  profiles: ConnectionProfile[];
  activeProfileId: string;
  configurationError?: string;
}

export type KeyEdit = { action: "keep" | "clear" | "reuse" } | { action: "set"; value: string };
export interface KeyStatus { profileId: string; present: boolean; error: string | null }

export const SERVICE_PRESETS: Record<ServicePreset, { label: string; baseUrl: string; authMode: "none" | "bearer"; model: string }> = {
  deepseek: { label: "DeepSeek", baseUrl: "https://api.deepseek.com", authMode: "bearer", model: "deepseek-chat" },
  lmstudio: { label: "LM Studio", baseUrl: "http://127.0.0.1:1234/v1", authMode: "none", model: "" },
  ollama: { label: "Ollama", baseUrl: "http://127.0.0.1:11434/v1", authMode: "none", model: "" },
  custom: { label: "自定义兼容服务", baseUrl: "", authMode: "none", model: "" },
  local: { label: "本地 GGUF 模型（STOR 自动运行）", baseUrl: "", authMode: "none", model: "stor-local" },
};
