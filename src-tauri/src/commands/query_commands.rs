use crate::models::query::QueryResult;
use crate::services::ConnectionManager;
use tauri::State;

#[tauri::command]
pub async fn execute_query(
    connection_id: String,
    sql: String,
    max_rows: Option<usize>,
    request_id: Option<String>,
    manager: State<'_, ConnectionManager>,
) -> Result<QueryResult, String> {
    manager
        .execute_query(&connection_id, &sql, max_rows, request_id.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cancel_query(
    connection_id: String,
    request_id: Option<String>,
    manager: State<'_, ConnectionManager>,
) -> Result<(), String> {
    manager
        .cancel_query(&connection_id, request_id.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_connection_spid(
    connection_id: String,
    manager: State<'_, ConnectionManager>,
) -> Result<Option<u32>, String> {
    manager
        .get_connection_spid(&connection_id)
        .await
        .map_err(|e| e.to_string())
}
