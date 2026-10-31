use crate::config::AppConfig;
use serde::Serialize;
use std::sync::Mutex;
use tauri_plugin_global_shortcut::{Modifiers, Shortcut};

#[derive(Clone, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HotkeyStatus {
    pub active_hotkey: Option<String>,
    pub error: Option<String>,
}

#[derive(Default)]
pub struct HotkeyState(pub Mutex<HotkeyStatus>);

pub trait HotkeyRegistry {
    fn register(&mut self, hotkey: &str) -> Result<(), String>;
    fn unregister(&mut self, hotkey: &str) -> Result<(), String>;
}

pub fn normalize(hotkey: &str) -> Result<String, String> {
    let key = hotkey.trim().parse::<Shortcut>().map_err(|e| format!("无效的快捷键: {e}"))?;
    let mut parts = Vec::new();
    for (modifier, label) in [(Modifiers::CONTROL, "Ctrl"), (Modifiers::SHIFT, "Shift"), (Modifiers::ALT, "Alt"), (Modifiers::SUPER, "Super")] {
        if key.mods.contains(modifier) { parts.push(label.to_string()); }
    }
    let code = key.key.to_string();
    parts.push(code.strip_prefix("Key").or_else(|| code.strip_prefix("Digit")).unwrap_or(&code).to_string());
    Ok(parts.join("+"))
}

pub fn initialize_hotkey(configured: &str, registry: &mut impl HotkeyRegistry) -> HotkeyStatus {
    let configured_key = normalize(configured);
    let attempt = configured_key.as_ref().map_err(Clone::clone)
        .and_then(|key| registry.register(key));
    match attempt {
        Ok(()) => HotkeyStatus { active_hotkey: configured_key.ok(), error: None },
        Err(error) => {
            let fallback = normalize(&AppConfig::default().hotkey).expect("valid default hotkey");
            if configured_key.as_ref().ok() != Some(&fallback) {
                match registry.register(&fallback) {
                    Ok(()) => return HotkeyStatus {
                        active_hotkey: Some(fallback),
                        error: Some(format!("配置的快捷键不可用: {error}；本次临时使用 Ctrl+Shift+T，原配置未覆盖。")),
                    },
                    Err(fallback_error) => return HotkeyStatus {
                        active_hotkey: None,
                        error: Some(format!("配置的快捷键不可用: {error}；默认快捷键也不可用: {fallback_error}。请在设置中修改，仍可通过托盘使用软件。")),
                    },
                }
            }
            HotkeyStatus { active_hotkey: None, error: Some(format!("快捷键不可用: {error}。请在设置中修改，仍可通过托盘使用软件。")) }
        }
    }
}

