use image::{DynamicImage, RgbaImage, imageops::crop_imm};
use std::io::Cursor;
use std::sync::Mutex;
use std::time::Instant;
use windows::Win32::Foundation::{POINT, RECT};
use windows::Win32::Graphics::Gdi::{GetMonitorInfoW, MonitorFromPoint, MONITORINFO, MONITOR_DEFAULTTONEAREST};
use windows::Win32::UI::HiDpi::{GetDpiForMonitor, MDT_EFFECTIVE_DPI};
use windows::Win32::UI::WindowsAndMessaging::GetCursorPos;
use xcap::Monitor;

const FREEZE_JPEG_QUALITY: u8 = 75;

#[derive(Debug, Clone, serde::Serialize)]
pub struct CaptureRect {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
pub struct MonitorBounds {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

#[derive(Clone, Copy, Debug)]
pub struct FrameDigest {
    pub rgb_spread: u8,
    pub alpha_zero_pct: u8,
}

#[allow(dead_code)]
pub struct CapturedMonitor {
    pub width: u32,
    pub height: u32,
    pub pixels: Vec<u8>,
    pub digest: FrameDigest,
}

struct StoredSnapshot {
    session_id: u64,
    bounds: MonitorBounds,
    width: u32,
    height: u32,
    pixels: Vec<u8>,
    /// 保留捕获时间供诊断。选区会话不再用它做过期淘汰。
    #[allow(dead_code)]
    captured_at: Instant,
}

pub struct MonitorSnapshotCache(Mutex<Option<StoredSnapshot>>);

impl MonitorSnapshotCache {
    pub fn new() -> Self {
        Self(Mutex::new(None))
    }

    #[allow(dead_code)]
    fn store(&self, bounds: MonitorBounds, width: u32, height: u32, pixels: Vec<u8>) {
        self.store_session(0, bounds, width, height, pixels);
    }

    pub fn store_session(&self, session_id: u64, bounds: MonitorBounds, width: u32, height: u32, pixels: Vec<u8>) {
        if let Ok(mut guard) = self.0.lock() {
            *guard = Some(StoredSnapshot {
                session_id,
                bounds,
                width,
                height,
                pixels,
                captured_at: Instant::now(),
            });
        }
    }

    pub fn clear_session(&self, session_id: u64) {
        if let Ok(mut guard) = self.0.lock() {
            if guard.as_ref().is_some_and(|snap| snap.session_id == session_id) {
                *guard = None;
            }
        }
    }

    pub fn clear_all(&self) {
        if let Ok(mut guard) = self.0.lock() {
            *guard = None;
        }
    }

    #[allow(dead_code)]
    fn try_crop(&self, rect: &CaptureRect) -> Option<RgbaImage> {
        let guard = self.0.lock().ok()?;
        let snap = guard.as_ref()?;
        crop_snapshot(snap, rect)
    }

