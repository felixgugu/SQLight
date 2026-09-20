use crate::services::AiLogger;

#[tauri::command]
pub async fn log_ai_request(
    endpoint: String,
    method: Option<String>,
    content: String,
) -> Result<(), String> {
    let method_str = method.as_deref().unwrap_or("POST");
    AiLogger::log_request(&endpoint, method_str, &content);
    Ok(())
}

#[tauri::command]
pub async fn log_ai_response(
    endpoint: String,
    content: String,
    status: Option<u16>,
    duration_ms: Option<u64>,
    is_error: Option<bool>,
) -> Result<(), String> {
    AiLogger::log_response(
        &endpoint,
        &content,
        status,
        duration_ms,
        is_error.unwrap_or(false),
    );
    Ok(())
}

#[tauri::command]
pub async fn open_ai_log_file() -> Result<String, String> {
    AiLogger::open_log_file().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_ai_log_path() -> Result<String, String> {
    let path = AiLogger::resolve_log_path();
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn clear_ai_log() -> Result<String, String> {
    let path = AiLogger::init().map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}
