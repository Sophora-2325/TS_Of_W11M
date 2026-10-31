use lru::LruCache;
use std::num::NonZeroUsize;
use std::sync::Mutex;
use crate::config::ConnectionProfile;
use crate::translate::Lang;

pub struct TranslationCache {
    inner: Mutex<LruCache<String, String>>,
}

impl TranslationCache {
    pub fn new(capacity: usize) -> Self {
        Self {
            inner: Mutex::new(LruCache::new(
                NonZeroUsize::new(capacity.max(1)).unwrap(),
            )),
        }
    }

    pub fn get(&self, key: &str) -> Option<String> {
        self.inner.lock().ok()?.get(key).cloned()
    }

    pub fn put(&self, key: String, value: String) {
        if let Ok(mut cache) = self.inner.lock() {
            cache.put(key, value);
        }
    }

    pub fn cache_key(profile: &ConnectionProfile, text: &str, target_lang: Lang) -> String {
        serde_json::json!(["translation", profile.id, profile.base_url, profile.model, profile.local, crate::local_model::ENGINE_VERSION, profile.translation_prompt, target_lang, text]).to_string()
    }

    pub fn lookup_cache_key(profile: &ConnectionProfile, sentence: &str, word: &str, explain_lang: Lang) -> String {
        serde_json::json!(["lookup", profile.id, profile.base_url, profile.model, profile.local, crate::local_model::ENGINE_VERSION, profile.lookup_prompt, explain_lang, sentence, word]).to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn cache_isolates_profiles_models_prompts_and_delimiters() {
        let mut p = ConnectionProfile::default();
        let key = TranslationCache::cache_key(&p, "hello", Lang::Zh);
        p.id = "other".into();
        assert_ne!(key, TranslationCache::cache_key(&p, "hello", Lang::Zh));
        p = ConnectionProfile::default(); p.model = "local".into();
        assert_ne!(key, TranslationCache::cache_key(&p, "hello", Lang::Zh));
        p = ConnectionProfile::default(); p.translation_prompt.push('!');
        assert_ne!(key, TranslationCache::cache_key(&p, "hello", Lang::Zh));
        assert_ne!(TranslationCache::lookup_cache_key(&p, "a::b", "c", Lang::Zh), TranslationCache::lookup_cache_key(&p, "a", "b::c", Lang::Zh));
    }

    #[test]
    fn local_cache_changes_when_model_file_changes() {
        use crate::config::{ComputeMode, LocalModelConfig, ServicePreset};
        let mut p = ConnectionProfile { preset: ServicePreset::Local,
            local: Some(LocalModelConfig { model_path: r"D:\one.gguf".into(), compute: ComputeMode::Gpu, context_length: 4096 }), ..Default::default() };
        p.normalize(true).unwrap();
        let translation = TranslationCache::cache_key(&p, "hi", Lang::Zh);
        let lookup = TranslationCache::lookup_cache_key(&p, "hi", "hi", Lang::Zh);
        p.local.as_mut().unwrap().model_path = r"D:\two.gguf".into();
        assert_ne!(translation, TranslationCache::cache_key(&p, "hi", Lang::Zh));
        assert_ne!(lookup, TranslationCache::lookup_cache_key(&p, "hi", "hi", Lang::Zh));
    }
}
