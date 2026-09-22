use crate::models::connection::{ConnectionProfile, SaveConnectionRequest};
use crate::services::ConnectionManager;
use tauri::State;

#[tauri::command]
pub async fn get_connections(
    manager: State<'_, ConnectionManager>,
) -> Result<Vec<ConnectionProfile>, String> {
    manager.get_profiles().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_connection(
    req: SaveConnectionRequest,
    manager: State<'_, ConnectionManager>,
) -> Result<ConnectionProfile, String> {
    manager.save_profile(req).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_connection(
    id: String,
    manager: State<'_, ConnectionManager>,
) -> Result<(), String> {
    manager.delete_profile(&id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn test_connection(
    req: SaveConnectionRequest,
    manager: State<'_, ConnectionManager>,
) -> Result<(), String> {
    manager.test_connection(req).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn connect(
    id: String,
    manager: State<'_, ConnectionManager>,
) -> Result<(), String> {
    manager.connect(&id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn disconnect(
    id: String,
    manager: State<'_, ConnectionManager>,
) -> Result<(), String> {
    manager.disconnect(&id).await.map_err(|e| e.to_string())
}
