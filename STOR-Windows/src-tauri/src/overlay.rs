use crate::capture::compose::{capture_screen_rgba, flush_desktop_composition};
use crate::capture::screen::{
    CaptureRect, FrameDigest, MonitorBounds, MonitorSnapshotCache, capture_live_region,
    digest_rgba, jpeg_from_rgba, monitor_at_cursor,
};
use crate::capture::session::{
    ocr_uses_frozen_cache, BeginResult, CaptureMode, FailurePlan, ImageAck, PublishResult, SessionBook,
    SessionPhase, SessionRequest, PREPARE_TIMEOUT,
};
use crate::config::ConfigState;
use crate::ocr::OcrService;
use crate::{open_popup, OcrResult};
use base64::{Engine as _, engine::general_purpose::STANDARD};
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Instant;
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, State, WebviewUrl, WebviewWindowBuilder};
use tokio::sync::oneshot;

pub struct SessionHub(pub Mutex<Hub>);

pub struct Hub {
    book: SessionBook,
    waiters: HashMap<u64, Vec<oneshot::Sender<Result<(), String>>>>,
}

impl Default for SessionHub {
    fn default() -> Self {
        Self(Mutex::new(Hub { book: SessionBook::new(), waiters: HashMap::new() }))
    }
}

pub struct CaptureGate(pub Mutex<()>);

impl Default for CaptureGate {
    fn default() -> Self {
        Self(Mutex::new(()))
    }
}

pub struct CaptureTrace(pub Mutex<Vec<String>>);

impl Default for CaptureTrace {
    fn default() -> Self {
        Self(Mutex::new(Vec::new()))
    }
}

pub struct PrepareErrorState(pub Mutex<Option<PrepareErrorPayload>>);

