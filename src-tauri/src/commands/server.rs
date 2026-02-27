use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{Emitter, Manager};
use tauri_plugin_shell::ShellExt;
use tokio::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerStatus {
    pub running: bool,
    pub port: u16,
    pub pid: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub timestamp: String,
    pub level: String,
    pub message: String,
}

pub struct ServerState {
    pub status: Arc<Mutex<ServerStatus>>,
    pub child: Arc<Mutex<Option<tauri_plugin_shell::process::CommandChild>>>,
}

impl Default for ServerState {
    fn default() -> Self {
        Self {
            status: Arc::new(Mutex::new(ServerStatus {
                running: false,
                port: 3000,
                pid: None,
            })),
            child: Arc::new(Mutex::new(None)),
        }
    }
}

#[tauri::command]
pub async fn get_server_status(state: tauri::State<'_, ServerState>) -> Result<ServerStatus, String> {
    let status = state.status.lock().await;
    Ok(status.clone())
}

#[tauri::command]
pub async fn start_server(
    app: tauri::AppHandle,
    state: tauri::State<'_, ServerState>,
    port: u16,
    issuer_url: Option<String>,
) -> Result<(), String> {
    let mut status = state.status.lock().await;

    if status.running {
        return Err("Server is already running".to_string());
    }

    let shell = app.shell();

    // Get the path to the MCP server
    let server_path = app
        .path()
        .resource_dir()
        .map(|p| p.join("packages").join("mcp-server").join("dist").join("index.js"))
        .map_err(|e| e.to_string())?;

    // On Windows, strip the \\?\ prefix which Node.js doesn't handle well
    let server_path_str = server_path.to_string_lossy().to_string();
    let server_path_str = server_path_str.strip_prefix("\\\\?\\").unwrap_or(&server_path_str).to_string();

    // Build command arguments
    let mut args = vec![
        server_path_str,
        "--transport".to_string(),
        "sse".to_string(),
        "--port".to_string(),
        port.to_string(),
    ];

    // Add issuer URL if provided (for ngrok, etc.)
    if let Some(ref url) = issuer_url {
        args.push("--issuer-url".to_string());
        args.push(url.clone());
    }

    let (mut rx, child) = shell
        .command("node")
        .args(&args)
        .spawn()
        .map_err(|e| format!("Failed to start server: {}", e))?;

    // Store the child process
    let mut child_guard = state.child.lock().await;
    *child_guard = Some(child);

    // Update status
    status.running = true;
    status.port = port;
    let status_clone = status.clone();
    drop(status);

    // Spawn a task to handle logs
    let app_clone = app.clone();
    let status_arc = state.status.clone();
    tauri::async_runtime::spawn(async move {
        use tauri_plugin_shell::process::CommandEvent;

        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    let message = String::from_utf8_lossy(&line).to_string();
                    let _ = app_clone.emit(
                        "server:log",
                        LogEntry {
                            timestamp: chrono_lite_now(),
                            level: "info".to_string(),
                            message,
                        },
                    );
                }
                CommandEvent::Stderr(line) => {
                    let message = String::from_utf8_lossy(&line).to_string();
                    let _ = app_clone.emit(
                        "server:log",
                        LogEntry {
                            timestamp: chrono_lite_now(),
                            level: "error".to_string(),
                            message,
                        },
                    );
                }
                CommandEvent::Error(err) => {
                    let _ = app_clone.emit(
                        "server:log",
                        LogEntry {
                            timestamp: chrono_lite_now(),
                            level: "error".to_string(),
                            message: err.to_string(),
                        },
                    );
                }
                CommandEvent::Terminated(_) => {
                    let mut s = status_arc.lock().await;
                    s.running = false;
                    let _ = app_clone.emit("server:status", s.clone());
                    break;
                }
                _ => {}
            }
        }
    });

    // Emit status update
    let _ = app.emit("server:status", status_clone);

    Ok(())
}

#[tauri::command]
pub async fn stop_server(
    app: tauri::AppHandle,
    state: tauri::State<'_, ServerState>,
) -> Result<(), String> {
    let mut status = state.status.lock().await;

    if !status.running {
        return Err("Server is not running".to_string());
    }

    let mut child_guard = state.child.lock().await;

    if let Some(child) = child_guard.take() {
        child.kill().map_err(|e| format!("Failed to kill server: {}", e))?;
    }

    status.running = false;
    status.pid = None;

    let _ = app.emit("server:status", status.clone());

    Ok(())
}

fn chrono_lite_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};

    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();

    let secs = duration.as_secs();
    let datetime = format_rfc3339(secs);
    datetime
}

fn format_rfc3339(secs: u64) -> String {
    // Simple RFC3339 format without chrono dependency
    let days = secs / 86400;
    let remaining = secs % 86400;
    let hours = remaining / 3600;
    let minutes = (remaining % 3600) / 60;
    let seconds = remaining % 60;

    // Unix epoch (1970-01-01) to date calculation
    let (year, month, day) = unix_days_to_date(days as i64);

    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        year, month, day, hours, minutes, seconds
    )
}

fn unix_days_to_date(days: i64) -> (i32, u32, u32) {
    // Simple conversion from Unix days to Gregorian date
    let mut year = 1970;
    let mut remaining_days = days;

    loop {
        let days_in_year = if is_leap_year(year) { 366 } else { 365 };
        if remaining_days < days_in_year {
            break;
        }
        remaining_days -= days_in_year;
        year += 1;
    }

    let days_in_months = if is_leap_year(year) {
        [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    } else {
        [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    };

    let mut month = 1;
    for &days_in_month in &days_in_months {
        if remaining_days < days_in_month {
            break;
        }
        remaining_days -= days_in_month;
        month += 1;
    }

    let day = remaining_days + 1;

    (year, month, day as u32)
}

fn is_leap_year(year: i32) -> bool {
    (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0)
}
