use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::os::windows::ffi::OsStrExt;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use windows::core::PCWSTR;
use windows::Win32::Storage::FileSystem::{MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH};

pub const KEYRING_SERVICE: &str = "stor";
pub const KEYRING_USER: &str = "deepseek_api_key";

pub const TRANSLATION_PROMPT: &str = "You are a game localization translator. Translate game UI/dialog text accurately and concisely. Preserve proper nouns. Output ONLY the translation, no explanation.";
pub const LOOKUP_PROMPT: &str = "You are a language tutor for game players. Explain the given word/phrase IN CONTEXT of the full sentence. Cover: contextual meaning, tone/register, and game-specific usage if any. Output ONLY the explanation in {{language}}. Keep it concise (2-4 sentences).";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ServicePreset { Deepseek, Lmstudio, Ollama, Custom, Local }

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ComputeMode { Gpu, Cpu }

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LocalModelConfig {
    pub model_path: String,
    pub compute: ComputeMode,
    pub context_length: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum AuthMode { None, Bearer }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionProfile {
    pub id: String,
    pub name: String,
    pub preset: ServicePreset,
    pub base_url: String,
    pub model: String,
    pub auth_mode: AuthMode,
    pub stream: bool,
    pub request_timeout_secs: u64,
    pub translation_prompt: String,
    pub lookup_prompt: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub local: Option<LocalModelConfig>,
}

impl Default for ConnectionProfile {
    fn default() -> Self {
        Self {
            id: "deepseek-default".into(), name: "DeepSeek".into(),
            preset: ServicePreset::Deepseek, base_url: "https://api.deepseek.com".into(),
            model: "deepseek-chat".into(), auth_mode: AuthMode::Bearer, stream: true,
            request_timeout_secs: 120, translation_prompt: TRANSLATION_PROMPT.into(),
            lookup_prompt: LOOKUP_PROMPT.into(), local: None,
        }
    }
}

impl ConnectionProfile {
    pub fn normalize(&mut self, require_model: bool) -> Result<(), String> {
        self.name = self.name.trim().to_string();
        self.model = self.model.trim().to_string();
        self.base_url = self.base_url.trim().trim_end_matches('/').to_string();
        if self.id.is_empty() || !self.id.bytes().all(|c| c.is_ascii_alphanumeric() || c == b'-' || c == b'_') {
            return Err("方案 ID 无效".into());
        }
        if self.name.is_empty() { return Err("请填写方案名称".into()); }
        if self.preset == ServicePreset::Local {
            let local = self.local.as_ref().ok_or("请选择本地模型文件")?;
            let path = Path::new(&local.model_path);
            if !path.is_absolute() || !path.extension().is_some_and(|e| e.eq_ignore_ascii_case("gguf")) {
                return Err("请选择完整的 GGUF 模型文件路径".into());
            }
            if !(512..=131072).contains(&local.context_length) { return Err("上下文长度必须为 512～131072".into()); }
            self.base_url.clear(); self.model = "stor-local".into(); self.auth_mode = AuthMode::None;
        } else {
        let url = reqwest::Url::parse(&self.base_url).map_err(|_| "请填写完整的 HTTP/HTTPS 基础地址")?;
        if !matches!(url.scheme(), "http" | "https") || url.host_str().is_none()
            || !url.username().is_empty() || url.password().is_some() || url.query().is_some() || url.fragment().is_some() {
            return Err("基础地址必须是 HTTP/HTTPS 地址，不能包含账号、密码、查询参数或片段".into());
        }
        if self.base_url.ends_with("/chat/completions") || self.base_url.ends_with("/models") {
            return Err("请填写基础地址，不要包含 /chat/completions 或 /models".into());
        }
        if require_model && self.model.is_empty() { return Err("请填写模型标识，或获取模型列表后选择".into()); }
        }
        if !(5..=600).contains(&self.request_timeout_secs) { return Err("请求超时必须为 5～600 秒".into()); }
        if self.translation_prompt.trim().is_empty() || self.lookup_prompt.trim().is_empty() {
            return Err("翻译和查词提示词不能为空".into());
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub hotkey: String,
    pub default_target_lang: String,
    pub ocr_language: String,
    pub freeze_frame_on_select: bool,
    pub enable_translation_cache: bool,
    pub popup_opacity: f64,
    pub deepseek_model: String,
    #[serde(default)]
    pub profiles: Vec<ConnectionProfile>,
    #[serde(default)]
    pub active_profile_id: String,
    #[serde(skip_deserializing, skip_serializing_if = "Option::is_none", rename = "configurationError")]
    pub load_error: Option<String>,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            hotkey: "Ctrl+Shift+T".to_string(),
            default_target_lang: "zh".to_string(),
            ocr_language: "auto".to_string(),
            freeze_frame_on_select: true,
            enable_translation_cache: true,
            popup_opacity: 0.95,
            deepseek_model: "deepseek-chat".to_string(),
            profiles: vec![ConnectionProfile::default()],
            active_profile_id: "deepseek-default".into(),
            load_error: None,
        }
    }
}

impl AppConfig {
    pub fn active_profile(&self) -> Result<&ConnectionProfile, String> {
        if let Some(error) = &self.load_error { return Err(format!("连接设置无效，请在设置中修正后保存：{error}")); }
        self.profiles.iter().find(|p| p.id == self.active_profile_id)
            .ok_or_else(|| "当前连接方案不存在，请在设置中重新选择".into())
    }

    pub fn normalize(&mut self) -> Result<(), String> {
        self.load_error = None;
        if self.profiles.is_empty() { return Err("至少保留一个连接方案".into()); }
        let mut ids = std::collections::HashSet::new();
        for profile in &mut self.profiles {
            profile.normalize(true).map_err(|e| format!("方案「{}」：{e}", profile.name))?;
            if !ids.insert(profile.id.clone()) { return Err("连接方案 ID 重复，请重新创建重复方案".into()); }
        }
        self.active_profile()?;
        Ok(())
    }
}

fn decode_config(content: &str) -> Result<AppConfig, serde_json::Error> {
    let value: serde_json::Value = serde_json::from_str(content)?;
    let legacy = value.get("profiles").is_none();
    let mut config: AppConfig = serde_json::from_value(value)?;
    // Only the old seven-field configuration has no profiles. Do not discard malformed new profiles.
    if legacy {
        config.profiles = vec![ConnectionProfile { model: config.deepseek_model.clone(), ..ConnectionProfile::default() }];
        config.active_profile_id = "deepseek-default".into();
    }
    if let Err(error) = config.normalize() { config.load_error = Some(error); }
    Ok(config)
}

pub fn config_path() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("STOR")
        .join("config.json")
}