impl Default for PrepareErrorState {
    fn default() -> Self {
        Self(Mutex::new(None))
    }
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OverlayInitPayload {
    session_id: String,
    mode: CaptureMode,
    freeze_frame: Option<String>,
    bounds: MonitorBounds,
    scale_factor: f64,
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrepareErrorPayload {
    session_id: String,
    message: String,
    surface: String,
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct SessionEvent {
    session_id: String,
}

enum LeaderStop {
    Published { started: Instant },
    Discarded { started: Instant },
    Failed { started: Instant, message: String },
}

pub fn ensure_overlay_window(app: &AppHandle) {
    if app.get_webview_window("overlay").is_some() {
        return;
    }
    if let Err(error) = create_overlay_window(app) {
        eprintln!("stor-capture session=0 phase=create-overlay elapsed_ms=0 width=0 height=0 jpeg_bytes=0 rgb_spread=0 alpha_zero_pct=0 error={error}");
    }
}

pub fn spawn_prepare(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let _ = prepare_overlay(app, false).await;
    });
}

#[tauri::command]
pub async fn reopen_overlay(app: AppHandle) -> Result<(), String> {
    prepare_overlay(app, true).await
}

#[tauri::command]
pub fn get_pending_overlay(app: AppHandle) -> Result<Option<OverlayInitPayload>, String> {
    let hub_state = app.state::<SessionHub>();
    let hub = map_lock(&hub_state)?;
    Ok(hub.book.pending().map(payload_from_pending))
}

#[tauri::command]
pub fn get_prepare_error(state: State<'_, PrepareErrorState>) -> Option<PrepareErrorPayload> {
    state.0.lock().ok().and_then(|guard| guard.clone())
}

#[tauri::command]
pub fn get_capture_trace(state: State<'_, CaptureTrace>) -> Vec<String> {
    state.0.lock().map(|guard| guard.clone()).unwrap_or_default()
}

#[tauri::command]
pub async fn ack_overlay_frontend(app: AppHandle, session_id: String) -> Result<(), String> {
    let id = parse_session_id(&session_id)?;
        let started = {
            let hub_state = app.state::<SessionHub>();
            let mut hub = map_lock(&hub_state)?;
            if !hub.book.ack_frontend(id) {
                return Ok(());
            }
            started_or_now(&hub.book, id)
        };
    log_phase(&app, id, "frontend-ready", started, 0, 0, 0, None, None);
    try_show(&app, id).await
}

#[tauri::command]
pub async fn ack_overlay_image(
    app: AppHandle,
    session_id: String,
    ok: bool,
    message: Option<String>,
) -> Result<(), String> {
    let id = parse_session_id(&session_id)?;
    if !ok {
        let text = message.unwrap_or_else(|| "底图加载失败".to_string());
        dismiss(&app, id, &text, true, true);
        return Ok(());
    }
    let started = {
        let hub_state = app.state::<SessionHub>();
        let mut hub = map_lock(&hub_state)?;
        match hub.book.ack_image(id, true) {
            ImageAck::Ignored => return Ok(()),
            ImageAck::Failed => return Ok(()),
            ImageAck::Updated => started_or_now(&hub.book, id),
        }
    };
    log_phase(&app, id, "image-ok", started, 0, 0, 0, None, None);
    try_show(&app, id).await
}

#[tauri::command]
pub fn close_overlay(app: AppHandle, session_id: String) -> Result<(), String> {
    let id = parse_session_id(&session_id)?;
    let was_shown = session_phase(&app, id)? == Some(SessionPhase::Shown);
    dismiss(&app, id, "已取消选区", !was_shown, true);
    Ok(())
}

#[tauri::command]
pub async fn show_popup_with_ocr(
    app: AppHandle,
    session_id: String,
    x: i32,
    y: i32,
    width: u32,
    height: u32,
) -> Result<(), String> {
    let id = parse_session_id(&session_id)?;
    if width < 5 || height < 5 {
        return Err("选区太小，请重新框选".to_string());
    }
    let (mode, bounds, started, target) = {
        let hub_state = app.state::<SessionHub>();
        let hub = map_lock(&hub_state)?;
        let (mode, bounds) = hub.book.ocr_target(id).ok_or_else(|| "选区已失效".to_string())?;
        let config = app.state::<ConfigState>().0.lock().map_err(|error| error.to_string())?.clone();
        (mode, bounds, started_or_now(&hub.book, id), config.default_target_lang)
    };
    let rect = CaptureRect { x, y, width, height };
    let png = if mode == CaptureMode::Live {
        {
            let hub_state = app.state::<SessionHub>();
            let hub = map_lock(&hub_state)?;
            if !hub.book.accepts_ocr(id) {
                return Err("选区已失效".to_string());
            }
        }
        if let Err(error) = hide_window_now(&app, "overlay") {
            dismiss(&app, id, &error, true, true);
            return Err(error);
        }
        log_phase(&app, id, "hide-before-live-capture", started, 0, 0, 0, None, None);
        if let Err(error) = flush_desktop_composition() {
            log_phase(&app, id, "composition-flush", started, 0, 0, 0, None, Some(&error));
            dismiss(&app, id, &error, true, true);
            return Err(error);
        }
        let app_for_capture = app.clone();
        let bounds_for_capture = bounds.clone();
        tauri::async_runtime::spawn_blocking(move || {
            let gate = app_for_capture.state::<CaptureGate>();
            let _permit = gate.0.lock().unwrap_or_else(|error| error.into_inner());
            capture_live_region(&bounds_for_capture, &rect)
        })
        .await
        .map_err(|error| format!("实时截图任务失败: {error}"))?
    } else {
        let cache = app.state::<MonitorSnapshotCache>();
        crop_for_session_png(&cache, id, &rect)
    };
    let png = match png {
        Ok(png) => png,
        Err(error) => {
            log_phase(&app, id, "ocr-capture", started, width, height, 0, None, Some(&error));
            if session_is_current(&app, id)? {
                dismiss(&app, id, &error, true, true);
            }
            return Err(error);
        }
    };
    if !session_accepts_ocr(&app, id)? {
        log_phase(&app, id, "ocr-discard", started, width, height, 0, None, Some("选区已失效"));
        return Err("选区已失效".to_string());
    }
    log_phase(&app, id, "ocr-capture", started, width, height, png.len(), None, None);
    let ocr_app = app.clone();
    let text = tauri::async_runtime::spawn_blocking(move || {
        let service = ocr_app.state::<OcrService>();
        let result = service.recognize(&png);
        let _ = ocr_app.emit("ocr-status", service.status());
        result
    })
        .await
        .unwrap_or_else(|error| Err(format!("OCR 任务失败: {error}")));
    let text = match text {
        Ok(text) => text,
        Err(error) => {
            log_phase(&app, id, "ocr-error", started, width, height, 0, None, Some(&error));
            if session_is_current(&app, id)? {
                dismiss(&app, id, &error, true, true);
            }
            return Err(error);
        }
    };
    let finished = {
        let hub_state = app.state::<SessionHub>();
        let mut hub = map_lock(&hub_state)?;
        hub.book.finish(id)
    };
    if !finished {
        log_phase(&app, id, "ocr-discard", started, width, height, 0, None, Some("选区已失效"));
        return Err("选区已失效".to_string());
    }
    if let Some(cache) = app.try_state::<MonitorSnapshotCache>() {
        cache.clear_session(id);
    }
    if let Err(error) = open_popup(app.clone(), OcrResult { text, default_target_lang: target }, x, y) {
        hide_overlay_window(&app);
        if let Some(window) = app.get_webview_window("overlay") {
            let _ = window.emit("overlay-hide", SessionEvent { session_id: id.to_string() });
        }
        present_failure(&app, &FailurePlan { id, popup_held: false }, &error);
        return Err(error);
    }
    hide_overlay_window(&app);
    if let Some(window) = app.get_webview_window("overlay") {
        let _ = window.emit("overlay-hide", SessionEvent { session_id: id.to_string() });
    }
    log_phase(&app, id, "ocr-done", started, width, height, 0, None, None);
    Ok(())
}

async fn prepare_overlay(app: AppHandle, from_popup: bool) -> Result<(), String> {
    let config = app.state::<ConfigState>().0.lock().map_err(|error| error.to_string())?.clone();
    let bounds = monitor_at_cursor().map(|(_, bounds)| bounds).map_err(|error| format!("无法获取显示器: {error}"))?;
    let mode = if config.freeze_frame_on_select { CaptureMode::Freeze } else { CaptureMode::Live };
    let popup_held = from_popup && app.get_webview_window("popup").is_some();
    let begun = {
        let hub_state = app.state::<SessionHub>();
        let mut hub = map_lock(&hub_state)?;
        let begun = hub.book.begin(
            SessionRequest { mode, bounds: bounds.clone(), scale_factor: 1.0, popup_held },
            Instant::now(),
        );
        if let Some(replaced) = begun.replaced {
            if let Some(cache) = app.try_state::<MonitorSnapshotCache>() {
                cache.clear_session(replaced);
            }
        }
        begun
    };
    if !begun.leader {
        log_phase(&app, begun.id, "coalesced", begun.started, 0, 0, 0, None, None);
        let rx = register_waiter(&app, begun.id)?;
        return await_outcome(&app, begun.id, begun.started, rx).await;
    }
    log_phase(&app, begun.id, "begin", begun.started, bounds.width, bounds.height, 0, None, None);
    let mut rx = register_waiter(&app, begun.id)?;
    match run_leader(&app, &begun, mode, bounds, popup_held).await {
        LeaderStop::Published { started } => await_outcome(&app, begun.id, started, rx).await,
        LeaderStop::Discarded { started } => {
            log_phase(&app, begun.id, "discard-stale", started, 0, 0, 0, None, Some("结果已丢弃"));
            let still_current = session_is_current(&app, begun.id)?;
            match rx.try_recv() {
                Ok(result) => result,
                Err(_) if !still_current => Err("这一轮截图已被替代".to_string()),
                Err(_) => Err("截图结果已丢弃".to_string()),
            }
        }
        LeaderStop::Failed { started, message } => {
            log_phase(&app, begun.id, "prepare-error", started, 0, 0, 0, None, Some(&message));
            dismiss(&app, begun.id, &message, true, true);
            Err(message)
        }
    }
}

async fn run_leader(
    app: &AppHandle,
    begun: &BeginResult,
    mode: CaptureMode,
    bounds: MonitorBounds,
    popup_held: bool,
) -> LeaderStop {
    let id = begun.id;
    let started = begun.started;
    let window = match overlay_window(app) {
        Ok(window) => window,
        Err(message) => return LeaderStop::Failed { started, message },
    };
    if let Err(error) = apply_geometry(&window, &bounds) {
        return LeaderStop::Failed { started, message: error };
    }
    let scale = match window.scale_factor() {
        Ok(scale) => scale,
        Err(error) => return LeaderStop::Failed { started, message: format!("无法读取缩放: {error}") },
    };
    {
        let hub_state = app.state::<SessionHub>();
        let mut hub = match map_lock(&hub_state) {
            Ok(hub) => hub,
            Err(message) => return LeaderStop::Failed { started, message },
        };
        if !hub.book.set_scale(id, scale) {
            return LeaderStop::Discarded { started };
        }
    }
    log_phase(app, id, "geometry", started, bounds.width, bounds.height, 0, None, None);
    drop(window);
    if let Err(error) = destroy_window_now(app, "overlay") {
        return LeaderStop::Failed { started, message: error };
    }
    log_phase(app, id, "hide-overlay", started, 0, 0, 0, None, None);
    if popup_held {
        if let Err(error) = hide_window_now(app, "popup") {
            return LeaderStop::Failed { started, message: format!("暂时隐藏翻译窗口失败: {error}") };
        }
        log_phase(app, id, "hide-popup", started, 0, 0, 0, None, None);
    }
    if let Err(error) = flush_desktop_composition() {
        log_phase(app, id, "composition-flush", started, 0, 0, 0, None, Some(&error));
        return LeaderStop::Failed { started, message: error };
    }
    log_phase(app, id, "composition-flush", started, 0, 0, 0, None, None);

    if ocr_uses_frozen_cache(mode) {
        let app_handle = app.clone();
        let capture_bounds = bounds.clone();
        let committed = tauri::async_runtime::spawn_blocking(move || commit_freeze(&app_handle, id, &capture_bounds)).await;
        let committed = match committed {
            Ok(result) => result,
            Err(error) => return LeaderStop::Failed { started, message: format!("截图任务失败: {error}") },
        };
        match committed {
            Ok(FreezeCommit::Stored { width, height, jpeg_bytes, digest }) => {
                log_phase(app, id, "encoded", started, width, height, jpeg_bytes, Some(digest), None);
            }
            Ok(FreezeCommit::Discarded) => return LeaderStop::Discarded { started },
            Err(message) => return LeaderStop::Failed { started, message },
        }
    } else {
        if let Some(cache) = app.try_state::<MonitorSnapshotCache>() {
            cache.clear_all();
        }
        let hub_state = app.state::<SessionHub>();
        let mut hub = match map_lock(&hub_state) {
            Ok(hub) => hub,
            Err(message) => return LeaderStop::Failed { started, message },
        };
        if hub.book.publish(id, None, 0, 0) != PublishResult::Accepted {
            return LeaderStop::Discarded { started };
        }
        log_phase(app, id, "live-deferred", started, 0, 0, 0, None, None);
    }

    if let Err(error) = recreate_overlay_now(app, &bounds) {
        return LeaderStop::Failed { started, message: error };
    }
    if let Err(message) = emit_current_payload(app, id) {
        return LeaderStop::Failed { started, message };
    }
    log_phase(app, id, "published", started, 0, 0, 0, None, None);
    LeaderStop::Published { started }
}

enum FreezeCommit {
    Stored { width: u32, height: u32, jpeg_bytes: usize, digest: FrameDigest },
    Discarded,
}

fn commit_freeze(app: &AppHandle, id: u64, bounds: &MonitorBounds) -> Result<FreezeCommit, String> {
    let gate = app.state::<CaptureGate>();
    let _permit = gate.0.lock().unwrap_or_else(|error| error.into_inner());
    let pixels = capture_screen_rgba(bounds.x, bounds.y, bounds.width, bounds.height)?;
    let digest = digest_rgba(&pixels);
    let jpeg = jpeg_from_rgba(bounds.width, bounds.height, &pixels)?;
    let hub_state = app.state::<SessionHub>();
    let mut hub = map_lock(&hub_state)?;
    if hub.book.publish(id, Some(jpeg.clone()), bounds.width, bounds.height) != PublishResult::Accepted {
        return Ok(FreezeCommit::Discarded);
    }
    if let Some(cache) = app.try_state::<MonitorSnapshotCache>() {
        cache.store_session(id, bounds.clone(), bounds.width, bounds.height, pixels);
    }
    Ok(FreezeCommit::Stored {
        width: bounds.width,
        height: bounds.height,
        jpeg_bytes: jpeg.len(),
        digest,
    })
}

fn emit_current_payload(app: &AppHandle, id: u64) -> Result<(), String> {
    let payload = {
        let hub_state = app.state::<SessionHub>();
        let hub = map_lock(&hub_state)?;
        let pending = hub.book.pending().ok_or_else(|| "选区初始化数据尚未就绪".to_string())?;
        if pending.id != id {
            return Err("这一轮截图已被替代".to_string());
        }
        payload_from_pending(pending)
    };
    if let Some(window) = app.get_webview_window("overlay") {
        window.emit("overlay-session", payload).map_err(|error| format!("选区事件发送失败: {error}"))?;
    }
    Ok(())
}

async fn await_outcome(
    app: &AppHandle,
    id: u64,
    started: Instant,
    rx: oneshot::Receiver<Result<(), String>>,
) -> Result<(), String> {
    let deadline = tokio::time::Instant::from_std(started + PREPARE_TIMEOUT);
    match tokio::time::timeout_at(deadline, rx).await {
        Ok(Ok(result)) => result,
        Ok(Err(_)) => Err("截图准备已中断".to_string()),
        Err(_) => {
            if dismiss(app, id, "截图准备超时", true, false) {
                log_phase(app, id, "timeout", started, 0, 0, 0, None, Some("截图准备超时"));
                Err("截图准备超时".to_string())
            } else if session_phase(app, id)? == Some(SessionPhase::Shown) {
                Ok(())
            } else {
                Err("这一轮截图已被替代".to_string())
            }
        }
    }
}

async fn try_show(app: &AppHandle, id: u64) -> Result<(), String> {
    let plan = {
        let hub_state = app.state::<SessionHub>();
        let mut hub = map_lock(&hub_state)?;
        hub.book.begin_show(id)
    };
    let Some(plan) = plan else {
        return Ok(());
    };
    let window = match overlay_window(app) {
        Ok(window) => window,
        Err(message) => {
            dismiss(app, id, &message, true, true);
            return Err(message);
        }
    };
    if let Err(error) = window.show() {
        let message = format!("打开框选窗口失败: {error}");
        dismiss(app, id, &message, true, true);
        return Err(message);
    }
    if let Err(error) = window.set_focus() {
        let message = format!("框选窗口聚焦失败: {error}");
        dismiss(app, id, &message, true, true);
        return Err(message);
    }
    let (marked, waiters, started) = {
        let hub_state = app.state::<SessionHub>();
        let mut hub = map_lock(&hub_state)?;
        let started = started_or_now(&hub.book, id);
        let marked = hub.book.mark_shown(id);
        let waiters = if marked { hub.waiters.remove(&id).unwrap_or_default() } else { Vec::new() };
        (marked, waiters, started)
    };
    if !marked {
        let hub_state = app.state::<SessionHub>();
        let hub = map_lock(&hub_state)?;
        if hub.book.is_current(id) {
            hide_overlay_window(app);
        }
        return Ok(());
    }
    log_phase(app, plan.id, "shown", started, plan.bounds.width, plan.bounds.height, 0, None, None);
    if plan.close_popup {
        if let Some(popup) = app.get_webview_window("popup") {
            if let Err(error) = popup.close() {
                let message = format!("关闭旧翻译窗口失败: {error}");
                dismiss(app, id, &message, true, true);
                notify(waiters, Err(message.clone()));
                return Err(message);
            }
        }
    }
    if let Some(errors) = app.try_state::<PrepareErrorState>() {
        if let Ok(mut guard) = errors.0.lock() {
            *guard = None;
        }
    }
    notify(waiters, Ok(()));
    Ok(())
}

fn dismiss(app: &AppHandle, id: u64, message: &str, report: bool, allow_shown: bool) -> bool {
    let (plan, waiters, started_at, still) = {
        let hub_state = app.state::<SessionHub>();
        let mut hub = match map_lock(&hub_state) {
            Ok(hub) => hub,
            Err(_) => return false,
        };
        let Some(plan) = (if allow_shown {
            hub.book.fail_active(id)
        } else {
            hub.book.expire_prepare(id, Instant::now()).or_else(|| hub.book.cancel_prepare(id))
        }) else {
            return false;
        };
        let started_at = started_or_now(&hub.book, id);
        let waiters = hub.waiters.remove(&id).unwrap_or_default();
        let still = hub.book.is_current(id);
        if still {
            hide_overlay_window(app);
        }
        (plan, waiters, started_at, still)
    };
    if let Some(cache) = app.try_state::<MonitorSnapshotCache>() {
        cache.clear_session(id);
    }
    if still {
        if let Some(window) = app.get_webview_window("overlay") {
            let _ = window.emit("overlay-hide", SessionEvent { session_id: id.to_string() });
        }
    }
    if report {
        present_failure(app, &plan, message);
    }
    log_phase(app, id, "dismiss", started_at, 0, 0, 0, None, Some(message));
    notify(waiters, Err(message.to_string()));
    true
}

fn present_failure(app: &AppHandle, plan: &FailurePlan, message: &str) {
    let popup_exists = app.get_webview_window("popup").is_some();
    let surface = if plan.popup_held || popup_exists { "popup" } else { "settings" };
    if plan.popup_held {
        if let Some(popup) = app.get_webview_window("popup") {
            let _ = popup.unminimize();
            let _ = popup.show();
            let _ = popup.set_focus();
        }
        log_phase(app, plan.id, "restore-popup", Instant::now(), 0, 0, 0, None, Some(message));
    } else if surface == "settings" {
        if let Some(main) = app.get_webview_window("main") {
            let _ = main.show();
            let _ = main.set_focus();
        }
        log_phase(app, plan.id, "settings-error", Instant::now(), 0, 0, 0, None, Some(message));
    }
    let payload = PrepareErrorPayload {
        session_id: plan.id.to_string(),
        message: message.to_string(),
        surface: surface.to_string(),
    };
    if let Some(errors) = app.try_state::<PrepareErrorState>() {
        if let Ok(mut guard) = errors.0.lock() {
            *guard = Some(payload.clone());
        }
    }
    let _ = app.emit("overlay-prepare-error", payload);
}

fn register_waiter(app: &AppHandle, id: u64) -> Result<oneshot::Receiver<Result<(), String>>, String> {
    let (tx, rx) = oneshot::channel();
    let hub_state = app.state::<SessionHub>();
    let mut hub = map_lock(&hub_state)?;
    if hub.book.phase(id) == Some(SessionPhase::Shown) {
        let _ = tx.send(Ok(()));
        return Ok(rx);
    }
    if matches!(hub.book.phase(id), Some(SessionPhase::Cancelled | SessionPhase::Finished)) || !hub.book.is_current(id) {
        let _ = tx.send(Err("这一轮截图已被替代".to_string()));
        return Ok(rx);
    }
    hub.waiters.entry(id).or_default().push(tx);
    Ok(rx)
}

fn notify(waiters: Vec<oneshot::Sender<Result<(), String>>>, result: Result<(), String>) {
    for waiter in waiters {
        let _ = waiter.send(result.clone());
    }
}

fn payload_from_pending(pending: crate::capture::session::PendingView) -> OverlayInitPayload {
    OverlayInitPayload {
        session_id: pending.id.to_string(),
        mode: pending.mode,
        freeze_frame: pending.freeze_jpeg.map(|bytes| STANDARD.encode(bytes)),
        bounds: pending.bounds,
        scale_factor: pending.scale_factor,
    }
}

fn started_or_now(book: &SessionBook, id: u64) -> Instant {
    book.started_at(id).unwrap_or_else(Instant::now)
}

fn map_lock<'a>(state: &'a State<'_, SessionHub>) -> Result<std::sync::MutexGuard<'a, Hub>, String> {
    state.0.lock().map_err(|error| format!("选区状态锁失败: {error}"))
}

fn session_is_current(app: &AppHandle, id: u64) -> Result<bool, String> {
    let hub_state = app.state::<SessionHub>();
    let hub = map_lock(&hub_state)?;
    Ok(hub.book.is_current(id))
}

fn session_accepts_ocr(app: &AppHandle, id: u64) -> Result<bool, String> {
    let hub_state = app.state::<SessionHub>();
    let hub = map_lock(&hub_state)?;
    Ok(hub.book.accepts_ocr(id))
}

fn session_phase(app: &AppHandle, id: u64) -> Result<Option<SessionPhase>, String> {
    let hub_state = app.state::<SessionHub>();
    let hub = map_lock(&hub_state)?;
    Ok(hub.book.phase(id))
}

fn parse_session_id(value: &str) -> Result<u64, String> {
    value.parse::<u64>().map_err(|_| "无效的选区会话".to_string())
}

fn hide_overlay_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("overlay") {
        let _ = window.hide();
    }
}

