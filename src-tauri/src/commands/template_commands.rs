use crate::services::template_service::{CustomTemplateItem, CustomTemplatesResponse, TemplateService};

#[tauri::command]
pub async fn load_custom_templates() -> Result<CustomTemplatesResponse, String> {
    TemplateService::load_templates().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_custom_templates(templates: Vec<CustomTemplateItem>) -> Result<String, String> {
    TemplateService::save_templates(&templates).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn open_custom_templates_file() -> Result<String, String> {
    TemplateService::reveal_in_explorer().map_err(|e| e.to_string())
}
