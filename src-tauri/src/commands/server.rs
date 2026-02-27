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
    pub ngrok_running: bool,
    pub ngrok_url: Option<String>,
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
    pub ngrok_child: Arc<Mutex<Option<tauri_plugin_shell::process::CommandChild>>>,
    pub ngrok_url: Arc<Mutex<Option<String>>>,
}

impl Default for ServerState {
    fn default() -> Self {
        Self {
            status: Arc::new(Mutex::new(ServerStatus {
                running: false,
                port: 3000,
                pid: None,
                ngrok_running: false,
                ngrok_url: None,
            })),
            child: Arc::new(Mutex::new(None)),
            ngrok_child: Arc::new(Mutex::new(None)),
            ngrok_url: Arc::new(Mutex::new(None)),
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
    ngrok_enabled: bool,
) -> Result<(), String> {
    let mut status = state.status.lock().await;

    if status.running {
        return Err("Server is already running".to_string());
    }

    let shell = app.shell();

    // Start ngrok if enabled
    let ngrok_url = if ngrok_enabled {
        drop(status); // Release lock before starting ngrok

        let _ = app.emit(
            "server:log",
            LogEntry {
                timestamp: chrono_lite_now(),
                level: "info".to_string(),
                message: "Starting ngrok...".to_string(),
            },
        );

        match start_ngrok(&app, &state, port).await {
            Ok(url) => {
                let _ = app.emit(
                    "server:log",
                    LogEntry {
                        timestamp: chrono_lite_now(),
                        level: "info".to_string(),
                        message: format!("Ngrok started: {}", url),
                    },
                );
                Some(url)
            }
            Err(e) => {
                let _ = app.emit(
                    "server:log",
                    LogEntry {
                        timestamp: chrono_lite_now(),
                        level: "error".to_string(),
                        message: format!("Failed to start ngrok: {}", e),
                    },
                );
                None
            }
        }
    } else {
        None
    };

    status = state.status.lock().await;

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

    // Add issuer URL from ngrok if available
    if let Some(ref url) = ngrok_url {
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
    status.ngrok_running = ngrok_url.is_some();
    status.ngrok_url = ngrok_url.clone();
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

                    // Check if message actually contains an error
                    let level = if message.to_lowercase().contains("error") {
                        "error"
                    } else {
                        "info"
                    };

                    let _ = app_clone.emit(
                        "server:log",
                        LogEntry {
                            timestamp: chrono_lite_now(),
                            level: level.to_string(),
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

async fn start_ngrok(app: &tauri::AppHandle, state: &tauri::State<'_, ServerState>, port: u16) -> Result<String, String> {
    let shell = app.shell();

    // First, check if ngrok is installed
    let ngrok_check = shell.command("ngrok").args(["version"]).output().await;
    if ngrok_check.is_err() {
        let error_msg = "ngrok is not installed or not in PATH.\n\nTo use ngrok:\n1. Download ngrok from https://ngrok.com/download\n2. Install it and add to PATH\n3. Run 'ngrok config add-authtoken YOUR_TOKEN' to configure";
        let _ = app.emit(
            "server:log",
            LogEntry {
                timestamp: chrono_lite_now(),
                level: "error".to_string(),
                message: error_msg.to_string(),
            },
        );
        return Err(error_msg.to_string());
    }

    // Start ngrok with the API enabled
    let spawn_result = shell
        .command("ngrok")
        .args(["http", "--log=stdout", &port.to_string()])
        .spawn();

    let (mut rx, child) = match spawn_result {
        Ok(result) => result,
        Err(e) => {
            let error_msg = format!("Failed to start ngrok: {}\n\nMake sure ngrok is properly installed.", e);
            let _ = app.emit(
                "server:log",
                LogEntry {
                    timestamp: chrono_lite_now(),
                    level: "error".to_string(),
                    message: error_msg.clone(),
                },
            );
            return Err(error_msg);
        }
    };

    // Store the ngrok child process
    let mut ngrok_child_guard = state.ngrok_child.lock().await;
    *ngrok_child_guard = Some(child);
    drop(ngrok_child_guard);

    // Wait for ngrok to start and get the public URL
    let ngrok_url_arc = state.ngrok_url.clone();
    let ngrok_url_arc_for_spawn = ngrok_url_arc.clone();
    let app_clone = app.clone();

    // Spawn a task to handle ngrok logs and extract URL
    tauri::async_runtime::spawn(async move {
        use tauri_plugin_shell::process::CommandEvent;

        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) | CommandEvent::Stderr(line) => {
                    let message = String::from_utf8_lossy(&line).to_string();

                    // Check for authtoken error
                    if message.contains("authtoken") && (message.contains("not found") || message.contains("required") || message.contains("config")) {
                        let _ = app_clone.emit(
                            "server:log",
                            LogEntry {
                                timestamp: chrono_lite_now(),
                                level: "error".to_string(),
                                message: "ngrok authtoken not configured.\n\nRun: ngrok config add-authtoken YOUR_TOKEN\n\nGet your token from: https://dashboard.ngrok.com/get-started/your-authtoken".to_string(),
                            },
                        );
                    } else {
                        // Log ngrok output
                        let _ = app_clone.emit(
                            "server:log",
                            LogEntry {
                                timestamp: chrono_lite_now(),
                                level: "info".to_string(),
                                message: format!("[ngrok] {}", message),
                            },
                        );
                    }

                    // Try to extract the public URL from ngrok output
                    // ngrok outputs URLs like: "url=https://xxxx.ngrok-free.app"
                    if message.contains("ngrok-free.app") || message.contains("ngrok.io") {
                        // Try to extract URL
                        if let Some(start) = message.find("https://") {
                            if let Some(end) = message[start..].find(|c: char| c.is_whitespace() || c == '"') {
                                let url = &message[start..start + end];
                                let mut url_guard = ngrok_url_arc_for_spawn.lock().await;
                                *url_guard = Some(url.to_string());
                            } else {
                                // URL might be at the end of the line
                                let url = message[start..].trim();
                                if url.starts_with("https://") {
                                    let mut url_guard = ngrok_url_arc_for_spawn.lock().await;
                                    *url_guard = Some(url.to_string());
                                }
                            }
                        }
                    }
                }
                CommandEvent::Terminated(_) => {
                    break;
                }
                _ => {}
            }
        }
    });

    // Wait a bit for ngrok to start and get the URL via API
    tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;

    // Try to get the URL from ngrok API
    let client = reqwest::Client::new();
    for i in 0..10 {
        match client.get("http://127.0.0.1:4040/api/tunnels").send().await {
            Ok(response) => {
                if response.status().is_success() {
                    if let Ok(text) = response.text().await {
                        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) {
                            if let Some(tunnels) = json.get("tunnels").and_then(|t| t.as_array()) {
                                if let Some(first_tunnel) = tunnels.first() {
                                    if let Some(public_url) = first_tunnel.get("public_url").and_then(|u| u.as_str()) {
                                        let mut url_guard = ngrok_url_arc.lock().await;
                                        *url_guard = Some(public_url.to_string());

                                        let _ = app.emit(
                                            "server:log",
                                            LogEntry {
                                                timestamp: chrono_lite_now(),
                                                level: "info".to_string(),
                                                message: format!("ngrok tunnel established: {}", public_url),
                                            },
                                        );

                                        return Ok(public_url.to_string());
                                    }
                                }
                            }
                        }
                    }
                }
            }
            _ => {}
        }
        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
    }

    // If we couldn't get the URL from API, provide helpful error
    let error_msg = "Failed to get ngrok URL after 5 seconds.\n\nPossible causes:\n1. ngrok authtoken not configured - run: ngrok config add-authtoken YOUR_TOKEN\n2. ngrok service is not responding\n3. Port is already in use by another ngrok instance";
    let _ = app.emit(
        "server:log",
        LogEntry {
            timestamp: chrono_lite_now(),
            level: "error".to_string(),
            message: error_msg.to_string(),
        },
    );
    Err(error_msg.to_string())
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

    // Kill the server process
    let mut child_guard = state.child.lock().await;
    if let Some(child) = child_guard.take() {
        child.kill().map_err(|e| format!("Failed to kill server: {}", e))?;
    }
    drop(child_guard);

    // Kill ngrok if running
    let mut ngrok_child_guard = state.ngrok_child.lock().await;
    if let Some(ngrok_child) = ngrok_child_guard.take() {
        let _ = ngrok_child.kill();
        let _ = app.emit(
            "server:log",
            LogEntry {
                timestamp: chrono_lite_now(),
                level: "info".to_string(),
                message: "Ngrok stopped".to_string(),
            },
        );
    }
    drop(ngrok_child_guard);

    // Clear ngrok URL
    let mut ngrok_url_guard = state.ngrok_url.lock().await;
    *ngrok_url_guard = None;
    drop(ngrok_url_guard);

    status.running = false;
    status.pid = None;
    status.ngrok_running = false;
    status.ngrok_url = None;

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
