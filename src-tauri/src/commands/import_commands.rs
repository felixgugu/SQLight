use crate::models::import::{ImportCapabilities, ImportProgressEvent, ImportResult, ImportRowPayload};
use crate::services::ConnectionManager;
use tauri::{AppHandle, Emitter, State};

pub const IMPORT_PROGRESS_EVENT: &str = "sqlight:import-progress";

#[tauri::command]
pub async fn get_table_import_capabilities(
    connection_id: String,
    database: Option<String>,
    schema: String,
    table: String,
    manager: State<'_, ConnectionManager>,
) -> Result<ImportCapabilities, String> {
    manager
        .get_import_capabilities(&connection_id, database.as_deref(), &schema, &table)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn import_table_rows(
    connection_id: String,
    database: Option<String>,
    schema: String,
    table: String,
    columns: Vec<String>,
    rows: Vec<ImportRowPayload>,
    manual_identity: Option<bool>,
    import_id: Option<String>,
    app: AppHandle,
    manager: State<'_, ConnectionManager>,
) -> Result<ImportResult, String> {
    let progress_id = import_id.unwrap_or_default();
    let total_rows = rows.len();
    let (progress_tx, mut progress_rx) = tokio::sync::mpsc::unbounded_channel::<usize>();

    let forwarder = tokio::spawn(async move {
        while let Some(processed_rows) = progress_rx.recv().await {
            let _ = app.emit(
                IMPORT_PROGRESS_EVENT,
                ImportProgressEvent {
                    import_id: progress_id.clone(),
                    processed_rows,
                    total_rows,
                },
            );
        }
    });

    let result = manager
        .import_table_rows(
            &connection_id,
            database.as_deref(),
            &schema,
            &table,
            columns,
            rows,
            manual_identity.unwrap_or(false),
            Some(progress_tx),
        )
        .await;

    let _ = forwarder.await;
    result.map_err(|e| e.to_string())
}
