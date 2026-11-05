//! 灵动岛窗口的自愈与诊断日志。
//!
//! Windows 上透明 + 置顶 + 鼠标穿透的窗口，在显示器休眠/唤醒、DPI 变化后，偶尔会被 DWM 合成"丢掉"：
//! 窗口仍在原位、仍是可见状态，但屏幕上什么都不画。这里在这些时机主动重新应用窗口状态，
//! 并把显示器变化与窗口状态写进 `<app_log_dir>/island-diagnostics.log`，便于事后定位。

use std::fs::{self, OpenOptions};
use std::io::Write;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use tauri::{AppHandle, Emitter, Manager, Monitor, Runtime, WebviewWindow};

pub const RESET_EVENT: &str = "island-window-reset";

const LOG_FILE: &str = "island-diagnostics.log";
const LOG_MAX_BYTES: u64 = 1024 * 1024;
const POLL_INTERVAL: Duration = Duration::from_secs(2);
// Display reconfiguration arrives as a burst of changes; reset once things have settled.
const SETTLE_DELAY: Duration = Duration::from_secs(2);
// A tick this late means the machine was asleep (or the process was suspended).
const SLEEP_GAP: Duration = Duration::from_secs(20);
// The page heartbeats every 30s; hidden/occluded pages are throttled to about once a minute.
const HEARTBEAT_STALE: Duration = Duration::from_secs(180);
#[cfg(target_os = "windows")]
const RELOAD_COOLDOWN: Duration = Duration::from_secs(600);
const STATE_LOG_INTERVAL: Duration = Duration::from_secs(30 * 60);

struct WatchState {
    pending_reset: Option<(&'static str, Instant)>,
    last_heartbeat: Instant,
    last_visibility: Option<String>,
    heartbeat_stale: bool,
    #[cfg(target_os = "windows")]
    last_reload: Option<Instant>,
}

static STATE: OnceLock<Mutex<WatchState>> = OnceLock::new();
static LOG_LOCK: Mutex<()> = Mutex::new(());
// Set when the user hides the island from the tray; automatic resets must not bring it back.
static USER_HIDDEN: AtomicBool = AtomicBool::new(false);

fn with_state<T>(f: impl FnOnce(&mut WatchState) -> T) -> Option<T> {
    let state = STATE.get_or_init(|| {
        Mutex::new(WatchState {
            pending_reset: None,
            last_heartbeat: Instant::now(),
            last_visibility: None,
            heartbeat_stale: false,
            #[cfg(target_os = "windows")]
            last_reload: None,
        })
    });
    // The release profile aborts on panic, so a poisoned lock must never be unwrapped.
    state.lock().ok().map(|mut guard| f(&mut guard))
}

pub fn set_user_hidden(hidden: bool) {
    USER_HIDDEN.store(hidden, Ordering::Relaxed);
}

pub fn schedule_reset(reason: &'static str) {
    with_state(|s| s.pending_reset = Some((reason, Instant::now())));
}

fn take_due_reset() -> Option<&'static str> {
    with_state(|s| match s.pending_reset {
        Some((reason, since)) if since.elapsed() >= SETTLE_DELAY => {
            s.pending_reset = None;
            Some(reason)
        }
        _ => None,
    })
    .flatten()
}

pub fn log<R: Runtime>(app: &AppHandle<R>, msg: &str) {
    let Ok(dir) = app.path().app_log_dir() else {
        return;
    };
    let path = dir.join(LOG_FILE);
    let _guard = LOG_LOCK.lock();
    let _ = fs::create_dir_all(&dir);
    if fs::metadata(&path).map(|m| m.len() > LOG_MAX_BYTES).unwrap_or(false) {
        let _ = fs::rename(&path, dir.join(format!("{LOG_FILE}.old")));
    }
    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(&path) {
        let _ = writeln!(file, "{} {}", utc_timestamp(SystemTime::now()), msg);
    }
}

fn utc_timestamp(time: SystemTime) -> String {
    let secs = time
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    let (days, rem) = (secs.div_euclid(86_400), secs.rem_euclid(86_400));
    // Civil-from-days conversion (Howard Hinnant), avoids pulling in a date crate.
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = yoe + era * 400 + i64::from(month <= 2);
    format!(
        "{year:04}-{month:02}-{day:02}T{:02}:{:02}:{:02}Z",
        rem / 3_600,
        rem % 3_600 / 60,
        rem % 60
    )
}

fn describe_monitor(m: &Monitor) -> String {
    format!(
        "{} {}x{}@{},{} scale={}",
        m.name().map(String::as_str).unwrap_or("?"),
        m.size().width,
        m.size().height,
        m.position().x,
        m.position().y,
        m.scale_factor()
    )
}

