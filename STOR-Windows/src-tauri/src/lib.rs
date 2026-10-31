mod cache;
mod capture;
mod config;
mod credentials;
mod hotkey;
mod local_download;
mod local_model;
mod ocr;
mod overlay;
mod process;
mod translate;
mod tray;

use cache::TranslationCache;
use capture::screen::{work_area_at_cursor, work_area_at_point, MonitorSnapshotCache, WorkArea};
use config::{AppConfig, ConfigState, ConnectionProfile, AuthMode};
use credentials::{CredentialEdit, KeyEdit, KeyStatus};
use hotkey::{HotkeyRegistry, HotkeyState, HotkeyStatus};
use ocr::{OcrService, OcrStatus};
use overlay::{
    ack_overlay_frontend, ack_overlay_image, close_overlay, get_capture_trace, get_pending_overlay,
    get_prepare_error, reopen_overlay, show_popup_with_ocr,
};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::{
    AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, PhysicalSize, Position, RunEvent,
    State, WebviewUrl, WebviewWindowBuilder, WindowEvent,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};
use translate::{CompatClient, Lang};
use local_model::LocalModelService;
use tauri_plugin_dialog::DialogExt;

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OcrResult {
    text: String,
    default_target_lang: String,
}

pub struct PendingOcr(pub Mutex<Option<OcrResult>>);

pub struct ExitState(pub AtomicBool);

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct TextChunk {
    request_id: u64,
    text: String,
}

#[derive(Clone, serde::Serialize)]
struct TranslateResult {
    translation: String,
    cached: bool,
}

#[derive(Clone, serde::Serialize)]
struct LookupResult {
    explanation: String,
    cached: bool,
}

#[tauri::command]
fn get_app_config(state: State<'_, ConfigState>) -> AppConfig {
    state.0.lock().unwrap().clone()
}

#[tauri::command]
fn set_app_config(app: AppHandle, config: AppConfig, state: State<'_, ConfigState>, hotkeys: State<'_, HotkeyState>) -> Result<(), String> {
    update_settings(&app, config, &state, &hotkeys)
}

#[tauri::command]
fn set_app_config_and_hotkey(
    app: AppHandle,
    config: AppConfig,
    state: State<'_, ConfigState>,
    hotkeys: State<'_, HotkeyState>,
) -> Result<(), String> {
    update_settings(&app, config, &state, &hotkeys)
}

fn update_settings(app: &AppHandle, candidate: AppConfig, state: &ConfigState, hotkeys: &HotkeyState) -> Result<(), String> {
    save_connection_settings(app, candidate, vec![], state, hotkeys)
}

fn restore_credentials(previous: &[(String, Option<String>)]) -> Vec<String> {
    previous.iter().rev().filter_map(|(id, key)| credentials::write(id, key.as_deref()).err()
        .map(|e| format!("恢复方案 {id} 的密钥失败：{e}"))).collect()
}

