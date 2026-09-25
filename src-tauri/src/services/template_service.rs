use crate::error::{AppError, AppResult};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomTemplateItem {
    pub id: String,
    pub title: String,
    pub category: String,
    #[serde(rename = "categoryLabel")]
    pub category_label: Option<String>,
    pub tags: Vec<String>,
    pub description: String,
    pub code: String,
    #[serde(rename = "isCustom")]
    pub is_custom: Option<bool>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomTemplatesResponse {
    #[serde(rename = "filePath")]
    pub file_path: String,
    pub templates: Vec<CustomTemplateItem>,
}

pub struct TemplateService;

impl TemplateService {
    /// Resolves the path to the custom templates file located alongside the application.
    pub fn resolve_file_path() -> PathBuf {
        const FILE_NAME: &str = "sql_custom_templates.json";

        // 1. Check if it already exists in current working directory (e.g. project root in dev)
        if let Ok(cwd) = std::env::current_dir() {
            let cwd_path = cwd.join(FILE_NAME);
            if cwd_path.exists() {
                return cwd_path;
            }
        }

        // 2. Check if it already exists in the executable's directory (portable production mode)
        if let Ok(exe) = std::env::current_exe() {
            if let Some(parent) = exe.parent() {
                let exe_path = parent.join(FILE_NAME);
                if exe_path.exists() {
                    return exe_path;
                }
            }
        }

        // 3. If it doesn't exist yet, determine the best place to create it:
        // If running in development (target directory in path), place in cwd (project root)
        if let Ok(exe) = std::env::current_exe() {
            if let Some(parent) = exe.parent() {
                let parent_str = parent.to_string_lossy();
                if parent_str.contains("target") {
                    if let Ok(cwd) = std::env::current_dir() {
                        return cwd.join(FILE_NAME);
                    }
                }
                return parent.join(FILE_NAME);
            }
        }

        if let Ok(cwd) = std::env::current_dir() {
            return cwd.join(FILE_NAME);
        }

        PathBuf::from(FILE_NAME)
    }

    /// Ensures the default sample file exists if the file is not found on disk.
    fn ensure_file_exists(path: &Path) -> AppResult<()> {
        if path.exists() {
            return Ok(());
        }

        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }

        let sample_templates = vec![CustomTemplateItem {
            id: "custom-sample-1".to_string(),
            title: "範例：自訂業務查詢 (Custom Business Query)".to_string(),
            category: "custom".to_string(),
            category_label: Some("自訂範本".to_string()),
            tags: vec!["範例".to_string(), "自訂".to_string(), "Sample".to_string()],
            description: "這是與應用程式同層放置的自訂語法檔案 (sql_custom_templates.json)。您可隨時以任一文字編輯器 (VS Code、Notepad) 編輯此檔案，儲存後在 PuffSQL 點擊「重新載入」即可即時生效！".to_string(),
            code: "-- 自訂 SQL 語法範本\n-- 支援在 sql_custom_templates.json 中自由擴充團隊專用語法\nSELECT \n    TOP 50 *\nFROM dbo.YourTable\nORDER BY Id DESC;".to_string(),
            is_custom: Some(true),
            created_at: Some(chrono::Utc::now().timestamp_millis()),
        }];

        let json_str = serde_json::to_string_pretty(&sample_templates).map_err(|e| {
            AppError::Internal {
                message: format!("Failed to serialize initial sample templates: {}", e),
            }
        })?;

        fs::write(path, json_str).map_err(|e| AppError::Internal {
            message: format!("Failed to create initial custom templates file: {}", e),
        })?;

        Ok(())
    }

    /// Loads custom templates from sql_custom_templates.json.
    pub fn load_templates() -> AppResult<CustomTemplatesResponse> {
        let path = Self::resolve_file_path();
        Self::ensure_file_exists(&path)?;

        let content = fs::read_to_string(&path).map_err(|e| AppError::Internal {
            message: format!("Failed to read custom templates file at {:?}: {}", path, e),
        })?;

        let templates: Vec<CustomTemplateItem> = match serde_json::from_str(&content) {
            Ok(list) => list,
            Err(e) => {
                eprintln!(
                    "[TemplateService] Warning: Failed to parse custom templates JSON: {}. Returning empty list.",
                    e
                );
                Vec::new()
            }
        };

        let abs_path = fs::canonicalize(&path).unwrap_or(path);

        Ok(CustomTemplatesResponse {
            file_path: abs_path.to_string_lossy().to_string(),
            templates,
        })
    }

    /// Saves custom templates back to sql_custom_templates.json.
    pub fn save_templates(templates: &[CustomTemplateItem]) -> AppResult<String> {
        let path = Self::resolve_file_path();

        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }

        let json_str = serde_json::to_string_pretty(templates).map_err(|e| AppError::Internal {
            message: format!("Failed to serialize custom templates: {}", e),
        })?;

        fs::write(&path, json_str).map_err(|e| AppError::Internal {
            message: format!("Failed to write custom templates to {:?}: {}", path, e),
        })?;

        let abs_path = fs::canonicalize(&path).unwrap_or(path);
        Ok(abs_path.to_string_lossy().to_string())
    }

    /// Opens Windows File Explorer and selects/highlights the file.
    pub fn reveal_in_explorer() -> AppResult<String> {
        let path = Self::resolve_file_path();
        Self::ensure_file_exists(&path)?;

        let abs_path = fs::canonicalize(&path).unwrap_or(path);
        let path_str = abs_path.to_string_lossy().to_string();

        #[cfg(target_os = "windows")]
        {
            use std::process::Command;
            let _ = Command::new("explorer")
                .arg(format!("/select,{}", path_str))
                .spawn();
        }

        Ok(path_str)
    }
}
