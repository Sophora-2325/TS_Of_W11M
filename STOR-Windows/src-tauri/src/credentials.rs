use crate::config::{ConnectionProfile, KEYRING_SERVICE, KEYRING_USER};
use serde::{Deserialize, Serialize};

#[derive(Clone, Default, Deserialize)]
#[serde(tag = "action", rename_all = "lowercase")]
pub enum KeyEdit {
    #[default]
    Keep,
    Set { value: String },
    Clear,
    Reuse,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CredentialEdit {
    pub profile_id: String,
    #[serde(flatten)]
    pub edit: KeyEdit,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyStatus {
    pub profile_id: String,
    pub present: bool,
    pub error: Option<String>,
}

fn entry(id: &str) -> Result<keyring::Entry, String> {
    let user = if id == "deepseek-default" { KEYRING_USER.to_string() } else { format!("profile:{id}") };
    keyring::Entry::new(KEYRING_SERVICE, &user).map_err(|_| "无法打开 Windows 凭据管理器".into())
}

pub fn get(id: &str) -> Result<Option<String>, String> {
    match entry(id)?.get_password() {
        Ok(key) => Ok(Some(key).filter(|s| !s.trim().is_empty())),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(_) => Err("无法读取 Windows 凭据管理器中的密钥".into()),
    }
}

pub fn write(id: &str, key: Option<&str>) -> Result<(), String> {
    let entry = entry(id)?;
    match key {
        Some(key) => entry.set_password(key).map_err(|_| "无法保存 API Key".into()),
        None => match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(_) => Err("无法清除 API Key".into()),
        },
    }
}

// Shared by draft diagnostics and saving: a changed endpoint never silently inherits a secret.
pub fn resolve(edit: &KeyEdit, saved: Option<&ConnectionProfile>, draft: &ConnectionProfile, key: Option<String>) -> Result<Option<String>, String> {
    match edit {
        KeyEdit::Clear => Ok(None),
        KeyEdit::Set { value } => {
            let value = value.trim();
            if value.is_empty() { Err("新密钥不能为空；如需删除请使用清除密钥".into()) } else { Ok(Some(value.into())) }
        }
        KeyEdit::Reuse => Ok(key),
        KeyEdit::Keep => {
            if key.is_some() && saved.is_some_and(|p| p.base_url.trim().trim_end_matches('/') != draft.base_url) {
                Err("服务地址已改变，请重新输入密钥、清除密钥，或明确选择沿用原密钥".into())
            } else { Ok(key) }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn credential_drafts_respect_clear_replace_and_changed_endpoint() {
        let saved = ConnectionProfile::default();
        let mut draft = saved.clone();
        let key = Some("old-secret".into());
        assert_eq!(resolve(&KeyEdit::Clear, Some(&saved), &draft, key.clone()).unwrap(), None);
        assert_eq!(resolve(&KeyEdit::Set { value: " new ".into() }, Some(&saved), &draft, key.clone()).unwrap().as_deref(), Some("new"));
        draft.base_url = "http://localhost:1234/v1".into();
        assert!(resolve(&KeyEdit::Keep, Some(&saved), &draft, key.clone()).is_err());
        assert_eq!(resolve(&KeyEdit::Reuse, Some(&saved), &draft, key).unwrap().as_deref(), Some("old-secret"));
    }
}