fn save_connection_settings(app: &AppHandle, mut candidate: AppConfig, edits: Vec<CredentialEdit>, state: &ConfigState, hotkeys: &HotkeyState) -> Result<(), String> {
    candidate.normalize()?;
    candidate.hotkey = hotkey::normalize(&candidate.hotkey)?;
    // Serialize changes without holding ConfigState across native registry calls.
    let mut status = hotkeys.0.lock().map_err(|e| e.to_string())?;
    let mut current = state.0.lock().map_err(|e| e.to_string())?.clone();
    let mut changes = std::collections::HashMap::new();
    for item in edits {
        if !candidate.profiles.iter().any(|p| p.id == item.profile_id) { return Err("密钥变更对应的方案不存在".into()); }
        if changes.insert(item.profile_id, item.edit).is_some() { return Err("方案密钥变更重复".into()); }
    }
    let mut pending = Vec::new();
    for profile in &candidate.profiles {
        if profile.preset == config::ServicePreset::Local { continue; }
        let old = current.profiles.iter().find(|p| p.id == profile.id);
        let edit = changes.remove(&profile.id).unwrap_or_default();
        if matches!(edit, KeyEdit::Keep) && old.is_none_or(|p| p.base_url == profile.base_url) { continue; }
        let previous = credentials::get(&profile.id)?;
        let next = credentials::resolve(&edit, old, profile, previous.clone())?;
        if previous != next { pending.push((profile.id.clone(), previous, next)); }
    }
    for profile in &current.profiles {
        if !candidate.profiles.iter().any(|p| p.id == profile.id) {
            let previous = credentials::get(&profile.id)?;
            if previous.is_some() { pending.push((profile.id.clone(), previous, None)); }
        }
    }
    let mut applied = Vec::new();
    for (id, previous, next) in pending {
        if let Err(error) = credentials::write(&id, next.as_deref()) {
            let mut failures = vec![error]; failures.extend(restore_credentials(&applied));
            return Err(failures.join("；"));
        }
        applied.push((id, previous));
    }
    if let Err(error) = hotkey::save_settings(&mut current, &mut status, candidate, &mut NativeHotkeys(app), &mut config::save_config) {
        let mut failures = vec![error]; failures.extend(restore_credentials(&applied));
        return Err(failures.join("；"));
    }
    app.state::<LocalModelService>().reconcile(app.clone(), current.active_profile()?);
    *state.0.lock().map_err(|e| e.to_string())? = current;
    Ok(())
}

#[tauri::command]
fn save_settings(app: AppHandle, config: AppConfig, credentials: Vec<CredentialEdit>, state: State<'_, ConfigState>, hotkeys: State<'_, HotkeyState>) -> Result<AppConfig, String> {
    save_connection_settings(&app, config, credentials, &state, &hotkeys)?;
    Ok(state.0.lock().unwrap().clone())
}

#[tauri::command]
fn get_service_defaults() -> ConnectionProfile { ConnectionProfile::default() }

#[tauri::command]
fn get_credential_status(state: State<'_, ConfigState>) -> Vec<KeyStatus> {
    let config = state.0.lock().unwrap().clone();
    config.profiles.iter().map(|p| match if p.preset == config::ServicePreset::Local { Ok(None) } else { credentials::get(&p.id) } {
        Ok(key) => KeyStatus { profile_id: p.id.clone(), present: key.is_some(), error: None },
        Err(error) => KeyStatus { profile_id: p.id.clone(), present: false, error: Some(error) },
    }).collect()
}

fn draft_client(mut profile: ConnectionProfile, key_edit: KeyEdit, state: &ConfigState, require_model: bool) -> Result<CompatClient, String> {
    profile.normalize(require_model)?;
    let config = state.0.lock().unwrap().clone();
    let saved = config.profiles.iter().find(|p| p.id == profile.id);
    let key = if profile.auth_mode == AuthMode::None { None } else {
        let key = match key_edit { KeyEdit::Clear | KeyEdit::Set { .. } => None, _ => {
            if saved.is_some() { credentials::get(&profile.id)? } else { None }
        }};
        credentials::resolve(&key_edit, saved, &profile, key)?
    };
    CompatClient::new(profile, key)
}

#[tauri::command]
async fn list_models(profile: ConnectionProfile, key_edit: KeyEdit, state: State<'_, ConfigState>) -> Result<Vec<String>, String> {
    if profile.preset == config::ServicePreset::Local { return Err("本地 GGUF 方案请使用模型文件选择，不需要获取 API 模型列表".into()); }
    draft_client(profile, key_edit, &state, false)?.list_models().await
}

#[tauri::command]
async fn test_generation(app: AppHandle, mut profile: ConnectionProfile, key_edit: KeyEdit, state: State<'_, ConfigState>, local: State<'_, LocalModelService>) -> Result<translate::client::GenerationTest, String> {
    if profile.preset == config::ServicePreset::Local {
        profile.normalize(true)?;
        let lease = local.acquire(Some(&app), profile).await?;
        return CompatClient::new(lease.profile.clone(), None)?.test_generation().await;
    }
    draft_client(profile, key_edit, &state, true)?.test_generation().await
}