pub fn save_settings(
    current: &mut AppConfig,
    status: &mut HotkeyStatus,
    mut candidate: AppConfig,
    registry: &mut impl HotkeyRegistry,
    persist: &mut impl FnMut(&AppConfig) -> Result<(), String>,
) -> Result<(), String> {
    let result = (|| {
        candidate.hotkey = normalize(&candidate.hotkey)?;
        let changed = status.active_hotkey.as_deref() != Some(&candidate.hotkey);
        if changed { registry.register(&candidate.hotkey)?; }
        if let Err(error) = persist(&candidate) {
            let mut failures = vec![format!("保存设置失败: {error}")];
            if changed {
                if let Err(rollback) = registry.unregister(&candidate.hotkey) {
                    failures.push(format!("回滚新快捷键失败: {rollback}"));
                }
            }
            return Err(failures.join("；"));
        }
        if changed {
            if let Some(old) = &status.active_hotkey {
                if let Err(error) = registry.unregister(old) {
                    let mut failures = vec![format!("注销旧快捷键失败: {error}")];
                    // Attempt both compensations even when one of them fails.
                    if let Err(rollback) = persist(current) {
                        failures.push(format!("回滚配置文件失败: {rollback}"));
                    }
                    if let Err(rollback) = registry.unregister(&candidate.hotkey) {
                        failures.push(format!("回滚新快捷键失败: {rollback}"));
                    }
                    return Err(failures.join("；"));
                }
            }
        }
        status.active_hotkey = Some(candidate.hotkey.clone());
        *current = candidate;
        Ok(())
    })();
    status.error = result.as_ref().err().cloned();
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::BTreeSet;

    #[derive(Default)]
    struct Registry {
        active: BTreeSet<String>,
        reject_register: BTreeSet<String>,
        reject_unregister: BTreeSet<String>,
        calls: Vec<String>,
    }
    impl HotkeyRegistry for Registry {
        fn register(&mut self, key: &str) -> Result<(), String> {
            let key = normalize(key)?;
            self.calls.push(format!("register:{key}"));
            if self.reject_register.contains(&key) || !self.active.insert(key) { return Err("快捷键已被占用".into()); }
            Ok(())
        }
        fn unregister(&mut self, key: &str) -> Result<(), String> {
            let key = normalize(key)?;
            self.calls.push(format!("unregister:{key}"));
            if self.reject_unregister.contains(&key) { return Err("无法注销旧快捷键".into()); }
            self.active.remove(&key);
            Ok(())
        }
    }
    fn initial() -> (AppConfig, HotkeyStatus, Registry) {
        let config = AppConfig::default();
        let old = normalize(&config.hotkey).unwrap();
        let status = HotkeyStatus {active_hotkey: Some(old.clone()),error:None};
        let mut registry = Registry::default(); registry.active.insert(old);
        (config,status,registry)
    }
    fn candidate(key: &str) -> AppConfig { AppConfig {hotkey:key.into(), ..AppConfig::default()} }
    fn same_config(a: &AppConfig,b: &AppConfig) { assert_eq!(serde_json::to_value(a).unwrap(),serde_json::to_value(b).unwrap()); }

    #[test] fn hotkey_invalid_input_keeps_disk_memory_and_binding() {
        let (mut current,mut status,mut registry)=initial(); let old=current.clone(); let mut disk=old.clone();
        assert!(save_settings(&mut current,&mut status,candidate("NotAValidHotkey"),&mut registry,&mut |cfg| {disk=cfg.clone();Ok(())}).is_err());
        same_config(&current,&old); same_config(&disk,&old);
        assert_eq!(registry.active,BTreeSet::from([normalize(&old.hotkey).unwrap()])); assert!(registry.calls.is_empty());
    }
    #[test] fn hotkey_conflict_keeps_old_binding_and_config() {
        let (mut current,mut status,mut registry)=initial(); let old=current.clone(); let mut disk=old.clone();
        registry.reject_register.insert(normalize("Ctrl+Shift+Y").unwrap());
        assert!(save_settings(&mut current,&mut status,candidate("Ctrl+Shift+Y"),&mut registry,&mut |cfg| {disk=cfg.clone();Ok(())}).is_err());
        same_config(&current,&old); same_config(&disk,&old); assert!(registry.active.contains(&normalize(&old.hotkey).unwrap()));
    }
    #[test] fn hotkey_write_failure_removes_candidate_and_keeps_old() {
        let (mut current,mut status,mut registry)=initial();let old=current.clone();
        assert!(save_settings(&mut current,&mut status,candidate("Ctrl+Shift+Y"),&mut registry,&mut |_| Err("disk failure".into())).is_err());
        same_config(&current,&old);assert_eq!(registry.active,BTreeSet::from([normalize(&old.hotkey).unwrap()]));
    }
    #[test] fn hotkey_equivalent_binding_does_not_reregister() {
        let (mut current,mut status,mut registry)=initial();
        save_settings(&mut current,&mut status,candidate("Shift+Control+KeyT"),&mut registry,&mut |_| Ok(())).unwrap();
        assert!(registry.calls.is_empty()); assert_eq!(normalize(&current.hotkey).unwrap(),status.active_hotkey.unwrap());
    }
    #[test] fn hotkey_success_commits_new_binding_and_config() {
        let (mut current,mut status,mut registry)=initial();let mut disk=current.clone();let new=normalize("Ctrl+Shift+Y").unwrap();
        save_settings(&mut current,&mut status,candidate("Ctrl+Shift+Y"),&mut registry,&mut |cfg| {disk=cfg.clone();Ok(())}).unwrap();
        assert_eq!(registry.active,BTreeSet::from([new.clone()]));assert_eq!(current.hotkey,new);same_config(&disk,&current);assert!(status.error.is_none());
    }
    #[test] fn hotkey_unregister_failure_rolls_back_disk_and_candidate() {
        let (mut current,mut status,mut registry)=initial();let old=current.clone();let mut disk=old.clone();
        registry.reject_unregister.insert(normalize(&old.hotkey).unwrap());
        assert!(save_settings(&mut current,&mut status,candidate("Ctrl+Shift+Y"),&mut registry,&mut |cfg| {disk=cfg.clone();Ok(())}).is_err());
        same_config(&current,&old);same_config(&disk,&old);assert_eq!(registry.active,BTreeSet::from([normalize(&old.hotkey).unwrap()]));
    }
    #[test] fn hotkey_rollback_failure_is_reported() {
        let (mut current,mut status,mut registry)=initial();let old=normalize(&current.hotkey).unwrap();let new=normalize("Ctrl+Shift+Y").unwrap();
        registry.reject_unregister.extend([old,new]);
        let error=save_settings(&mut current,&mut status,candidate("Ctrl+Shift+Y"),&mut registry,&mut |_| Ok(())).unwrap_err();
        assert!(error.contains("回滚"));assert_eq!(status.error.as_deref(),Some(error.as_str()));
    }
    #[test] fn hotkey_disk_rollback_failure_still_removes_new_binding() {
        let (mut current,mut status,mut registry)=initial();let old=current.clone();let mut writes=0;
        registry.reject_unregister.insert(normalize(&old.hotkey).unwrap());
        let error=save_settings(&mut current,&mut status,candidate("Ctrl+Shift+Y"),&mut registry,&mut |_| {writes+=1;if writes==2 {Err("disk rollback failed".into())} else {Ok(())}}).unwrap_err();
        assert!(error.contains("回滚配置文件失败"));assert_eq!(registry.active,BTreeSet::from([normalize(&old.hotkey).unwrap()]));same_config(&current,&old);
    }
    #[test] fn hotkey_failure_keeps_real_temporary_config_unchanged() {
        let folder=crate::config::tests::TestDirectory::new();let path=folder.0.join("config.json");
        let (mut current,mut status,mut registry)=initial();let old=current.clone();
        crate::config::save_config_to(&path,&old).unwrap();let original=std::fs::read(&path).unwrap();
        registry.reject_register.insert(normalize("Ctrl+Shift+Y").unwrap());
        assert!(save_settings(&mut current,&mut status,candidate("Ctrl+Shift+Y"),&mut registry,&mut |cfg|crate::config::save_config_to(&path,cfg)).is_err());
        assert_eq!(std::fs::read(&path).unwrap(),original);same_config(&current,&old);
        registry.reject_register.clear();registry.reject_unregister.insert(normalize(&old.hotkey).unwrap());
        assert!(save_settings(&mut current,&mut status,candidate("Ctrl+Shift+Y"),&mut registry,&mut |cfg|crate::config::save_config_to(&path,cfg)).is_err());
        assert_eq!(std::fs::read(&path).unwrap(),original);same_config(&current,&old);
    }
    #[test] fn hotkey_same_binding_write_failure_keeps_registration() {
        let (mut current,mut status,mut registry)=initial();let old=current.clone();
        assert!(save_settings(&mut current,&mut status,candidate("Ctrl+Shift+T"),&mut registry,&mut |_| Err("disk failure".into())).is_err());
        assert!(registry.calls.is_empty());same_config(&current,&old);
    }
    #[test] fn hotkey_startup_invalid_uses_default_without_writing_config() {
        let mut registry=Registry::default();let status=initialize_hotkey("invalid",&mut registry);
        assert_eq!(status.active_hotkey,Some(normalize(&AppConfig::default().hotkey).unwrap()));assert!(status.error.is_some());
    }
    #[test] fn hotkey_startup_conflict_uses_default() {
        let mut registry=Registry::default();registry.reject_register.insert(normalize("Ctrl+Shift+Y").unwrap());
        let status=initialize_hotkey("Ctrl+Shift+Y",&mut registry);assert_eq!(status.active_hotkey,Some(normalize(&AppConfig::default().hotkey).unwrap()));assert!(status.error.is_some());
    }
    #[test] fn hotkey_startup_default_conflict_remains_usable_without_binding() {
        let mut registry=Registry::default();registry.reject_register.insert(normalize(&AppConfig::default().hotkey).unwrap());
        let status=initialize_hotkey("invalid",&mut registry);assert!(status.active_hotkey.is_none());assert!(status.error.is_some());
    }
}
