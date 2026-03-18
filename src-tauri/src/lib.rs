use tauri::{
    AppHandle, Manager, Runtime, WebviewWindow,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
};

#[tauri::command]
fn set_click_through<R: Runtime>(window: WebviewWindow<R>, ignore: bool) {
    let _ = window.set_ignore_cursor_events(ignore);
}

#[tauri::command]
fn get_window_position<R: Runtime>(window: WebviewWindow<R>) -> (i32, i32) {
    window.outer_position().map(|p| (p.x, p.y)).unwrap_or((0, 0))
}

#[tauri::command]
fn show_panel<R: Runtime>(app: AppHandle<R>) {
    if let Some(panel) = app.get_webview_window("panel") {
        let _ = panel.show();
        let _ = panel.set_focus();
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
            let _ = panel.show();
            let _ = panel.set_focus();
        }
    }
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            set_click_through,
            get_window_position,
            show_panel,
            hide_panel,
            toggle_panel,
            set_island_visible,
        ])
        .setup(|app| {
            // Position main window at top-center
            if let Some(window) = app.get_webview_window("main") {
                if let Ok(Some(monitor)) = window.current_monitor() {
                    let scale_factor = monitor.scale_factor();
                    let screen_width = monitor.size().width as f64 / scale_factor;
                    let win_width = 360.0_f64;
                    let x = ((screen_width - win_width) / 2.0) * scale_factor;
                    let _ = window.set_position(tauri::PhysicalPosition::new(
                        x as i32,
                        (4.0 * scale_factor) as i32,
                    ));
                }
                // 灵动岛始终 click-through
                let _ = window.set_ignore_cursor_events(true);
            }

            // 系统托盘菜单
            let open_panel = MenuItem::with_id(app, "open_panel", "打开专注清单", true, None::<&str>)?;
            let toggle_island = MenuItem::with_id(app, "toggle_island", "显示/隐藏灵动岛", true, None::<&str>)?;
            let separator = PredefinedMenuItem::separator(app)?;
            let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;

            let menu = Menu::with_items(app, &[&open_panel, &toggle_island, &separator, &quit])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open_panel" => {
                        if let Some(panel) = app.get_webview_window("panel") {
                            let _ = panel.show();
                            let _ = panel.set_focus();
                        }
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