#[tauri::command]
fn get_local_model_status(local: State<'_, LocalModelService>) -> local_model::LocalStatus { local.status() }

#[tauri::command]
async fn choose_local_model(app: AppHandle) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let selected = app.dialog().file().add_filter("GGUF 模型", &["gguf"]).blocking_pick_file();
        selected.map(|file| {
            let path = file.into_path().map_err(|e| e.to_string())?;
            local_download::validate_model(&path)?;
            Ok(path.to_string_lossy().into_owned())
        }).transpose()
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
async fn choose_model_directory(app: AppHandle) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        app.dialog().file().blocking_pick_folder().map(|file| file.into_path()
            .map(|p| p.to_string_lossy().into_owned()).map_err(|e| e.to_string())).transpose()
    }).await.map_err(|e| e.to_string())?
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct ModelDownloadInfo { catalog: local_download::Catalog, directory: String, existing: Vec<String> }

#[tauri::command]
fn get_model_download_info(directory: Option<String>) -> Result<ModelDownloadInfo, String> {
    let directory = directory.map(std::path::PathBuf::from).unwrap_or_else(|| local_download::data_directory().join("models"));
    if !directory.is_absolute() { return Err("请选择完整的模型保存目录".into()); }
    let catalog = local_download::catalog();
    let existing = catalog.models.iter().filter(|a| directory.join(&a.file_name).is_file()).map(|a| a.id.clone()).collect();
    Ok(ModelDownloadInfo { catalog, directory: directory.to_string_lossy().into_owned(), existing })
}

#[tauri::command]
async fn download_local_model(app: AppHandle, model_id: String, directory: String, reuse: bool, local: State<'_, LocalModelService>) -> Result<String, String> {
    local.download_model(Some(&app), model_id, directory, reuse).await
}

#[tauri::command]
async fn install_local_engine(app: AppHandle, local: State<'_, LocalModelService>) -> Result<(), String> {
    local.install_engine(Some(&app)).await.map(|_| ())
}

#[tauri::command]
async fn remove_local_engine(app: AppHandle, local: State<'_, LocalModelService>) -> Result<(), String> {
    local.remove_engine(Some(&app)).await
}

#[tauri::command]
async fn redownload_local_engine(app: AppHandle, local: State<'_, LocalModelService>) -> Result<(), String> {
    local.redownload_engine(Some(&app)).await
}

#[tauri::command]
fn get_hotkey_status(state: State<'_, HotkeyState>) -> HotkeyStatus {
    state.0.lock().unwrap().clone()
}

#[tauri::command]
fn get_ocr_status(state: State<'_, OcrService>) -> OcrStatus {
    state.status()
}

#[tauri::command]
fn check_api_key(state: State<'_, ConfigState>) -> bool {
    state.0.lock().unwrap().active_profile().ok().filter(|p| p.preset != config::ServicePreset::Local)
        .and_then(|p| credentials::get(&p.id).ok().flatten()).is_some()
}

#[tauri::command]
async fn translate_text_stream(
    app: AppHandle,
    text: String,
    target_lang: String,
    request_id: u64,
    state: State<'_, ConfigState>,
    cache: State<'_, TranslationCache>,
    local: State<'_, LocalModelService>,
) -> Result<TranslateResult, String> {
    let trimmed = text.trim().to_string();
    if trimmed.is_empty() {
        return Err("原文为空".to_string());
    }

    let target = Lang::from_str(&target_lang).ok_or_else(|| "不支持的目标语言".to_string())?;
    let config = state.0.lock().unwrap().clone();
    let profile = config.active_profile()?.clone();
    if profile.preset == config::ServicePreset::Local { local.check_enabled()?; }
    let cache_key = TranslationCache::cache_key(&profile, &trimmed, target);

    if config.enable_translation_cache {
        if let Some(cached) = cache.get(&cache_key) {
            let _ = app.emit(
                "translation-chunk",
                TextChunk {
                    request_id,
                    text: cached.clone(),
                },
            );
            return Ok(TranslateResult {
                translation: cached,
                cached: true,
            });
        }
    }

    let lease = if profile.preset == config::ServicePreset::Local { Some(local.acquire(Some(&app), profile.clone()).await?) } else { None };
    let key = if profile.preset != config::ServicePreset::Local && profile.auth_mode == AuthMode::Bearer { credentials::get(&profile.id)? } else { None };
    let translator = CompatClient::new(lease.as_ref().map(|l| l.profile.clone()).unwrap_or(profile), key)?;
    let app_clone = app.clone();

    let translation = translator
        .translate_stream(&trimmed, target, move |chunk| {
            let _ = app_clone.emit(
                "translation-chunk",
                TextChunk {
                    request_id,
                    text: chunk,
                },
            );
        })
        .await?;

    if config.enable_translation_cache {
        cache.put(cache_key, translation.clone());
    }

    Ok(TranslateResult {
        translation,
        cached: false,
    })
}