fn monitors_signature<R: Runtime>(app: &AppHandle<R>) -> String {
    match app.available_monitors() {
        Ok(list) => {
            let mut items: Vec<String> = list.iter().map(describe_monitor).collect();
            items.sort();
            items.join(" | ")
        }
        Err(e) => format!("error: {e}"),
    }
}

pub fn describe_window<R: Runtime>(w: &WebviewWindow<R>) -> String {
    fn show<T: std::fmt::Display>(v: tauri::Result<T>) -> String {
        v.map(|v| v.to_string()).unwrap_or_else(|_| "?".into())
    }
    let pos = w
        .outer_position()
        .map(|p| format!("{},{}", p.x, p.y))
        .unwrap_or_else(|_| "?".into());
    let size = w
        .inner_size()
        .map(|s| format!("{}x{}", s.width, s.height))
        .unwrap_or_else(|_| "?".into());
    let monitor = match w.current_monitor() {
        Ok(Some(m)) => describe_monitor(&m),
        _ => "none".into(),
    };
    #[allow(unused_mut)]
    let mut out = format!(
        "visible={} minimized={} pos={pos} size={size} scale={} monitor=[{monitor}]",
        show(w.is_visible()),
        show(w.is_minimized()),
        show(w.scale_factor()),
    );
    #[cfg(target_os = "windows")]
    out.push_str(&win32_details(w));
    out
}

#[cfg(target_os = "windows")]
fn win32_details<R: Runtime>(w: &WebviewWindow<R>) -> String {
    use windows::core::BOOL;
    use windows::Win32::Foundation::{HWND, LPARAM};
    use windows::Win32::Graphics::Dwm::{DwmGetWindowAttribute, DWMWA_CLOAKED};
    use windows::Win32::UI::WindowsAndMessaging::{
        EnumChildWindows, GetClassNameW, GetWindowLongW, GWL_EXSTYLE, WS_EX_LAYERED,
        WS_EX_TOPMOST, WS_EX_TRANSPARENT,
    };

    unsafe extern "system" fn collect_class(child: HWND, lparam: LPARAM) -> BOOL {
        let classes = &mut *(lparam.0 as *mut Vec<String>);
        let mut buf = [0u16; 128];
        let len = GetClassNameW(child, &mut buf).max(0) as usize;
        classes.push(String::from_utf16_lossy(&buf[..len.min(buf.len())]));
        BOOL(1)
    }

    let Ok(hwnd) = w.hwnd() else {
        return " hwnd=?".into();
    };
    let ex_style = unsafe { GetWindowLongW(hwnd, GWL_EXSTYLE) } as u32;
    let mut cloaked: u32 = 0;
    let _ = unsafe {
        DwmGetWindowAttribute(
            hwnd,
            DWMWA_CLOAKED,
            &mut cloaked as *mut u32 as *mut _,
            std::mem::size_of::<u32>() as u32,
        )
    };
    let mut classes: Vec<String> = Vec::new();
    let _ = unsafe {
        EnumChildWindows(
            Some(hwnd),
            Some(collect_class),
            LPARAM(&mut classes as *mut Vec<String> as isize),
        )
    };
    format!(
        " topmost={} layered={} click_through={} cloaked={cloaked} children=[{}]",
        ex_style & WS_EX_TOPMOST.0 != 0,
        ex_style & WS_EX_LAYERED.0 != 0,
        ex_style & WS_EX_TRANSPARENT.0 != 0,
        classes.join(",")
    )
}

/// Re-applies visibility, z-order, size and position of the island window.
///
/// `explicit` resets come from a user action (tray, opening the panel) and also undo a tray "hide";
/// automatic ones leave a user-hidden island alone.
pub fn reset_island_window<R: Runtime>(app: &AppHandle<R>, reason: &str, explicit: bool) {
    let Some(main) = app.get_webview_window("main") else {
        return;
    };
    if explicit {
        set_user_hidden(false);
    } else if USER_HIDDEN.load(Ordering::Relaxed) {
        log(app, &format!("reset ({reason}) skipped: hidden by user"));
        return;
    }
    log(app, &format!("reset ({reason}) before: {}", describe_window(&main)));

    if main.is_minimized().unwrap_or(false) {
        let _ = main.unminimize();
    }
    if !main.is_visible().unwrap_or(true) {
        let _ = main.show();
    }
    // tao skips same-value updates, so toggle to really re-issue SetWindowPos(HWND_TOPMOST).
    let _ = main.set_always_on_top(false);
    let _ = main.set_always_on_top(true);
    if let Ok(size) = main.inner_size() {
        // A real size change makes the webview and DWM produce a fresh frame for the window.
        let _ = main.set_size(tauri::PhysicalSize::new(size.width, size.height + 1));
        let _ = main.set_size(size);
        if let Ok(Some(monitor)) = main.current_monitor() {
            let x = monitor.position().x + (monitor.size().width as i32 - size.width as i32) / 2;
            let _ = main.set_position(tauri::PhysicalPosition::new(x, monitor.position().y));
        }
    }
    // The page knows whether a notification is showing, so it re-applies its own size and click-through.
    let _ = main.emit(RESET_EVENT, reason);

    log(app, &format!("reset ({reason}) after: {}", describe_window(&main)));
}

