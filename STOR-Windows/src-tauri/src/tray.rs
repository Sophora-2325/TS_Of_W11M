use tauri::{
    AppHandle, Manager,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};

use crate::config::ConfigState;

pub fn setup_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let open_translate =
        MenuItem::with_id(app, "open_translate", "打开翻译", true, None::<&str>)?;
    let open_settings =
        MenuItem::with_id(app, "open_settings", "打开设置", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "退出 STOR", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[&open_translate, &open_settings, &separator, &quit],
    )?;

    let _tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .tooltip("STOR - 游戏屏幕翻译")
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open_translate" => {
                open_manual_popup(app);
            }
            "open_settings" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "quit" => {
                crate::request_app_exit(app);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                open_manual_popup(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}

fn open_manual_popup(app: &AppHandle) {
    if let Some(state) = app.try_state::<ConfigState>() {
        let config = state.0.lock().unwrap().clone();
        crate::open_manual_popup(app.clone(), &config);
    }
}