#[tauri::command]
async fn lookup_word_in_context(
    app: AppHandle,
    sentence: String,
    word: String,
    explain_lang: String,
    request_id: u64,
    state: State<'_, ConfigState>,
    cache: State<'_, TranslationCache>,
    local: State<'_, LocalModelService>,
) -> Result<LookupResult, String> {
    let sentence_trimmed = sentence.trim().to_string();
    let word_trimmed = word.trim().to_string();

    if sentence_trimmed.is_empty() {
        return Err("原文句子为空".to_string());
    }
    if word_trimmed.is_empty() {
        return Err("请先选中要查询的词语".to_string());
    }

    let explain = Lang::from_str(&explain_lang).ok_or_else(|| "不支持的解释语言".to_string())?;
    let config = state.0.lock().unwrap().clone();
    let profile = config.active_profile()?.clone();
    if profile.preset == config::ServicePreset::Local { local.check_enabled()?; }
    let cache_key = TranslationCache::lookup_cache_key(
        &profile,
        &sentence_trimmed,
        &word_trimmed,
        explain,
    );

    if config.enable_translation_cache {
        if let Some(cached) = cache.get(&cache_key) {
            let _ = app.emit(
                "word-lookup-chunk",
                TextChunk {
                    request_id,
                    text: cached.clone(),
                },
            );
            return Ok(LookupResult {
                explanation: cached,
                cached: true,
            });
        }
    }

    let lease = if profile.preset == config::ServicePreset::Local { Some(local.acquire(Some(&app), profile.clone()).await?) } else { None };
    let key = if profile.preset != config::ServicePreset::Local && profile.auth_mode == AuthMode::Bearer { credentials::get(&profile.id)? } else { None };
    let translator = CompatClient::new(lease.as_ref().map(|l| l.profile.clone()).unwrap_or(profile), key)?;
    let app_clone = app.clone();

    let explanation = translator
        .explain_word_in_context_stream(
            &sentence_trimmed,
            &word_trimmed,
            explain,
            move |chunk| {
                let _ = app_clone.emit(
                    "word-lookup-chunk",
                    TextChunk {
                        request_id,
                        text: chunk,
                    },
                );
            },
        )
        .await?;

    if config.enable_translation_cache {
        cache.put(cache_key, explanation.clone());
    }

    Ok(LookupResult {
        explanation,
        cached: false,
    })
}

#[tauri::command]
fn get_pending_ocr(state: State<'_, PendingOcr>) -> Option<OcrResult> {
    state.0.lock().unwrap().clone()
}

const POPUP_WIDTH: f64 = 560.0;
const POPUP_HEIGHT: f64 = 820.0;
const SETTINGS_WIDTH: f64 = 800.0;
const SETTINGS_HEIGHT: f64 = 820.0;
const WINDOW_MARGIN: f64 = 12.0;

fn fit_on_area(area: WorkArea, preferred_w: f64, preferred_h: f64) -> (f64, f64, f64, f64) {
    let scale = area.scale.max(1.0);
    let area_w = area.width as f64 / scale;
    let area_h = area.height as f64 / scale;
    let margin = WINDOW_MARGIN.min(area_w / 10.0).min(area_h / 10.0);
    let width = preferred_w.min((area_w - margin * 2.0).max(1.0));
    let height = preferred_h.min((area_h - margin * 2.0).max(1.0));
    let x = area.x as f64 / scale + (area_w - width) / 2.0;
    let y = area.y as f64 / scale + (area_h - height) / 2.0;
    (width, height, x, y)
}