    pub fn crop_for_session(&self, session_id: u64, rect: &CaptureRect) -> Result<RgbaImage, String> {
        let guard = self.0.lock().map_err(|error| format!("截图缓存锁失败: {error}"))?;
        let snap = guard.as_ref().ok_or_else(|| "没有这一轮的冻结截图".to_string())?;
        if snap.session_id != session_id {
            return Err("冻结截图不属于当前选区".to_string());
        }
        crop_snapshot(snap, rect).ok_or_else(|| "选区超出当前显示器".to_string())
    }
}

pub fn rect_inside(bounds: &MonitorBounds, rect: &CaptureRect) -> bool {
    if rect.width == 0 || rect.height == 0 || rect.width > i32::MAX as u32 || rect.height > i32::MAX as u32 {
        return false;
    }
    let Some(rect_right) = rect.x.checked_add(rect.width as i32) else {
        return false;
    };
    let Some(rect_bottom) = rect.y.checked_add(rect.height as i32) else {
        return false;
    };
    let Some(bound_right) = bounds.x.checked_add(bounds.width as i32) else {
        return false;
    };
    let Some(bound_bottom) = bounds.y.checked_add(bounds.height as i32) else {
        return false;
    };
    rect.x >= bounds.x && rect.y >= bounds.y && rect_right <= bound_right && rect_bottom <= bound_bottom
}

fn crop_snapshot(snap: &StoredSnapshot, rect: &CaptureRect) -> Option<RgbaImage> {
    if !rect_inside(&snap.bounds, rect) {
        return None;
    }
    let rel_x = (rect.x - snap.bounds.x) as u32;
    let rel_y = (rect.y - snap.bounds.y) as u32;
    if rel_x.saturating_add(rect.width) > snap.width || rel_y.saturating_add(rect.height) > snap.height {
        return None;
    }
    crop_rgba_from_buffer(&snap.pixels, snap.width, rel_x, rel_y, rect.width, rect.height)
}

fn crop_rgba_from_buffer(
    pixels: &[u8],
    full_width: u32,
    rel_x: u32,
    rel_y: u32,
    crop_w: u32,
    crop_h: u32,
) -> Option<RgbaImage> {
    let stride = full_width as usize * 4;
    let row_bytes = crop_w as usize * 4;
    let mut out = vec![0u8; row_bytes * crop_h as usize];
    for row in 0..crop_h as usize {
        let src_start = (rel_y as usize + row) * stride + rel_x as usize * 4;
        let src_end = src_start.checked_add(row_bytes)?;
        if src_end > pixels.len() {
            return None;
        }
        let dst_start = row * row_bytes;
        out[dst_start..dst_start + row_bytes].copy_from_slice(&pixels[src_start..src_end]);
    }
    RgbaImage::from_raw(crop_w, crop_h, out)
}

pub fn cursor_position() -> (i32, i32) {
    unsafe {
        let mut point = POINT { x: 0, y: 0 };
        let _ = GetCursorPos(&mut point);
        (point.x, point.y)
    }
}

#[derive(Debug, Clone, Copy)]
pub struct WorkArea {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub scale: f64,
}

pub fn work_area_at_cursor() -> WorkArea {
    let (x, y) = cursor_position();
    work_area_at_point(x, y)
}

pub fn work_area_at_point(x: i32, y: i32) -> WorkArea {
    unsafe {
        let monitor = MonitorFromPoint(POINT { x, y }, MONITOR_DEFAULTTONEAREST);
        let mut info = MONITORINFO {
            cbSize: std::mem::size_of::<MONITORINFO>() as u32,
            rcMonitor: RECT::default(),
            rcWork: RECT::default(),
            dwFlags: 0,
        };
        if !monitor.is_invalid() && GetMonitorInfoW(monitor, &mut info).as_bool() {
            let rect = info.rcWork;
            let width = rect.right.saturating_sub(rect.left).max(0) as u32;
            let height = rect.bottom.saturating_sub(rect.top).max(0) as u32;
            if width > 0 && height > 0 {
                let mut dpi_x = 96u32;
                let mut dpi_y = 96u32;
                let scale = if GetDpiForMonitor(monitor, MDT_EFFECTIVE_DPI, &mut dpi_x, &mut dpi_y).is_ok() {
                    (dpi_x as f64 / 96.0).max(1.0)
                } else {
                    1.0
                };
                return WorkArea {
                    x: rect.left,
                    y: rect.top,
                    width,
                    height,
                    scale,
                };
            }
        }
    }
    WorkArea {
        x: 0,
        y: 0,
        width: 1920,
        height: 1080,
        scale: 1.0,
    }
}

pub fn monitor_at_point(px: i32, py: i32) -> Result<(Monitor, MonitorBounds), String> {
    let monitors = Monitor::all().map_err(|e| e.to_string())?;
    for monitor in monitors {
        let mx = monitor.x();
        let my = monitor.y();
        let mw = monitor.width() as i32;
        let mh = monitor.height() as i32;
        if px >= mx && px < mx + mw && py >= my && py < my + mh {
            return Ok((
                monitor,
                MonitorBounds {
                    x: mx,
                    y: my,
                    width: mw as u32,
                    height: mh as u32,
                },
            ));
        }
    }

    let monitors = Monitor::all().map_err(|e| e.to_string())?;
    let monitor = monitors
        .into_iter()
        .next()
        .ok_or_else(|| "未找到显示器".to_string())?;
    let bounds = MonitorBounds {
        x: monitor.x(),
        y: monitor.y(),
        width: monitor.width(),
        height: monitor.height(),
    };
    Ok((monitor, bounds))
}

pub fn monitor_at_cursor() -> Result<(Monitor, MonitorBounds), String> {
    let (cx, cy) = cursor_position();
    monitor_at_point(cx, cy)
}

pub fn digest_rgba(pixels: &[u8]) -> FrameDigest {
    if pixels.len() < 4 {
        return FrameDigest { rgb_spread: 0, alpha_zero_pct: 0 };
    }
    let count = pixels.len() / 4;
    let step = (count / 4096).max(1);
    let mut min_r = 255u8;
    let mut max_r = 0u8;
    let mut min_g = 255u8;
    let mut max_g = 0u8;
    let mut min_b = 255u8;
    let mut max_b = 0u8;
    let mut alpha_zero = 0u32;
    let mut samples = 0u32;
    let mut index = 0usize;
    while index < count {
        let offset = index * 4;
        let red = pixels[offset];
        let green = pixels[offset + 1];
        let blue = pixels[offset + 2];
        let alpha = pixels[offset + 3];
        min_r = min_r.min(red);
        max_r = max_r.max(red);
        min_g = min_g.min(green);
        max_g = max_g.max(green);
        min_b = min_b.min(blue);
        max_b = max_b.max(blue);
        if alpha == 0 {
            alpha_zero += 1;
        }
        samples += 1;
        index += step;
    }
    let spread = max_r
        .abs_diff(min_r)
        .max(max_g.abs_diff(min_g))
        .max(max_b.abs_diff(min_b));
    FrameDigest {
        rgb_spread: spread,
        alpha_zero_pct: ((alpha_zero.saturating_mul(100)) / samples.max(1)) as u8,
    }
}

fn rgba_to_png(dynamic: &DynamicImage) -> Result<Vec<u8>, String> {
    let mut buffer = Cursor::new(Vec::new());
    dynamic
        .write_to(&mut buffer, image::ImageFormat::Png)
        .map_err(|e| e.to_string())?;
    Ok(buffer.into_inner())
}

fn rgba_to_jpeg(dynamic: &DynamicImage, quality: u8) -> Result<Vec<u8>, String> {
    use image::codecs::jpeg::JpegEncoder;
    let mut buffer = Cursor::new(Vec::new());
    let encoder = JpegEncoder::new_with_quality(&mut buffer, quality);
    dynamic
        .write_with_encoder(encoder)
        .map_err(|e| e.to_string())?;
    Ok(buffer.into_inner())
}

fn crop_and_preprocess(
    screenshot: &RgbaImage,
    rel_x: u32,
    rel_y: u32,
    crop_w: u32,
    crop_h: u32,
) -> Result<Vec<u8>, String> {
    let cropped = crop_imm(screenshot, rel_x, rel_y, crop_w, crop_h).to_image();
    let dynamic = DynamicImage::ImageRgba8(cropped);
    let processed = super::preprocess::preprocess_for_ocr(&dynamic);
    rgba_to_png(&processed)
}

pub fn jpeg_from_rgba(width: u32, height: u32, pixels: &[u8]) -> Result<Vec<u8>, String> {
    let image = RgbaImage::from_raw(width, height, pixels.to_vec())
        .ok_or_else(|| "截图转换失败".to_string())?;
    rgba_to_jpeg(&DynamicImage::ImageRgba8(image), FREEZE_JPEG_QUALITY)
}

pub fn ocr_png_from_rgba(image: &RgbaImage) -> Result<Vec<u8>, String> {
    let processed = super::preprocess::preprocess_for_ocr(&DynamicImage::ImageRgba8(image.clone()));
    rgba_to_png(&processed)
}

/// 捕获会话开始时已经固定的显示器，不再按鼠标位置重新选择。
pub fn capture_monitor(bounds: &MonitorBounds) -> Result<CapturedMonitor, String> {
    let monitors = Monitor::all().map_err(|e| e.to_string())?;
    let monitor = monitors
        .into_iter()
        .find(|monitor| {
            monitor.x() == bounds.x
                && monitor.y() == bounds.y
                && monitor.width() == bounds.width
                && monitor.height() == bounds.height
        })
        .ok_or_else(|| "指定显示器已不存在或边界已变化".to_string())?;
    let image = monitor.capture_image().map_err(|e| e.to_string())?;
    let width = image.width();
    let height = image.height();
    let pixels = image.into_raw();
    let digest = digest_rgba(&pixels);
    Ok(CapturedMonitor { width, height, pixels, digest })
}

pub fn capture_live_region(bounds: &MonitorBounds, rect: &CaptureRect) -> Result<Vec<u8>, String> {
    if !rect_inside(bounds, rect) {
        return Err("选区超出当前显示器".to_string());
    }
    let captured = capture_monitor(bounds)?;
    let rel_x = (rect.x - bounds.x) as u32;
    let rel_y = (rect.y - bounds.y) as u32;
    if rel_x.saturating_add(rect.width) > captured.width || rel_y.saturating_add(rect.height) > captured.height {
        return Err("选区超出当前截图".to_string());
    }
    let image = RgbaImage::from_raw(captured.width, captured.height, captured.pixels)
        .ok_or_else(|| "截图转换失败".to_string())?;
    crop_and_preprocess(&image, rel_x, rel_y, rect.width, rect.height)
}

/// 将缓存中的截图编码为 JPEG。正式选区流程会从同一次捕获的缓冲区编码，此函数保留给诊断夹具。
#[allow(dead_code)]
pub fn encode_freeze_frame_jpeg(cache: &MonitorSnapshotCache) -> Result<Vec<u8>, String> {
    let guard = cache
        .0
        .lock()
        .map_err(|e| format!("缓存锁失败: {e}"))?;
    let snap = guard.as_ref().ok_or_else(|| "截图缓存为空".to_string())?;
    jpeg_from_rgba(snap.width, snap.height, &snap.pixels)
}

#[cfg(test)]
mod lifecycle_gap_tests {
    use super::*;
    use std::time::Duration;