pub fn load_config() -> AppConfig {
    let path = config_path();
    if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            return decode_config(&content).unwrap_or_else(|_| AppConfig {
                load_error: Some("配置文件格式无法解析，当前显示默认设置；原文件未改动，请检查后再保存".into()),
                ..AppConfig::default()
            });
        }
    }
    AppConfig::default()
}

pub fn save_config(config: &AppConfig) -> Result<(), String> {
    save_config_to(&config_path(), config)
}

pub(crate) fn save_config_to(path: &Path, config: &AppConfig) -> Result<(), String> {
    static NEXT_TEMP: AtomicU64 = AtomicU64::new(0);
    let content = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    let parent = path.parent().filter(|p| !p.as_os_str().is_empty()).unwrap_or_else(|| Path::new("."));
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    let nonce = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?.as_nanos();
    let temporary = parent.join(format!(".stor-config-{}-{nonce}-{}.tmp", std::process::id(), NEXT_TEMP.fetch_add(1, Ordering::Relaxed)));
    let mut file = fs::OpenOptions::new().write(true).create_new(true).open(&temporary).map_err(|e| e.to_string())?;
    let result = (|| {
        file.write_all(content.as_bytes()).map_err(|e| e.to_string())?;
        file.sync_all().map_err(|e| e.to_string())?;
        drop(file);
        let source = temporary.as_os_str().encode_wide().chain(Some(0)).collect::<Vec<_>>();
        let target = path.as_os_str().encode_wide().chain(Some(0)).collect::<Vec<_>>();
        // Same-volume replacement: a failed write never truncates the old config.
        unsafe { MoveFileExW(PCWSTR(source.as_ptr()), PCWSTR(target.as_ptr()), MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH) }
            .map_err(|e| e.to_string())
    })();
    if result.is_err() { let _ = fs::remove_file(&temporary); }
    result
}

pub struct ConfigState(pub Mutex<AppConfig>);

impl ConfigState {
    pub fn new() -> Self {
        Self(Mutex::new(load_config()))
    }
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;

