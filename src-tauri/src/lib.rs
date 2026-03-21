use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    window::Color,
    AppHandle, Emitter, Manager, Runtime, WebviewWindow,
};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

#[cfg(target_os = "macos")]
use core_graphics::event::CGEvent;
#[cfg(target_os = "macos")]
use core_graphics::event_source::{CGEventSource, CGEventSourceStateID};
#[cfg(target_os = "windows")]
use windows::Win32::Foundation::POINT;
#[cfg(target_os = "windows")]
use windows::Win32::UI::WindowsAndMessaging::GetCursorPos;

const PANEL_MIN_WIDTH: u32 = 600;
const PANEL_MIN_HEIGHT: u32 = 480;
const PANEL_GAP_Y: i32 = 6;
const PANEL_ANIM_MS: u64 = 320;
const PANEL_ANIM_STEP_MS: u64 = 16;
const PANEL_ANIM_MIN_W: u32 = 220;
const PANEL_ANIM_MIN_H: u32 = 40;
const PANEL_ANIM_ARC_PX: f64 = 14.0;
const PANEL_ANIM_OVERSHOOT: f64 = 0.04;

static LAST_PANEL_SIZE: OnceLock<Mutex<Option<tauri::PhysicalSize<u32>>>> = OnceLock::new();

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

fn last_panel_size_lock() -> &'static Mutex<Option<tauri::PhysicalSize<u32>>> {
    LAST_PANEL_SIZE.get_or_init(|| Mutex::new(None))
}

fn set_last_panel_size(size: tauri::PhysicalSize<u32>) {
    if let Ok(mut slot) = last_panel_size_lock().lock() {
        *slot = Some(size);
    }
}

fn get_last_panel_size(
    fallback: tauri::PhysicalSize<u32>,
) -> tauri::PhysicalSize<u32> {
    last_panel_size_lock()
        .lock()
        .ok()
        .and_then(|slot| *slot)
        .unwrap_or(fallback)
}

fn get_main_rect<R: Runtime>(
    app: &AppHandle<R>,
) -> Option<(tauri::PhysicalPosition<i32>, tauri::PhysicalSize<u32>)> {
    let main = app.get_webview_window("main")?;
    let pos = main.outer_position().ok()?;
    let size = main.outer_size().ok()?;
    Some((pos, size))
}

fn panel_target_position(
    main_pos: tauri::PhysicalPosition<i32>,
    main_size: tauri::PhysicalSize<u32>,
    panel_size: tauri::PhysicalSize<u32>,
) -> tauri::PhysicalPosition<i32> {
    let new_x = main_pos.x + ((main_size.width as i32 - panel_size.width as i32) / 2);
    let new_y = main_pos.y + main_size.height as i32 + PANEL_GAP_Y;
    tauri::PhysicalPosition::new(new_x, new_y)
}

fn ease_out_cubic(t: f64) -> f64 {
    1.0 - (1.0 - t).powi(3)
}

fn ease_in_cubic(t: f64) -> f64 {
    t * t * t
}

fn ease_in_quart(t: f64) -> f64 {
    t * t * t * t
}


fn position_panel_under_island_inner<R: Runtime>(app: &AppHandle<R>) {
    let Some(panel) = app.get_webview_window("panel") else {
        return;
    };
    let Ok(panel_size) = panel.outer_size() else {
        return;
    };
    let Some((main_pos, main_size)) = get_main_rect(app) else {
        return;
    };
    let target_pos = panel_target_position(main_pos, main_size, panel_size);
    let _ = panel.set_position(target_pos);
}

#[tauri::command]
fn position_panel_under_island<R: Runtime>(app: AppHandle<R>) {
    position_panel_under_island_inner(&app);
}

#[tauri::command]
fn show_panel<R: Runtime>(app: AppHandle<R>) {
    animate_panel_open(app);
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
            animate_panel_close(app.clone());
        } else {
            animate_panel_open(app.clone());
        }
    }
}

