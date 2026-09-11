use crate::models::query::QueryResult;
use crate::services::ConnectionManager;
use tauri::State;

#[tauri::command]
pub async fn execute_query(
    connection_id: String,
    sql: String,
    max_rows: Option<usize>,
    manager: State<'_, ConnectionManager>,
) -> Result<QueryResult, String> {
    manager
        .execute_query(&connection_id, &sql, max_rows)
        .await
        .map_err(|e| e.to_string())
}