    fn solid(width: u32, height: u32, pixel: [u8; 4]) -> Vec<u8> {
        let mut pixels = Vec::with_capacity((width * height * 4) as usize);
        for _ in 0..width * height {
            pixels.extend_from_slice(&pixel);
        }
        pixels
    }

    fn bounds() -> MonitorBounds {
        MonitorBounds { x: 0, y: 0, width: 20, height: 20 }
    }

    #[test]
    fn frozen_snapshot_remains_valid_after_three_seconds() {
        let cache = MonitorSnapshotCache::new();
        cache.store(bounds(), 20, 20, solid(20, 20, [255, 255, 255, 255]));
        cache.0.lock().unwrap().as_mut().unwrap().captured_at = Instant::now() - Duration::from_secs(4);
        assert!(
            cache.try_crop(&CaptureRect { x: 2, y: 2, width: 5, height: 5 }).is_some(),
            "冻结底图超过 3 秒后被丢弃"
        );
    }

    #[test]
    fn crop_rejects_rectangle_on_another_monitor() {
        let cache = MonitorSnapshotCache::new();
        cache.store(
            MonitorBounds { x: 1920, y: 0, width: 20, height: 20 },
            20,
            20,
            solid(20, 20, [255, 255, 255, 255]),
        );
        assert!(
            cache.try_crop(&CaptureRect { x: 2, y: 2, width: 5, height: 5 }).is_none(),
            "其他显示器的矩形被钳进当前缓存"
        );
    }