#[tauri::command]
fn animate_panel_open<R: Runtime>(app: AppHandle<R>) {
    let Some(panel) = app.get_webview_window("panel") else {
        return;
    };
    if panel.is_visible().unwrap_or(false) {
        return;
    }
    let Some((main_pos, main_size)) = get_main_rect(&app) else {
        return;
    };

    let fallback_size = panel
        .outer_size()
        .unwrap_or(tauri::PhysicalSize::new(720, 600));
    let target_size = get_last_panel_size(fallback_size);
    let target_pos = panel_target_position(main_pos, main_size, target_size);

    let start_pos = main_pos;
    let start_size = main_size;

    let _ = panel.set_ignore_cursor_events(false);
    let _ = panel.set_min_size(Some(tauri::PhysicalSize::new(
        PANEL_ANIM_MIN_W,
        PANEL_ANIM_MIN_H,
    )));
    let _ = panel.set_position(start_pos);
    let _ = panel.set_size(start_size);
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.show();
        let _ = main.set_always_on_top(true);
    }
    let _ = panel.show();
    let _ = panel.set_focus();
    let _ = panel.set_always_on_top(true);
    let _ = panel.emit("panel-window-anim", true);

    let panel_clone = panel.clone();
    std::thread::spawn(move || {
        let start = Instant::now();
        loop {
            let t = (start.elapsed().as_millis() as f64) / (PANEL_ANIM_MS as f64);
            let t = t.min(1.0);
            let k_pos = ease_out_cubic(t);
            let mut k_size = k_pos;
            if t > 0.8 {
                let u = (t - 0.8) / 0.2;
                let bump = (std::f64::consts::PI * u).sin();
                k_size = k_size * (1.0 + PANEL_ANIM_OVERSHOOT * bump);
            }
            let dir_y = if target_pos.y >= start_pos.y { 1.0 } else { -1.0 };
            let arc = PANEL_ANIM_ARC_PX * 4.0 * t * (1.0 - t) * dir_y;
            let x = start_pos.x as f64 + (target_pos.x - start_pos.x) as f64 * k_pos;
            let y = start_pos.y as f64 + (target_pos.y - start_pos.y) as f64 * k_pos + arc;
            let w =
                start_size.width as f64 + (target_size.width as f64 - start_size.width as f64) * k_size;
            let h =
                start_size.height as f64 + (target_size.height as f64 - start_size.height as f64) * k_size;
            let _ = panel_clone.set_position(tauri::PhysicalPosition::new(x as i32, y as i32));
            let _ = panel_clone.set_size(tauri::PhysicalSize::new(w as u32, h as u32));
            if t >= 1.0 {
                break;
            }
            std::thread::sleep(Duration::from_millis(PANEL_ANIM_STEP_MS));
        }
        let _ = panel_clone.set_position(target_pos);
        let _ = panel_clone.set_size(target_size);
        let _ = panel_clone.set_min_size(Some(tauri::PhysicalSize::new(
            PANEL_MIN_WIDTH,
            PANEL_MIN_HEIGHT,
        )));
        let _ = panel_clone.emit("panel-window-anim", false);
    });
}

#[tauri::command]
fn animate_panel_close<R: Runtime>(app: AppHandle<R>) {
    let Some(panel) = app.get_webview_window("panel") else {
        return;
    };
    if !panel.is_visible().unwrap_or(false) {
        return;
    }
    let Some((main_pos, main_size)) = get_main_rect(&app) else {
        let _ = panel.hide();
        return;
    };

    let start_pos = panel.outer_position().unwrap_or(main_pos);
    let start_size = panel.outer_size().unwrap_or(main_size);
    set_last_panel_size(start_size);

    let target_pos = main_pos;
    let target_size = main_size;

    let _ = panel.set_min_size(Some(tauri::PhysicalSize::new(
        PANEL_ANIM_MIN_W,
        PANEL_ANIM_MIN_H,
    )));
    let _ = panel.emit("panel-window-anim", true);
    let panel_clone = panel.clone();
    std::thread::spawn(move || {
        let start = Instant::now();
        loop {
            let t = (start.elapsed().as_millis() as f64) / (PANEL_ANIM_MS as f64);
            let t = t.min(1.0);
            let k_pos = ease_in_cubic(t);
            let k_w = ease_in_cubic(t);
            let k_h = ease_in_quart(t);
            let dir_y = if target_pos.y >= start_pos.y { 1.0 } else { -1.0 };
            let arc = PANEL_ANIM_ARC_PX * 4.0 * t * (1.0 - t) * dir_y;
            let x = start_pos.x as f64 + (target_pos.x - start_pos.x) as f64 * k_pos;
            let y = start_pos.y as f64 + (target_pos.y - start_pos.y) as f64 * k_pos + arc;
            let w =
                start_size.width as f64 + (target_size.width as f64 - start_size.width as f64) * k_w;
            let h =
                start_size.height as f64 + (target_size.height as f64 - start_size.height as f64) * k_h;
            let _ = panel_clone.set_position(tauri::PhysicalPosition::new(x as i32, y as i32));
            let _ = panel_clone.set_size(tauri::PhysicalSize::new(w as u32, h as u32));
            if t >= 1.0 {
                break;
            }
            std::thread::sleep(Duration::from_millis(PANEL_ANIM_STEP_MS));
        }
        let _ = panel_clone.set_position(target_pos);
        let _ = panel_clone.set_size(target_size);
        let _ = panel_clone.hide();
        let _ = panel_clone.set_min_size(Some(tauri::PhysicalSize::new(
            PANEL_MIN_WIDTH,
            PANEL_MIN_HEIGHT,
        )));
        let _ = panel_clone.emit("panel-window-anim", false);
    });
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
        .on_tray_icon_event(|app, event| {
            if let TrayIconEvent::Click {
                button,
                button_state,
                ..
            } = event
            {
                if button == MouseButton::Left && button_state == MouseButtonState::Up {
                    toggle_panel(app.clone());
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_mouse_position,
            set_click_through,
            set_island_height,
            get_window_position,
            position_panel_under_island,
            animate_panel_open,
            animate_panel_close,
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
                let _ = window.set_background_color(Some(Color(0, 0, 0, 0)));
                // 不再默认调用 set_ignore_cursor_events 以免用户觉得“完全鼠标穿透”难以控制
                // 用户依靠动态窗口高度调整来操作底层元素
            }

            if let Some(panel) = app.get_webview_window("panel") {
                let _ = panel.set_background_color(Some(Color(0, 0, 0, 0)));
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
                        animate_panel_open(app.clone());
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
