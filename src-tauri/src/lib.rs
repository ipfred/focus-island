use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    AppHandle, Manager, Runtime, WebviewWindow,
};

#[cfg(target_os = "macos")]
use core_graphics::event::CGEvent;
#[cfg(target_os = "macos")]
use core_graphics::event_source::{CGEventSource, CGEventSourceStateID};
#[cfg(target_os = "windows")]
use windows::Win32::Foundation::POINT;
#[cfg(target_os = "windows")]
use windows::Win32::UI::WindowsAndMessaging::GetCursorPos;

#[tauri::command]
fn get_mouse_position() -> (f64, f64) {
    #[cfg(target_os = "macos")]
    if let Ok(source) = CGEventSource::new(CGEventSourceStateID::CombinedSessionState) {
        if let Ok(event) = CGEvent::new(source) {
            let point = event.location();
            return (point.x, point.y);
        }
    }

    #[cfg(target_os = "windows")]
    {
        let mut point = POINT::default();
        if unsafe { GetCursorPos(&mut point) }.is_ok() {
            return (point.x as f64, point.y as f64);
        }
    }

    (0.0, 0.0)
}

#[tauri::command]
fn set_click_through<R: Runtime>(window: WebviewWindow<R>, ignore: bool) {
    let _ = window.set_ignore_cursor_events(ignore);
}

#[tauri::command]
fn set_island_height<R: Runtime>(app: AppHandle<R>, height: f64) {
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.set_size(tauri::LogicalSize::new(360.0, height));
        if let Ok(Some(monitor)) = main.current_monitor() {
            let scale_factor = monitor.scale_factor();
            let screen_width = monitor.size().width as f64;
            let win_width = 360.0_f64 * scale_factor;
            let position = monitor.position();
            let x = position.x as f64 + (screen_width - win_width) / 2.0;
            let y = position.y as f64;
            let _ = main.set_position(tauri::PhysicalPosition::new(x as i32, y as i32));
        }
    }
}

#[tauri::command]
fn get_window_position<R: Runtime>(window: WebviewWindow<R>) -> (i32, i32) {
    window
        .outer_position()
        .map(|p| (p.x, p.y))
        .unwrap_or((0, 0))
}

#[tauri::command]
fn show_panel<R: Runtime>(app: AppHandle<R>) {
    if let Some(panel) = app.get_webview_window("panel") {
        let _ = panel.set_ignore_cursor_events(false);
        if let Some(main) = app.get_webview_window("main") {
            if let Ok(pos) = main.outer_position() {
                if let Ok(Some(monitor)) = main.current_monitor() {
                    let sf = monitor.scale_factor();
                    // panel is 720 logical wide vs main 360 logical wide
                    let panel_w = 720.0 * sf;
                    let main_w = 360.0 * sf;
                    let new_x = pos.x as f64 - (panel_w - main_w) / 2.0;
                    let new_y = pos.y as f64 + (38.0 * sf); // slightly below the capsule
                    let _ = panel
                        .set_position(tauri::PhysicalPosition::new(new_x as i32, new_y as i32));
                }
            }
            // 确保灵动岛也保持置顶显示
            let _ = main.show();
            let _ = main.set_always_on_top(true);
        }
        let _ = panel.show();
        let _ = panel.set_focus();
        let _ = panel.set_always_on_top(true);
    }
}

#[tauri::command]
fn hide_panel<R: Runtime>(app: AppHandle<R>) {
    if let Some(panel) = app.get_webview_window("panel") {
        let _ = panel.hide();
    }
}

#[tauri::command]
fn toggle_panel<R: Runtime>(app: AppHandle<R>) {
    if let Some(panel) = app.get_webview_window("panel") {
        if panel.is_visible().unwrap_or(false) {
            let _ = panel.hide();
        } else {
            show_panel(app.clone());
        }
    }
}

#[tauri::command]
fn is_panel_visible<R: Runtime>(app: AppHandle<R>) -> bool {
    if let Some(panel) = app.get_webview_window("panel") {
        return panel.is_visible().unwrap_or(false);
    }
    false
}

#[tauri::command]
fn set_island_visible<R: Runtime>(app: AppHandle<R>, visible: bool) {
    if let Some(main) = app.get_webview_window("main") {
        if visible {
            let _ = main.show();
        } else {
            let _ = main.hide();
        }
    }
}

#[tauri::command]
fn get_screen_info<R: Runtime>(app: AppHandle<R>) -> (f64, f64, f64) {
    // 返回 (屏幕物理宽度, 缩放因子, 屏幕左上角物理X)
    if let Some(main) = app.get_webview_window("main") {
        if let Ok(Some(monitor)) = main.current_monitor() {
            let scale_factor = monitor.scale_factor();
            let physical_width = monitor.size().width as f64;
            let position = monitor.position();
            return (physical_width, scale_factor, position.x as f64);
        }
    }
    (1920.0, 1.0, 0.0)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            get_mouse_position,
            set_click_through,
            set_island_height,
            get_window_position,
            show_panel,
            hide_panel,
            toggle_panel,
            is_panel_visible,
            set_island_visible,
            get_screen_info,
        ])
        .setup(|app| {
            // Position main window at top-center
            if let Some(window) = app.get_webview_window("main") {
                if let Ok(Some(monitor)) = window.current_monitor() {
                    let scale_factor = monitor.scale_factor();
                    let screen_width = monitor.size().width as f64;
                    let win_width = 360.0_f64 * scale_factor;
                    let position = monitor.position();
                    // Position at top center of the current monitor
                    let x = position.x as f64 + (screen_width - win_width) / 2.0;
                    let y = position.y as f64;
                    let _ = window.set_position(tauri::PhysicalPosition::new(x as i32, y as i32));
                }
                // 不再默认调用 set_ignore_cursor_events 以免用户觉得“完全鼠标穿透”难以控制
                // 用户依靠动态窗口高度调整来操作底层元素
            }

            // 系统托盘菜单
            let open_panel =
                MenuItem::with_id(app, "open_panel", "打开专注清单", true, None::<&str>)?;
            let toggle_island =
                MenuItem::with_id(app, "toggle_island", "显示/隐藏灵动岛", true, None::<&str>)?;
            let separator = PredefinedMenuItem::separator(app)?;
            let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;

            let menu = Menu::with_items(app, &[&open_panel, &toggle_island, &separator, &quit])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open_panel" => {
                        show_panel(app.clone());
                    }
                    "toggle_island" => {
                        if let Some(main) = app.get_webview_window("main") {
                            if main.is_visible().unwrap_or(true) {
                                let _ = main.hide();
                            } else {
                                let _ = main.show();
                            }
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