/// Tauri 的 hide 在非主线程只是投递消息。截图前必须等主线程真正隐藏窗口，再做桌面合成同步。
fn destroy_window_now(app: &AppHandle, label: &str) -> Result<(), String> {
    let (tx, rx) = std::sync::mpsc::channel();
    let app_handle = app.clone();
    let label = label.to_string();
    app.run_on_main_thread(move || {
        let result = if let Some(window) = app_handle.get_webview_window(&label) {
            window.destroy().map_err(|error| format!("关闭旧框选层失败: {error}"))
        } else {
            Ok(())
        };
        let _ = tx.send(result);
    })
    .map_err(|error| format!("同步关闭框选层失败: {error}"))?;
    rx.recv().map_err(|_| "等待框选层关闭失败".to_string())?
}

fn recreate_overlay_now(app: &AppHandle, bounds: &MonitorBounds) -> Result<(), String> {
    let (tx, rx) = std::sync::mpsc::channel();
    let app_handle = app.clone();
    let bounds = bounds.clone();
    app.run_on_main_thread(move || {
        let result = (|| {
            if app_handle.get_webview_window("overlay").is_none() {
                create_overlay_window(&app_handle)?;
            }
            let window = app_handle.get_webview_window("overlay").ok_or_else(|| "无法创建框选窗口".to_string())?;
            apply_geometry(&window, &bounds)
        })();
        let _ = tx.send(result);
    })
    .map_err(|error| format!("同步创建框选层失败: {error}"))?;
    rx.recv().map_err(|_| "等待框选层创建失败".to_string())?
}