    #[test]
    fn profiles_migrate_old_settings_without_losing_user_choices() {
        let json = r#"{"hotkey":"Ctrl+Shift+Y","defaultTargetLang":"ja","ocrLanguage":"auto","freezeFrameOnSelect":false,"enableTranslationCache":false,"popupOpacity":0.8,"deepseekModel":"deepseek-reasoner"}"#;
        let config = decode_config(json).unwrap();
        assert_eq!(config.hotkey, "Ctrl+Shift+Y");
        assert!(!config.freeze_frame_on_select);
        assert!(!config.enable_translation_cache);
        assert_eq!(config.active_profile().unwrap().model, "deepseek-reasoner");
        let new_json = serde_json::to_string(&config).unwrap();
        assert_eq!(decode_config(&new_json).unwrap().active_profile_id, "deepseek-default");
        assert!(!new_json.contains("apiKey"));
    }

    #[test]
    fn profiles_validate_and_preserve_invalid_new_data_for_correction() {
        let mut config = AppConfig::default();
        config.profiles[0].base_url = " http://127.0.0.1:1234/custom/v1/ ".into();
        config.normalize().unwrap();
        assert_eq!(config.profiles[0].base_url, "http://127.0.0.1:1234/custom/v1");
        config.profiles.push(config.profiles[0].clone());
        assert!(config.normalize().is_err());
        assert_eq!(decode_config(&serde_json::to_string(&config).unwrap()).unwrap().profiles.len(), 2);
        config.profiles.pop();
        config.profiles[0].base_url.push_str("/chat/completions");
        assert!(config.normalize().is_err());
    }

    #[test]
    fn local_profiles_persist_path_without_url_or_credentials() {
        let mut config = AppConfig::default();
        let p = &mut config.profiles[0];
        p.preset = ServicePreset::Local;
        p.local = Some(LocalModelConfig { model_path: r"D:\models\existing.gguf".into(), compute: ComputeMode::Gpu, context_length: 4096 });
        config.normalize().unwrap();
        let p = config.active_profile().unwrap();
        assert_eq!(p.auth_mode, AuthMode::None);
        assert!(p.base_url.is_empty());
        let roundtrip = decode_config(&serde_json::to_string(&config).unwrap()).unwrap();
        assert!(roundtrip.load_error.is_none());
        assert_eq!(p.local, roundtrip.active_profile().unwrap().local);
        config.profiles[0].local.as_mut().unwrap().model_path = "relative.gguf".into();
        assert!(config.normalize().is_err());
        let old = decode_config(&serde_json::to_string(&AppConfig::default()).unwrap()).unwrap();
        assert!(old.active_profile().unwrap().local.is_none());
    }

    pub struct TestDirectory(pub PathBuf);
    impl TestDirectory {
        pub fn new() -> Self {
            static NEXT: AtomicU64 = AtomicU64::new(0);
            let nonce=std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos();
            let path=std::env::temp_dir().join(format!("stor-config-test-{}-{nonce}-{}",std::process::id(),NEXT.fetch_add(1,Ordering::Relaxed)));
            fs::create_dir(&path).unwrap();Self(path)
        }
    }
    impl Drop for TestDirectory {fn drop(&mut self) {let _=fs::remove_dir_all(&self.0);}}

    #[test] fn config_atomic_replacement_preserves_json_fields() {
        let folder=TestDirectory::new();let path=folder.0.join("config.json");let original=AppConfig::default();
        save_config_to(&path,&original).unwrap();
        let updated=AppConfig {hotkey:"Ctrl+Shift+Y".into(), ..original};save_config_to(&path,&updated).unwrap();
        let loaded:AppConfig=serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
        assert_eq!(serde_json::to_value(&loaded).unwrap(),serde_json::to_value(&updated).unwrap());
        assert_eq!(fs::read_dir(&folder.0).unwrap().count(),1);
    }
    #[test] fn config_failed_replacement_keeps_original_bytes_and_cleans_temp_file() {
        let folder=TestDirectory::new();let path=folder.0.join("config.json");
        save_config_to(&path,&AppConfig::default()).unwrap();let original=fs::read(&path).unwrap();
        let mut permissions=fs::metadata(&path).unwrap().permissions();permissions.set_readonly(true);fs::set_permissions(&path,permissions).unwrap();
        let result=save_config_to(&path,&AppConfig {hotkey:"Ctrl+Shift+Y".into(),..AppConfig::default()});
        let mut permissions=fs::metadata(&path).unwrap().permissions();permissions.set_readonly(false);fs::set_permissions(&path,permissions).unwrap();
        assert!(result.is_err());assert_eq!(fs::read(&path).unwrap(),original);assert_eq!(fs::read_dir(&folder.0).unwrap().count(),1);
    }
}
