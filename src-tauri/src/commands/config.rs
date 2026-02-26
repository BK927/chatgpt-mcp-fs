use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub port: u16,
    pub allowed_folders: Vec<String>,
    pub auto_start: bool,
    pub ngrok_enabled: bool,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            port: 3000,
            allowed_folders: vec![],
            auto_start: false,
            ngrok_enabled: false,
        }
    }
}

fn get_config_path(app: &tauri::AppHandle) -> PathBuf {
    app.path()
        .app_config_dir()
        .expect("Failed to get config directory")
        .join("config.json")
}

#[tauri::command]
pub async fn get_config(app: tauri::AppHandle) -> Result<AppConfig, String> {
    let config_path = get_config_path(&app);

    if config_path.exists() {
        let content = fs::read_to_string(&config_path)
            .map_err(|e| format!("Failed to read config: {}", e))?;
        let config: AppConfig = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse config: {}", e))?;
        Ok(config)
    } else {
        Ok(AppConfig::default())
    }
}

#[tauri::command]
pub async fn save_config(app: tauri::AppHandle, config: AppConfig) -> Result<(), String> {
    let config_path = get_config_path(&app);

    // Ensure config directory exists
    if let Some(parent) = config_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }

    let content = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;

    fs::write(&config_path, content)
        .map_err(|e| format!("Failed to write config: {}", e))?;

    // Also save to the MCP server's config location
    let server_config_path = app
        .path()
        .resource_dir()
        .map(|p| p.join("packages").join("mcp-server").join("config.json"));

    if let Ok(path) = server_config_path {
        let server_config = serde_json::json!({
            "port": config.port,
            "allowedFolders": config.allowed_folders,
            "autoStart": config.auto_start,
            "ngrokEnabled": config.ngrok_enabled
        });

        let _ = fs::write(&path, serde_json::to_string_pretty(&server_config).unwrap_or_default());
    }

    Ok(())
}

#[tauri::command]
pub async fn update_port(app: tauri::AppHandle, port: u16) -> Result<(), String> {
    let mut config = get_config(app.clone()).await?;
    config.port = port;
    save_config(app, config).await
}
