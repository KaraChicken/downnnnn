use serde::{Deserialize, Serialize};
use std::{collections::HashMap, path::{Path, PathBuf}, process::{Child, Command, Stdio}, sync::{Arc, Mutex}, thread};
use tauri::{Emitter, Manager, State};

#[derive(Clone)]
struct AppState { children: Arc<Mutex<HashMap<u64, Child>>> }

#[derive(Debug, Serialize, Deserialize)]
struct VideoInfo {
    id: Option<String>, title: Option<String>, uploader: Option<String>, channel: Option<String>,
    thumbnail: Option<String>, duration_string: Option<String>, is_playlist: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
struct Progress { percent: f64, speed: String, downloaded: String, eta: String, phase: String }

fn binary(app: &tauri::AppHandle, name: &str) -> Result<PathBuf, String> {
    let bundled = app.path().resource_dir().map_err(|e| e.to_string())?.join("bin").join(name);
    if bundled.exists() { return Ok(bundled); }
    let dev = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..").join("bin").join(name);
    if dev.exists() { return Ok(dev); }
    let cwd = std::env::current_dir().map_err(|e| e.to_string())?.join("bin").join(name);
    if cwd.exists() { return Ok(cwd); }
    Err(format!("找不到 {}，請放入 bin/ 資料夾。", name))
}

fn parse_json_output(s: &str) -> Result<VideoInfo, String> {
    let line = s.lines().rev().find(|l| l.trim_start().starts_with('{')).ok_or("yt-dlp 沒有回傳 JSON")?;
    let v: serde_json::Value = serde_json::from_str(line).map_err(|e| format!("JSON 解析失敗：{e}"))?;
    Ok(VideoInfo {
        id: v.get("id").and_then(|x| x.as_str()).map(str::to_owned),
        title: v.get("title").and_then(|x| x.as_str()).map(str::to_owned),
        uploader: v.get("uploader").and_then(|x| x.as_str()).map(str::to_owned),
        channel: v.get("channel").and_then(|x| x.as_str()).map(str::to_owned),
        thumbnail: v.get("thumbnail").and_then(|x| x.as_str()).map(str::to_owned),
        duration_string: v.get("duration_string").and_then(|x| x.as_str()).map(str::to_owned),
        is_playlist: v.get("_type").and_then(|x| x.as_str()).map(|x| x == "playlist"),
    })
}

#[tauri::command]
async fn analyze_url(app: tauri::AppHandle, url: String) -> Result<VideoInfo, String> {
    if !(url.starts_with("http://") || url.starts_with("https://")) { return Err("只接受 http/https 網址".into()); }
    let ytdlp = binary(&app, if cfg!(windows) { "yt-dlp.exe" } else { "yt-dlp" })?;
    let out = Command::new(ytdlp)
        .args(["--no-warnings", "--skip-download", "--dump-single-json", "--no-playlist", &url])
        .output().map_err(|e| e.to_string())?;
    if !out.status.success() { return Err(String::from_utf8_lossy(&out.stderr).to_string()); }
    parse_json_output(&String::from_utf8_lossy(&out.stdout))
}

fn format_args(format: &str) -> Vec<String> {
    match format {
        "1080" => vec!["-f".into(), "bestvideo[height<=1080]+bestaudio/best[height<=1080]".into()],
        "720" => vec!["-f".into(), "bestvideo[height<=720]+bestaudio/best[height<=720]".into()],
        "480" => vec!["-f".into(), "bestvideo[height<=480]+bestaudio/best[height<=480]".into()],
        "360" => vec!["-f".into(), "bestvideo[height<=360]+bestaudio/best[height<=360]".into()],
        "audio" => vec!["-f".into(), "bestaudio/best".into(), "-x".into(), "--audio-format".into(), "m4a".into()],
        "mp3" => vec!["-f".into(), "bestaudio/best".into(), "-x".into(), "--audio-format".into(), "mp3".into(), "--audio-quality".into(), "0".into()],
        _ => vec!["-f".into(), "bestvideo+bestaudio/best".into()],
    }
}

#[tauri::command]
async fn start_download(
    app: tauri::AppHandle, state: State<'_, AppState>, url: String, output_dir: String, format: String
) -> Result<u64, String> {
    if !(url.starts_with("http://") || url.starts_with("https://")) { return Err("只接受 http/https 網址".into()); }
    let dir = Path::new(&output_dir);
    if !dir.exists() { return Err("下載資料夾不存在".into()); }
    let ytdlp = binary(&app, if cfg!(windows) { "yt-dlp.exe" } else { "yt-dlp" })?;
    let ffmpeg = binary(&app, if cfg!(windows) { "ffmpeg.exe" } else { "ffmpeg" }).ok();
    let task_id = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as u64;
    let template = dir.join("%(title)s [%(id)s].%(ext)s").to_string_lossy().into_owned();
    let mut args = vec![
        "--newline".into(), "--no-playlist".into(),
        "--progress-template".into(),
        "%(progress._percent_str)s|%(progress._speed_str)s|%(progress._downloaded_bytes_str)s|%(progress._eta_str)s".into(),
        "-o".into(), template, "--".into()
    ];
    args.extend(format_args(&format));
    if let Some(ff) = ffmpeg { args.extend(["--ffmpeg-location".into(), ff.to_string_lossy().into_owned()]); }
    args.push(url);
    let mut child = Command::new(ytdlp).args(args).stdout(Stdio::piped()).stderr(Stdio::piped()).spawn().map_err(|e| e.to_string())?;
    let stdout = child.stdout.take(); let stderr = child.stderr.take();
    state.children.lock().unwrap().insert(task_id, child);
    let children = state.children.clone(); let handle = app.clone();
    thread::spawn(move || {
        use std::io::{BufRead, BufReader};
        if let Some(out) = stdout {
            for line in BufReader::new(out).lines().flatten() {
                let _ = handle.emit("download-log", line.clone());
                let parts: Vec<&str> = line.split('|').collect();
                if parts.len() >= 4 {
                    let percent = parts[0].trim().trim_end_matches('%').parse().unwrap_or(0.0);
                    let _ = handle.emit("download-progress", Progress {
                        percent, speed: parts[1].trim().into(), downloaded: parts[2].trim().into(),
                        eta: parts[3].trim().into(), phase: "download".into()
                    });
                }
            }
        }
        if let Some(err) = stderr {
            for line in BufReader::new(err).lines().flatten() { let _ = handle.emit("download-log", line); }
        }
        let mut map = children.lock().unwrap();
        if let Some(mut child) = map.remove(&task_id) {
            let success = child.wait().map(|s| s.success()).unwrap_or(false);
            let _ = handle.emit("download-finished", serde_json::json!({"success": success, "path": output_dir}));
        }
    });
    Ok(task_id)
}

#[tauri::command]
fn cancel_download(state: State<'_, AppState>, task_id: u64) -> Result<(), String> {
    if let Some(child) = state.children.lock().unwrap().get_mut(&task_id) {
        child.kill().map_err(|e| e.to_string())?;
        Ok(())
    } else { Err("找不到下載任務".into()) }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState { children: Arc::new(Mutex::new(HashMap::new())) })
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![analyze_url, start_download, cancel_download])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}