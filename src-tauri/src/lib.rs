use tauri::{
    image::Image,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    window::Color,
    AppHandle, Emitter, Manager, Runtime, WebviewWindow, WindowEvent,
};
use std::sync::{Mutex, OnceLock};

#[cfg(target_os = "macos")]
use core_graphics::event::CGEvent;
#[cfg(target_os = "macos")]
use core_graphics::event_source::{CGEventSource, CGEventSourceStateID};
#[cfg(target_os = "windows")]
use windows::Win32::Foundation::POINT;
#[cfg(target_os = "windows")]
use windows::Win32::UI::WindowsAndMessaging::GetCursorPos;

#[cfg(target_os = "linux")]
use x11::xlib;

const PANEL_GAP_Y: i32 = 6;
const TRAY_ICON_BYTES: &[u8] = include_bytes!("../icons/icon.png");

static LAST_PANEL_SIZE: OnceLock<Mutex<Option<tauri::PhysicalSize<u32>>>> = OnceLock::new();

// Radio playback: rodio's OutputStream is !Send, so all audio state lives in a dedicated thread.
// Commands are sent via mpsc channel. The shared state only holds Send-safe metadata.

enum RadioCmd {
    Play { url: String, result_tx: std::sync::mpsc::Sender<Result<(), String>> },
    Pause,
    Resume,
    Stop,
    SetVolume { volume: f64 },
}

struct RadioState {
    playing: Mutex<bool>,
    current_url: Mutex<Option<String>>,
    tx: std::sync::mpsc::Sender<RadioCmd>,
}

static RADIO: OnceLock<RadioState> = OnceLock::new();

fn radio_state() -> &'static RadioState {
    RADIO.get_or_init(|| {
        let (tx, rx) = std::sync::mpsc::channel::<RadioCmd>();

        std::thread::spawn(move || {
            let mut _stream: Option<rodio::OutputStream> = None;
            let mut _handle: Option<rodio::OutputStreamHandle> = None;
            let mut sink: Option<rodio::Sink> = None;

            while let Ok(cmd) = rx.recv() {
                match cmd {
                    RadioCmd::Play { url, result_tx } => {
                        eprintln!("[Radio] 收到播放命令: {}", url);

                        // Stop previous
                        if let Some(s) = sink.take() {
                            eprintln!("[Radio] 停止之前的播放");
                            s.stop();
                        }
                        sink = None;
                        _stream = None;
                        _handle = None;

                        // Init output stream
                        eprintln!("[Radio] 初始化音频输出流...");
                        let (stream, handle) = match rodio::OutputStream::try_default() {
                            Ok(pair) => {
                                eprintln!("[Radio] 音频输出流创建成功");
                                pair
                            }
                            Err(e) => {
                                let msg = format!("音频输出错误: {e}");
                                eprintln!("[Radio] {}", msg);
                                let _ = result_tx.send(Err(msg));
                                continue;
                            }
                        };
                        _stream = Some(stream);
                        _handle = Some(handle);

                        let h = _handle.as_ref().unwrap();
                        eprintln!("[Radio] 创建 Sink...");
                        let new_sink = match rodio::Sink::try_new(h) {
                            Ok(s) => {
                                eprintln!("[Radio] Sink 创建成功");
                                s
                            }
                            Err(e) => {
                                let msg = format!("创建 Sink 失败: {e}");
                                eprintln!("[Radio] {}", msg);
                                let _ = result_tx.send(Err(msg));
                                _stream = None;
                                _handle = None;
                                continue;
                            }
                        };

                        // Check if it's a local file (starts with / or ./ or ~/)
                        let decoder_result = if url.starts_with('/') || url.starts_with("./") || url.starts_with("~/") {
                            load_local_file(&url)
                        } else {
                            stream_url_to_decoder(&url)
                        };

                        match decoder_result {
                            Ok(decoder) => {
                                eprintln!("[Radio] 添加音频源到 Sink...");
                                new_sink.append(decoder);
                                eprintln!("[Radio] 开始播放...");
                                new_sink.play();
                                eprintln!("[Radio] 播放状态: {}", if new_sink.is_paused() { "暂停" } else { "播放中" });
                                eprintln!("[Radio] 音量: {}", new_sink.volume());
                                sink = Some(new_sink);
                                let _ = result_tx.send(Ok(()));
                            }
                            Err(e) => {
                                eprintln!("[Radio] 播放失败: {}", e);
                                let _ = result_tx.send(Err(e));
                                _stream = None;
                                _handle = None;
                            }
                        }
                    }
                    RadioCmd::Pause => {
                        eprintln!("[Radio] 收到暂停命令");
                        if let Some(s) = sink.as_ref() {
                            s.pause();
                            eprintln!("[Radio] 已暂停");
                        }
                    }
                    RadioCmd::Resume => {
                        eprintln!("[Radio] 收到恢复命令");
                        if let Some(s) = sink.as_ref() {
                            s.play();
                            eprintln!("[Radio] 已恢复播放");
                        }
                    }
                    RadioCmd::Stop => {
                        eprintln!("[Radio] 收到停止命令");
                        if let Some(s) = sink.take() {
                            s.stop();
                            eprintln!("[Radio] 已停止");
                        }
                        _stream = None;
                        _handle = None;
                    }
                    RadioCmd::SetVolume { volume } => {
                        eprintln!("[Radio] 设置音量: {}", volume);
                        if let Some(s) = sink.as_ref() {
                            let v = (volume / 100.0).clamp(0.0, 1.0) as f32;
                            s.set_volume(v);
                            eprintln!("[Radio] 音量已设置为: {}", v);
                        }
                    }
                }
            }
        });

        RadioState {
            playing: Mutex::new(false),
            current_url: Mutex::new(None),
            tx,
        }
    })
}

