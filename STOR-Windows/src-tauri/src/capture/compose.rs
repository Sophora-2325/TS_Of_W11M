pub fn flush_desktop_composition() -> Result<(), String> {
    use windows::Win32::Graphics::Dwm::DwmFlush;
    // 第一次等待隐藏命令进入当前合成，第二次等待该帧呈现后再读取桌面。
    // 只刷一次时，BitBlt 仍可能读到遮罩或遮罩消失后的空黑帧。
    unsafe { DwmFlush() }.map_err(|error| format!("桌面合成同步失败: {error}"))?;
    unsafe { DwmFlush() }.map_err(|error| format!("桌面合成同步失败: {error}"))
}

pub fn capture_screen_rgba(x: i32, y: i32, width: u32, height: u32) -> Result<Vec<u8>, String> {
    use windows::Win32::Graphics::Gdi::{
        BitBlt, CreateCompatibleBitmap, CreateCompatibleDC, DeleteDC, DeleteObject, GetDC, GetDIBits,
        ReleaseDC, SelectObject, BITMAPINFO, BITMAPINFOHEADER, DIB_RGB_COLORS, SRCCOPY,
    };
    if width == 0 || height == 0 {
        return Err("截图尺寸无效".to_string());
    }
    unsafe {
        let desktop = GetDC(None);
        if desktop.is_invalid() {
            return Err("无法读取屏幕设备".to_string());
        }
        let memory = CreateCompatibleDC(Some(desktop));
        if memory.is_invalid() {
            let _ = ReleaseDC(None, desktop);
            return Err("无法创建截图设备".to_string());
        }
        let bitmap = CreateCompatibleBitmap(desktop, width as i32, height as i32);
        if bitmap.is_invalid() {
            let _ = DeleteDC(memory);
            let _ = ReleaseDC(None, desktop);
            return Err("无法创建截图位图".to_string());
        }
        let previous = SelectObject(memory, bitmap.into());
        let copied = BitBlt(memory, 0, 0, width as i32, height as i32, Some(desktop), x, y, SRCCOPY);
        let mut info = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: width as i32,
                biHeight: -(height as i32),
                biPlanes: 1,
                biBitCount: 32,
                biCompression: 0,
                ..Default::default()
            },
            ..Default::default()
        };
        let mut pixels = vec![0u8; (width * height * 4) as usize];
        let rows = if copied.is_ok() {
            GetDIBits(memory, bitmap, 0, height, Some(pixels.as_mut_ptr().cast()), &mut info, DIB_RGB_COLORS)
        } else {
            0
        };
        if !previous.is_invalid() {
            SelectObject(memory, previous);
        }
        let _ = DeleteObject(bitmap.into());
        let _ = DeleteDC(memory);
        let _ = ReleaseDC(None, desktop);
        if rows == 0 {
            return Err("读取屏幕像素失败".to_string());
        }
        for pixel in pixels.chunks_exact_mut(4) {
            pixel.swap(0, 2);
            if pixel[3] == 0 {
                pixel[3] = 255;
            }
        }
        Ok(pixels)
    }
}