#[tauri::command]
pub fn island_heartbeat<R: Runtime>(app: AppHandle<R>, visibility: String) {
    let changes = with_state(|s| {
        s.last_heartbeat = Instant::now();
        let resumed = std::mem::take(&mut s.heartbeat_stale);
        let visibility_changed = s.last_visibility.as_deref() != Some(visibility.as_str());
        if visibility_changed {
            s.last_visibility = Some(visibility.clone());
        }
        (resumed, visibility_changed)
    });
    let Some((resumed, visibility_changed)) = changes else {
        return;
    };
    if resumed {
        log(&app, "island heartbeat resumed");
    }
    if visibility_changed {
        log(&app, &format!("island page visibility={visibility}"));
    }
}

fn check_heartbeat<R: Runtime>(app: &AppHandle<R>) {
    let Some(main) = app.get_webview_window("main") else {
        return;
    };
    if !main.is_visible().unwrap_or(false) {
        // Hidden pages are throttled; start counting again once the window is shown.
        with_state(|s| s.last_heartbeat = Instant::now());
        return;
    }
    let stale = with_state(|s| {
        if s.heartbeat_stale || s.last_heartbeat.elapsed() < HEARTBEAT_STALE {
            return None;
        }
        s.heartbeat_stale = true;
        #[cfg(target_os = "windows")]
        let reload = {
            let allowed = s
                .last_reload
                .map_or(true, |t| t.elapsed() >= RELOAD_COOLDOWN);
            if allowed {
                s.last_reload = Some(Instant::now());
            }
            allowed
        };
        #[cfg(not(target_os = "windows"))]
        let reload = false;
        Some((s.last_heartbeat.elapsed().as_secs(), reload))
    })
    .flatten();
    let Some((age, reload)) = stale else {
        return;
    };
    log(
        app,
        &format!(
            "island heartbeat stale for {age}s, reload={reload}: {}",
            describe_window(&main)
        ),
    );
    // Only on Windows: a stuck WebView2 page there leaves a fully transparent, empty window.
    if reload {
        let _ = main.reload();
    }
}

fn watch_loop<R: Runtime>(app: AppHandle<R>) {
    let mut last_monitors = monitors_signature(&app);
    let mut last_tick = SystemTime::now();
    let mut last_state_log = Instant::now();
    loop {
        std::thread::sleep(POLL_INTERVAL);

        let now = SystemTime::now();
        let gap = now.duration_since(last_tick).unwrap_or_default();
        last_tick = now;
        if gap >= SLEEP_GAP {
            log(&app, &format!("resumed after ~{}s pause", gap.as_secs()));
            with_state(|s| s.last_heartbeat = Instant::now());
            schedule_reset("resume");
        }

        let monitors = monitors_signature(&app);
        if monitors != last_monitors {
            log(&app, &format!("monitors changed: [{last_monitors}] -> [{monitors}]"));
            last_monitors = monitors;
            schedule_reset("display-change");
        }

        if let Some(reason) = take_due_reset() {
            reset_island_window(&app, reason, false);
        }

        check_heartbeat(&app);

        if last_state_log.elapsed() >= STATE_LOG_INTERVAL {
            last_state_log = Instant::now();
            if let Some(main) = app.get_webview_window("main") {
                log(&app, &format!("periodic state: {}", describe_window(&main)));
            }
        }
    }
}

/// Logs the startup state and starts the background display/heartbeat watcher.
pub fn start<R: Runtime>(app: &AppHandle<R>) {
    log(
        app,
        &format!(
            "app start v{} monitors: [{}]",
            app.package_info().version,
            monitors_signature(app)
        ),
    );
    if let Some(main) = app.get_webview_window("main") {
        log(app, &format!("island initial state: {}", describe_window(&main)));
    }
    let app = app.clone();
    let _ = std::thread::Builder::new()
        .name("island-watch".into())
        .spawn(move || watch_loop(app));
}

#[cfg(test)]
mod tests {
    use super::utc_timestamp;
    use std::time::{Duration, UNIX_EPOCH};

    #[test]
    fn formats_utc_timestamps() {
        let at = |secs| utc_timestamp(UNIX_EPOCH + Duration::from_secs(secs));
        assert_eq!(at(0), "1970-01-01T00:00:00Z");
        assert_eq!(at(951_782_400), "2000-02-29T00:00:00Z");
        assert_eq!(at(1_730_000_000), "2024-10-27T03:33:20Z");
        assert_eq!(at(1_798_761_599), "2026-12-31T23:59:59Z");
    }
}