/// Stream a URL to a temp file via `reqwest`, then decode from file.
fn stream_url_to_decoder(url: &str) -> Result<rodio::Decoder<std::io::BufReader<std::fs::File>>, String> {
    use std::io::Read;

    eprintln!("[Radio] 开始下载流媒体: {}", url);

    let tmp_dir = std::env::temp_dir().join("focus-island-radio");
    std::fs::create_dir_all(&tmp_dir).map_err(|e| {
        eprintln!("[Radio] 创建临时目录失败: {}", e);
        format!("创建临时目录失败: {e}")
    })?;
    let tmp_path = tmp_dir.join(format!("stream-{}.mp3", std::process::id()));
    eprintln!("[Radio] 临时文件路径: {:?}", tmp_path);

    // Use reqwest to download the stream
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| {
            eprintln!("[Radio] 创建 HTTP 客户端失败: {}", e);
            format!("创建 HTTP 客户端失败: {e}")
        })?;

    eprintln!("[Radio] 发送 HTTP 请求...");
    let mut response = client.get(url).send().map_err(|e| {
        eprintln!("[Radio] HTTP 请求失败: {}", e);
        format!("网络请求失败: {e}")
    })?;

    if !response.status().is_success() {
        let status = response.status();
        eprintln!("[Radio] HTTP 状态码错误: {}", status);
        return Err(format!("HTTP 错误: {status}"));
    }

    eprintln!("[Radio] 开始写入临时文件...");
    let mut file = std::fs::File::create(&tmp_path).map_err(|e| {
        eprintln!("[Radio] 创建临时文件失败: {}", e);
        format!("创建临时文件失败: {e}")
    })?;

    // Download first chunk (enough to start decoding)
    let mut total_bytes = 0usize;
    let mut buffer = vec![0u8; 8192]; // 8KB buffer

    // Download up to 64KB before starting playback
    while total_bytes < 65536 {
        match response.read(&mut buffer) {
            Ok(0) => break, // EOF
            Ok(n) => {
                std::io::Write::write_all(&mut file, &buffer[..n]).map_err(|e| {
                    eprintln!("[Radio] 写入文件失败: {}", e);
                    format!("写入文件失败: {e}")
                })?;
                total_bytes += n;
            }
            Err(e) => {
                eprintln!("[Radio] 读取响应失败: {}", e);
                return Err(format!("读取响应失败: {e}"));
            }
        }
    }

    std::io::Write::flush(&mut file).map_err(|e| {
        eprintln!("[Radio] 刷新文件失败: {}", e);
        format!("刷新文件失败: {e}")
    })?;
    drop(file);

    eprintln!("[Radio] 已下载 {} 字节", total_bytes);

    if total_bytes < 4096 {
        eprintln!("[Radio] 数据不足: {} 字节", total_bytes);
        return Err(format!("流媒体数据不足: {} 字节", total_bytes));
    }

    // Open the file for reading
    eprintln!("[Radio] 打开文件进行解码...");
    let file = std::fs::File::open(&tmp_path).map_err(|e| {
        eprintln!("[Radio] 打开临时文件失败: {}", e);
        format!("打开临时文件失败: {e}")
    })?;
    let reader = std::io::BufReader::new(file);

    eprintln!("[Radio] 创建解码器...");
    let decoder = rodio::Decoder::new(reader).map_err(|e| {
        eprintln!("[Radio] 解码失败: {}", e);
        format!("解码失败: {e}")
    })?;

    eprintln!("[Radio] 解码器创建成功");

    // Continue downloading in background
    let tmp_path_clone = tmp_path.clone();
    std::thread::spawn(move || {
        eprintln!("[Radio] 后台继续下载...");
        if let Ok(mut file) = std::fs::OpenOptions::new().append(true).open(&tmp_path_clone) {
            let _ = std::io::copy(&mut response, &mut file);
        }
        std::thread::sleep(std::time::Duration::from_secs(2));
        let _ = std::fs::remove_file(&tmp_path_clone);
        eprintln!("[Radio] 清理临时文件");
    });

    Ok(decoder)
}

