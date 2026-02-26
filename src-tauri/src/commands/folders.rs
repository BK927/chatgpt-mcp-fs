use tauri_plugin_dialog::DialogExt;

#[tauri::command]
pub async fn pick_folder(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let folder_path = app
        .dialog()
        .file()
        .blocking_pick_folder();

    match folder_path {
        Some(path) => Ok(Some(path.to_string())),
        None => Ok(None),
    }
}

#[tauri::command]
pub async fn validate_folder_path(path: String) -> Result<bool, String> {
    let path = std::path::Path::new(&path);
    Ok(path.exists() && path.is_dir())
}