fn hide_window_now(app: &AppHandle, label: &str) -> Result<(), String> {
    let (tx, rx) = std::sync::mpsc::channel();
    let app_handle = app.clone();
    let label = label.to_string();
    app.run_on_main_thread(move || {
        let result = if let Some(window) = app_handle.get_webview_window(&label) {
            window.hide().map_err(|error| format!("隐藏窗口失败: {error}"))
        } else {
            Ok(())
        };
        let _ = tx.send(result);
    })
    .map_err(|error| format!("同步隐藏窗口失败: {error}"))?;
    rx.recv().map_err(|_| "等待窗口隐藏失败".to_string())?
}

fn overlay_window(app: &AppHandle) -> Result<tauri::WebviewWindow, String> {
    if let Some(window) = app.get_webview_window("overlay") {
        return Ok(window);
    }
    create_overlay_window(app)?;
    app.get_webview_window("overlay").ok_or_else(|| "无法创建框选窗口".to_string())
}

fn create_overlay_window(app: &AppHandle) -> Result<(), String> {
    WebviewWindowBuilder::new(app, "overlay", WebviewUrl::App("index.html".into()))
        .title("STOR Overlay")
        .transparent(true)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .visible(false)
        .focused(false)
        .build()
        .map_err(|error| format!("无法创建框选窗口: {error}"))?;
    Ok(())
}

