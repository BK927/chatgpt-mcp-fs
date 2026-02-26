mod commands;

use commands::{ServerState, get_config, get_server_status, pick_folder, save_config, start_server, stop_server, update_port, validate_folder_path};

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
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