/// Load a local audio file for testing
fn load_local_file(path: &str) -> Result<rodio::Decoder<std::io::BufReader<std::fs::File>>, String> {
    eprintln!("[Radio] 加载本地文件: {}", path);
    let file = std::fs::File::open(path).map_err(|e| {
        eprintln!("[Radio] 打开本地文件失败: {}", e);
        format!("打开文件失败: {e}")
    })?;
    let reader = std::io::BufReader::new(file);
    let decoder = rodio::Decoder::new(reader).map_err(|e| {
        eprintln!("[Radio] 解码本地文件失败: {}", e);
        format!("解码失败: {e}")
    })?;
    eprintln!("[Radio] 本地文件加载成功");
    Ok(decoder)
}

#[tauri::command]
fn radio_play(url: String) -> Result<bool, String> {
    let state = radio_state();
    let (result_tx, result_rx) = std::sync::mpsc::channel();
    state.tx.send(RadioCmd::Play { url: url.clone(), result_tx })
        .map_err(|e| format!("发送播放命令失败: {e}"))?;
    // Wait up to 5 seconds for the play result from the audio thread
    match result_rx.recv_timeout(std::time::Duration::from_secs(5)) {
        Ok(Ok(())) => {
            *state.playing.lock().unwrap() = true;
            *state.current_url.lock().unwrap() = Some(url);
            Ok(true)
        }
        Ok(Err(e)) => {
            *state.playing.lock().unwrap() = false;
            Err(e)
        }
        Err(_timeout) => {
            // Thread is still working (e.g. still buffering), assume it'll succeed
            *state.playing.lock().unwrap() = true;
            *state.current_url.lock().unwrap() = Some(url);
            Ok(true)
        }
    }
}

#[tauri::command]
fn radio_pause() -> Result<bool, String> {
    let state = radio_state();
    *state.playing.lock().unwrap() = false;
    state.tx.send(RadioCmd::Pause)
        .map_err(|e| format!("发送暂停命令失败: {e}"))?;
    Ok(true)
}

