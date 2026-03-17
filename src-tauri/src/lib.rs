use tauri::{Manager, Runtime, WebviewWindow};

#[tauri::command]
fn set_click_through<R: Runtime>(window: WebviewWindow<R>, ignore: bool) {
    let _ = window.set_ignore_cursor_events(ignore);
}

#[tauri::command]
fn get_window_position<R: Runtime>(window: WebviewWindow<R>) -> (i32, i32) {
    window.outer_position().map(|p| (p.x, p.y)).unwrap_or((0, 0))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            set_click_through,
            get_window_position,
        ])
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            // Position window at top-center on startup
            if let Ok(monitor) = window.current_monitor() {
                if let Some(monitor) = monitor {
                    let scale_factor = monitor.scale_factor();
                    let screen_width = monitor.size().width as f64 / scale_factor;
                    let win_width = 360.0_f64;
                    let x = ((screen_width - win_width) / 2.0) * scale_factor;
                    let _ = window.set_position(tauri::PhysicalPosition::new(x as i32, (4.0 * scale_factor) as i32));
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