fn apply_geometry(window: &tauri::WebviewWindow, bounds: &MonitorBounds) -> Result<(), String> {
    window.set_position(PhysicalPosition::new(bounds.x, bounds.y)).map_err(|error| error.to_string())?;
    window.set_size(PhysicalSize::new(bounds.width, bounds.height)).map_err(|error| error.to_string())?;
    Ok(())
}

fn log_phase(
    app: &AppHandle,
    session: u64,
    phase: &str,
    started: Instant,
    width: u32,
    height: u32,
    jpeg_bytes: usize,
    digest: Option<FrameDigest>,
    error: Option<&str>,
) {
    let digest = digest.unwrap_or(FrameDigest { rgb_spread: 0, alpha_zero_pct: 0 });
    let line = format!(
        "session={session} phase={phase} elapsed_ms={} width={width} height={height} bytes={jpeg_bytes} rgb_spread={} alpha_zero_pct={} error={}",
        started.elapsed().as_millis(),
        digest.rgb_spread,
        digest.alpha_zero_pct,
        error.unwrap_or("-"),
    );
    eprintln!("stor-capture {line}");
    if let Some(trace) = app.try_state::<CaptureTrace>() {
        if let Ok(mut guard) = trace.0.lock() {
            guard.push(line);
            if guard.len() > 300 {
                let extra = guard.len() - 300;
                guard.drain(0..extra);
            }
        }
    }
}

pub fn crop_for_session_png(cache: &MonitorSnapshotCache, session_id: u64, rect: &CaptureRect) -> Result<Vec<u8>, String> {
    let image = cache.crop_for_session(session_id, rect)?;
    crate::capture::screen::ocr_png_from_rgba(&image)
}