#[tauri::command]
fn radio_resume() -> Result<bool, String> {
    let state = radio_state();
    state.tx.send(RadioCmd::Resume)
        .map_err(|e| format!("发送恢复命令失败: {e}"))?;
    *state.playing.lock().unwrap() = true;
    Ok(true)
}

#[tauri::command]
fn radio_stop() -> Result<bool, String> {
    let state = radio_state();
    *state.playing.lock().unwrap() = false;
    *state.current_url.lock().unwrap() = None;
    state.tx.send(RadioCmd::Stop)
        .map_err(|e| format!("发送停止命令失败: {e}"))?;
    Ok(true)
}

#[tauri::command]
fn radio_set_volume(volume: f64) -> Result<bool, String> {
    let state = radio_state();
    state.tx.send(RadioCmd::SetVolume { volume })
        .map_err(|e| format!("发送音量命令失败: {e}"))?;
    Ok(true)
}

#[tauri::command]
fn radio_is_playing() -> bool {
    let state = radio_state();
    *state.playing.lock().unwrap()
}

#[tauri::command]
fn get_local_audio_path<R: Runtime>(app: AppHandle<R>) -> Result<String, String> {
    // Get the resource directory path
    let resource_dir = app.path()
        .resource_dir()
        .map_err(|e| format!("获取资源目录失败: {e}"))?;

    let audio_path = resource_dir.join("assets").join("audio").join("focus-music.mp3");

    // Check if the file exists
    if audio_path.exists() {
        Ok(audio_path.to_string_lossy().to_string())
    } else {
        Err("本地音频文件不存在，请将音频文件放到 assets/audio/focus-music.mp3".to_string())
    }
}

#[derive(serde::Serialize, Clone, Copy)]
struct PanelTransitionMetrics {
    island_x: i32,
    island_y: i32,
    island_width: u32,
    island_height: u32,
    panel_x: i32,
    panel_y: i32,
    panel_width: u32,
    panel_height: u32,
}