fn clamp_on_area(area: WorkArea, x: f64, y: f64, width: f64, height: f64) -> (f64, f64) {
    let scale = area.scale.max(1.0);
    let left = area.x as f64 / scale;
    let top = area.y as f64 / scale;
    let right = left + area.width as f64 / scale;
    let bottom = top + area.height as f64 / scale;
    (
        x.max(left).min((right - width).max(left)),
        y.max(top).min((bottom - height).max(top)),
    )
}

fn create_popup_window(app: &AppHandle, area: WorkArea, pos_x: f64, pos_y: f64) -> Result<(), String> {
    let (width, height, _, _) = fit_on_area(area, POPUP_WIDTH, POPUP_HEIGHT);
    let (x, y) = clamp_on_area(area, pos_x, pos_y, width, height);
    WebviewWindowBuilder::new(app, "popup", WebviewUrl::App("index.html".into()))
        .title("STOR 翻译")
        .inner_size(width, height)
        .min_inner_size(width.min(360.0), height.min(480.0))
        .decorations(false)
        .transparent(true)
        .shadow(true)
        .always_on_top(true)
        .resizable(true)
        .focused(true)
        .position(x, y)
        .build()
        .map_err(|e| format!("无法创建翻译窗口: {e}"))?;
    Ok(())
}

fn place_settings_window(app: &AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    let (width, height, x, y) = fit_on_area(work_area_at_cursor(), SETTINGS_WIDTH, SETTINGS_HEIGHT);
    let _ = window.set_size(LogicalSize::new(width, height));
    let _ = window.set_position(LogicalPosition::new(x, y));
}

pub fn open_manual_popup(app: AppHandle, config: &AppConfig) {
    if let Some(window) = app.get_webview_window("popup") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
        return;
    }

    let payload = OcrResult {
        text: String::new(),
        default_target_lang: config.default_target_lang.clone(),
    };

    if let Some(pending) = app.try_state::<PendingOcr>() {
        *pending.0.lock().unwrap() = Some(payload.clone());
    }

    let area = work_area_at_cursor();
    let (_, _, pos_x, pos_y) = fit_on_area(area, POPUP_WIDTH, POPUP_HEIGHT);
    if let Err(e) = create_popup_window(&app, area, pos_x, pos_y) {
        eprintln!("Failed to create popup window: {e}");
        return;
    }

    if let Some(window) = app.get_webview_window("popup") {
        let _ = window.emit("ocr-result", payload);
    }
}

pub fn open_popup(app: AppHandle, payload: OcrResult, physical_x: i32, physical_y: i32) -> Result<(), String> {
    if let Some(pending) = app.try_state::<PendingOcr>() {
        *pending.0.lock().unwrap() = Some(payload.clone());
    }

    let area = work_area_at_point(physical_x, physical_y);
    let scale = area.scale.max(1.0);
    let pos_x = physical_x as f64 / scale;
    let pos_y = physical_y as f64 / scale + 20.0;

    if let Some(window) = app.get_webview_window("popup") {
        let size = window.inner_size().unwrap_or(PhysicalSize::new(560, 820));
        let window_scale = window.scale_factor().unwrap_or(scale).max(1.0);
        let (pos_x, pos_y) = clamp_on_area(
            area,
            pos_x,
            pos_y,
            size.width as f64 / window_scale,
            size.height as f64 / window_scale,
        );
        window
            .set_position(Position::Logical(LogicalPosition::new(pos_x, pos_y)))
            .map_err(|e| e.to_string())?;
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    } else {
        create_popup_window(&app, area, pos_x, pos_y)?;
    }

    if let Some(window) = app.get_webview_window("popup") {
        let _ = window.emit("ocr-result", payload);
    } else {
        return Err("翻译窗口创建失败".to_string());
    }

    Ok(())
}

