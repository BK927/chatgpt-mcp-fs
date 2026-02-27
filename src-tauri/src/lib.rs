mod commands;

use commands::{ServerState, get_config, get_server_status, pick_folder, save_config, start_server, stop_server, update_port, validate_folder_path};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(ServerState::default())
        .invoke_handler(tauri::generate_handler![
            get_server_status,
            start_server,
            stop_server,
            get_config,
            save_config,
            update_port,
            pick_folder,
            validate_folder_path,
        ])
        .on_window_event(|window, event| {
            // Clean up server and ngrok processes when window is closed
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                let state = window.state::<ServerState>();
                let child = state.child.clone();
                let ngrok_child = state.ngrok_child.clone();

                // Spawn a blocking task to kill the processes
                std::thread::spawn(move || {
                    // Kill server process
                    if let Ok(mut child_guard) = child.try_lock() {
                        if let Some(child_process) = child_guard.take() {
                            let _ = child_process.kill();
                        }
                    }
                    // Kill ngrok process
                    if let Ok(mut ngrok_guard) = ngrok_child.try_lock() {
                        if let Some(ngrok_process) = ngrok_guard.take() {
                            let _ = ngrok_process.kill();
                        }
                    }
                });
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