    #[test]
    fn crop_rejects_rectangle_that_crosses_monitor_edge() {
        let cache = MonitorSnapshotCache::new();
        cache.store(bounds(), 20, 20, solid(20, 20, [255, 255, 255, 255]));
        assert!(cache.try_crop(&CaptureRect { x: 18, y: 2, width: 5, height: 5 }).is_none());
    }

    #[test]
    fn newer_capture_does_not_satisfy_older_session() {
        let cache = MonitorSnapshotCache::new();
        let rect = CaptureRect { x: 2, y: 2, width: 5, height: 5 };
        cache.store_session(1, bounds(), 20, 20, solid(20, 20, [255, 0, 0, 255]));
        cache.store_session(2, bounds(), 20, 20, solid(20, 20, [0, 0, 255, 255]));
        assert!(cache.crop_for_session(1, &rect).is_err());
        let current = cache.crop_for_session(2, &rect).unwrap();
        assert_eq!(current.get_pixel(0, 0).0[2], 255);
    }

    #[test]
    fn clear_session_does_not_remove_a_newer_snapshot() {
        let cache = MonitorSnapshotCache::new();
        let rect = CaptureRect { x: 1, y: 1, width: 2, height: 2 };
        cache.store_session(2, bounds(), 20, 20, solid(20, 20, [0, 255, 0, 255]));
        cache.clear_session(1);
        assert!(cache.crop_for_session(2, &rect).is_ok());
        cache.clear_session(2);
        assert!(cache.crop_for_session(2, &rect).is_err());
    }

    #[test]
    fn jpeg_is_encoded_from_the_supplied_pixels() {
        let pixels = solid(4, 4, [220, 20, 20, 0]);
        let jpeg = jpeg_from_rgba(4, 4, &pixels).unwrap();
        let decoded = image::load_from_memory(&jpeg).unwrap().to_rgb8();
        let pixel = decoded.get_pixel(1, 1);
        assert!(pixel[0] > pixel[2].saturating_add(100));
        let digest = digest_rgba(&pixels);
        assert_eq!(digest.alpha_zero_pct, 100);
        assert_eq!(digest.rgb_spread, 0);
    }
}