#[derive(serde::Serialize)]
struct MacosUpdateHealth {
    app_path: String,
    quarantined: bool,
    repair_command: String,
}

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

    #[cfg(target_os = "linux")]
    unsafe {
        let display = xlib::XOpenDisplay(std::ptr::null());
        if !display.is_null() {
            let mut root_return = 0;
            let mut child_return = 0;
            let mut root_x = 0;
            let mut root_y = 0;
            let mut win_x = 0;
            let mut win_y = 0;
            let mut mask = 0;
            let root = xlib::XDefaultRootWindow(display);
            xlib::XQueryPointer(
                display,
                root,
                &mut root_return,
                &mut child_return,
                &mut root_x,
                &mut root_y,
                &mut win_x,
                &mut win_y,
                &mut mask,
            );
            xlib::XCloseDisplay(display);
            return (root_x as f64, root_y as f64);
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
fn set_island_size<R: Runtime>(app: AppHandle<R>, scale: f64) {
    if let Some(main) = app.get_webview_window("main") {
        let base_width = 360.0;
        let base_height = 42.0;
        let new_width = base_width * scale;
        let new_height = base_height * scale;
        let _ = main.set_size(tauri::LogicalSize::new(new_width, new_height));
        if let Ok(Some(monitor)) = main.current_monitor() {
            let scale_factor = monitor.scale_factor();
            let screen_width = monitor.size().width as f64;
            let position = monitor.position();
            let x = position.x as f64 + (screen_width - new_width * scale_factor) / 2.0;
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
fn emit_island_panel_motion<R: Runtime>(app: AppHandle<R>, phase: String) {
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.emit("island-panel-motion", phase);
    }
}

fn last_panel_size_lock() -> &'static Mutex<Option<tauri::PhysicalSize<u32>>> {
    LAST_PANEL_SIZE.get_or_init(|| Mutex::new(None))
}

fn set_last_panel_size(size: tauri::PhysicalSize<u32>) {
    if let Ok(mut slot) = last_panel_size_lock().lock() {
        *slot = Some(size);
    }
}

fn get_last_panel_size(fallback: tauri::PhysicalSize<u32>) -> tauri::PhysicalSize<u32> {
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

fn panel_config_values<R: Runtime>(app: &AppHandle<R>) -> (f64, f64, f64, f64) {
    if let Some(cfg) = app
        .config()
        .app
        .windows
        .iter()
        .find(|w| w.label == "panel")
    {
        let width = cfg.width;
        let height = cfg.height;
        let min_width = cfg.min_width.unwrap_or(width);
        let min_height = cfg.min_height.unwrap_or(height);
        return (width, height, min_width, min_height);
    }
    (420.0, 600.0, 400.0, 480.0)
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
fn get_panel_transition_metrics<R: Runtime>(app: AppHandle<R>) -> Option<PanelTransitionMetrics> {
    let Some(panel) = app.get_webview_window("panel") else {
        return None;
    };
    let Some((main_pos, main_size)) = get_main_rect(&app) else {
        return None;
    };

    let (cfg_w, cfg_h, cfg_min_w, cfg_min_h) = panel_config_values(&app);
    let scale = panel.scale_factor().unwrap_or(1.0);
    let fallback_size = panel.outer_size().unwrap_or(tauri::PhysicalSize::new(
        (cfg_w * scale).round() as u32,
        (cfg_h * scale).round() as u32,
    ));
    let panel_size = if panel.is_visible().unwrap_or(false) {
        panel.outer_size().unwrap_or(fallback_size)
    } else {
        get_last_panel_size(fallback_size)
    };
    let min_width = (cfg_min_w * scale).round() as u32;
    let min_height = (cfg_min_h * scale).round() as u32;
    let panel_size = tauri::PhysicalSize::new(
        panel_size.width.max(min_width),
        panel_size.height.max(min_height),
    );
    let panel_pos = panel_target_position(main_pos, main_size, panel_size);

    Some(PanelTransitionMetrics {
        island_x: main_pos.x,
        island_y: main_pos.y,
        island_width: main_size.width,
        island_height: main_size.height,
        panel_x: panel_pos.x,
        panel_y: panel_pos.y,
        panel_width: panel_size.width,
        panel_height: panel_size.height,
    })
}

#[tauri::command]
fn show_panel<R: Runtime>(app: AppHandle<R>) {
    animate_panel_open(app);
}

#[tauri::command]
fn hide_panel<R: Runtime>(app: AppHandle<R>) {
    if let Some(panel) = app.get_webview_window("panel") {
        if let Ok(size) = panel.outer_size() {
            set_last_panel_size(size);
        }
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

    let (cfg_w, cfg_h, cfg_min_w, cfg_min_h) = panel_config_values(&app);
    let scale = panel.scale_factor().unwrap_or(1.0);
    let fallback_size = panel.outer_size().unwrap_or(tauri::PhysicalSize::new(
        (cfg_w * scale).round() as u32,
        (cfg_h * scale).round() as u32,
    ));
    let target_size = get_last_panel_size(fallback_size);
    let min_width = (cfg_min_w * scale).round() as u32;
    let min_height = (cfg_min_h * scale).round() as u32;
    let target_size = tauri::PhysicalSize::new(
        target_size.width.max(min_width),
        target_size.height.max(min_height),
    );
    let target_pos = panel_target_position(main_pos, main_size, target_size);

    let _ = panel.set_ignore_cursor_events(false);
    let _ = panel.set_position(target_pos);
    let _ = panel.set_size(target_size);
    let _ = panel.set_min_size(Some(tauri::LogicalSize::new(cfg_min_w, cfg_min_h)));

    if let Some(main) = app.get_webview_window("main") {
        if !main.is_visible().unwrap_or(true) {
            let _ = main.show();
        }
    }
    let _ = panel.show();
    let _ = panel.emit("panel-window-transition", "open");
}

#[tauri::command]
fn animate_panel_close<R: Runtime>(app: AppHandle<R>) {
    let Some(panel) = app.get_webview_window("panel") else {
        return;
    };
    if !panel.is_visible().unwrap_or(false) {
        return;
    }

    if let Ok(size) = panel.outer_size() {
        set_last_panel_size(size);
    }
    if panel.emit("panel-window-transition", "close").is_err() {
        let _ = panel.hide();
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

#[tauri::command]
fn get_macos_update_health<R: Runtime>(_app: AppHandle<R>) -> Option<MacosUpdateHealth> {
    #[cfg(target_os = "macos")]
    {
        let executable = std::env::current_exe().ok()?;
        let mut app_bundle = None;
        for parent in executable.ancestors() {
            if parent.extension().and_then(|e| e.to_str()) == Some("app") {
                app_bundle = Some(parent.to_path_buf());
                break;
            }
        }
        let app_bundle = app_bundle?;
        let app_path = app_bundle.to_string_lossy().into_owned();
        let quarantined = std::process::Command::new("xattr")
            .arg("-p")
            .arg("com.apple.quarantine")
            .arg(&app_bundle)
            .output()
            .map(|output| output.status.success())
            .unwrap_or(false);

        return Some(MacosUpdateHealth {
            repair_command: format!("xattr -dr com.apple.quarantine \"{app_path}\""),
            app_path,
            quarantined,
        });
    }

    #[cfg(not(target_os = "macos"))]
    {
        None
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_clipboard_manager::init())
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
            set_island_size,
            get_window_position,
            emit_island_panel_motion,
            position_panel_under_island,
            get_panel_transition_metrics,
            animate_panel_open,
            animate_panel_close,
            show_panel,
            hide_panel,
            toggle_panel,
            is_panel_visible,
            set_island_visible,
            get_screen_info,
            get_macos_update_health,
            radio_play,
            radio_pause,
            radio_resume,
            radio_stop,
            radio_set_volume,
            radio_is_playing,
            get_local_audio_path,
        ])
        .setup(|app| {
            #[cfg(desktop)]
            {
                app.handle().plugin(
                    tauri_plugin_global_shortcut::Builder::new().build(),
                )?;
            }

            if let Some(window) = app.get_webview_window("main") {
                if let Ok(Some(monitor)) = window.current_monitor() {
                    let scale_factor = monitor.scale_factor();
                    let screen_width = monitor.size().width as f64;
                    let win_width = 360.0_f64 * scale_factor;
                    let position = monitor.position();
                    let x = position.x as f64 + (screen_width - win_width) / 2.0;
                    let y = position.y as f64;
                    let _ = window.set_position(tauri::PhysicalPosition::new(x as i32, y as i32));
                }
                let _ = window.set_background_color(Some(Color(0, 0, 0, 0)));
            }

            if let Some(panel) = app.get_webview_window("panel") {
                let _ = panel.set_background_color(Some(Color(0, 0, 0, 0)));
                let _ = panel.set_shadow(false);
                let app_handle = app.handle().clone();
                panel.on_window_event(move |event| {
                    if let WindowEvent::Resized(size) = event {
                        set_last_panel_size(*size);
                        position_panel_under_island_inner(&app_handle);
                    }
                });
            }

            let open_panel =
                MenuItem::with_id(app, "open_panel", "打开专注清单", true, None::<&str>)?;
            let toggle_island =
                MenuItem::with_id(app, "toggle_island", "显示/隐藏灵动岛", true, None::<&str>)?;
            let separator = PredefinedMenuItem::separator(app)?;
            let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;

            let menu = Menu::with_items(app, &[&open_panel, &toggle_island, &separator, &quit])?;

            let tray_icon = Image::from_bytes(TRAY_ICON_BYTES)?;

            TrayIconBuilder::new()
                .icon(tray_icon)
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
