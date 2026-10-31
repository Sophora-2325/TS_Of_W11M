pub mod client;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Lang {
    Zh,
    En,
    Ja,
}

impl Lang {
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "zh" | "zh-cn" | "chinese" | "中文" => Some(Lang::Zh),
            "en" | "english" | "英文" => Some(Lang::En),
            "ja" | "jp" | "japanese" | "日本語" => Some(Lang::Ja),
            _ => None,
        }
    }

    pub fn display_name(&self) -> &'static str {
        match self {
            Lang::Zh => "中文",
            Lang::En => "English",
            Lang::Ja => "日本語",
        }
    }

    pub fn prompt_name(&self) -> &'static str {
        match self {
            Lang::Zh => "Simplified Chinese",
            Lang::En => "English",
            Lang::Ja => "Japanese",
        }
    }
}

pub use client::CompatClient;
