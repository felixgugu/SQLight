use crate::services::sql_folder_service::{SqlFileNode, SqlFolderService};

#[tauri::command]
pub async fn pick_sql_folder() -> Result<Option<String>, String> {
    Ok(SqlFolderService::pick_folder().await)
}

#[tauri::command]
pub async fn scan_sql_folder(folder_path: String) -> Result<SqlFileNode, String> {
    SqlFolderService::scan_folder(&folder_path)
}

#[tauri::command]
pub async fn read_sql_file(file_path: String) -> Result<String, String> {
    SqlFolderService::read_file(&file_path)
}

#[tauri::command]
pub async fn write_sql_file(file_path: String, content: String) -> Result<(), String> {
    SqlFolderService::write_file(&file_path, &content)
}

#[tauri::command]
pub async fn rename_sql_path(old_path: String, new_path: String) -> Result<(), String> {
    SqlFolderService::rename_path(&old_path, &new_path)
}