pub fn request_app_exit(app: &AppHandle) {
    if let Some(state) = app.try_state::<ExitState>() {
        state.0.store(true, Ordering::SeqCst);
    }
    app.exit(0);
}

fn register_hotkey(app: &AppHandle, hotkey: &str) -> Result<(), String> {
    let shortcut_manager = app.global_shortcut();

    let app_handle = app.clone();
    shortcut_manager
        .on_shortcut(hotkey, move |_app, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                overlay::spawn_prepare(app_handle.clone());
            }
        })
        .map_err(|e| e.to_string())?;

    Ok(())
}

struct NativeHotkeys<'a>(&'a AppHandle);

impl HotkeyRegistry for NativeHotkeys<'_> {
    fn register(&mut self, key: &str) -> Result<(), String> { register_hotkey(self.0, key) }
    fn unregister(&mut self, key: &str) -> Result<(), String> {
        self.0.global_shortcut().unregister(key).map_err(|e| e.to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(ConfigState::new())
        .manage(HotkeyState::default())
        .manage(TranslationCache::new(200))
        .manage(PendingOcr(Mutex::new(None)))
        .manage(MonitorSnapshotCache::new())
        .manage(overlay::SessionHub::default())
        .manage(overlay::CaptureGate::default())
        .manage(overlay::CaptureTrace::default())
        .manage(overlay::PrepareErrorState::default())
        .manage(ExitState(AtomicBool::new(false)))
        .setup(|app| {
            let resource_directory = if cfg!(debug_assertions) {
                std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources")
            } else { app.path().resource_dir()? };
            app.manage(LocalModelService::new(resource_directory.join("llama.cpp").join(format!("{}.zip", local_model::ENGINE_VERSION))));
            let ocr_directory = if cfg!(debug_assertions) {
                std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources/ocr")
            } else {
                app.path().resource_dir()?.join("ocr")
            };
            app.manage(OcrService::new(ocr_directory));
            tray::setup_tray(app.handle())?;

            let config = app.state::<ConfigState>().0.lock().unwrap().clone();
            if let Ok(profile) = config.active_profile() { app.state::<LocalModelService>().set_desired(profile); }
            let hotkey_status = hotkey::initialize_hotkey(&config.hotkey, &mut NativeHotkeys(app.handle()));
            let hotkey_failed = hotkey_status.error.is_some();
            *app.state::<HotkeyState>().0.lock().unwrap() = hotkey_status;

            place_settings_window(app.handle());
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.hide();
            }

            open_manual_popup(app.handle().clone(), &config);
            overlay::ensure_overlay_window(app.handle());

            if hotkey_failed {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }

            let ocr_app = app.handle().clone();
            tauri::async_runtime::spawn_blocking(move || {
                let service = ocr_app.state::<OcrService>();
                let _ = service.prewarm();
                let _ = ocr_app.emit("ocr-status", service.status());
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_app_config,
            get_hotkey_status,
            get_ocr_status,
            set_app_config,
            set_app_config_and_hotkey,
            save_settings,
            get_service_defaults,
            get_credential_status,
            list_models,
            test_generation,
            get_local_model_status,
            choose_local_model,
            choose_model_directory,
            get_model_download_info,
            download_local_model,
            install_local_engine,
            remove_local_engine,
            redownload_local_engine,
            check_api_key,
            show_popup_with_ocr,
            translate_text_stream,
            lookup_word_in_context,
            close_overlay,
            reopen_overlay,
            get_pending_ocr,
            get_pending_overlay,
            get_prepare_error,
            get_capture_trace,
            ack_overlay_frontend,
            ack_overlay_image,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let RunEvent::Exit = event {
                if let Some(service) = app_handle.try_state::<LocalModelService>() { service.shutdown(); }
                if let Some(service) = app_handle.try_state::<OcrService>() {
                    service.shutdown();
                }
            }
            if let RunEvent::ExitRequested { api, .. } = event {
                let allow_exit = app_handle
                    .try_state::<ExitState>()
                    .map(|state| state.0.load(Ordering::SeqCst))
                    .unwrap_or(false);
                if !allow_exit {
                    api.prevent_exit();
                }
            }
        });
}
