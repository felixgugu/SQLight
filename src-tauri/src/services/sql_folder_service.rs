use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SqlFileNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: Option<u64>,
    pub modified_time: Option<String>,
    pub children: Option<Vec<SqlFileNode>>,
}

pub struct SqlFolderService;

impl SqlFolderService {
    /// Opens a native folder picker dialog and returns the selected path
    pub async fn pick_folder() -> Option<String> {
        let folder = rfd::AsyncFileDialog::new()
            .set_title("選取 SQL 監控資料夾")
            .pick_folder()
            .await;

        folder.map(|f| f.path().to_string_lossy().to_string())
    }

    /// Scans a root folder and returns its tree structure containing only folders with .sql files and .sql files.
    pub fn scan_folder(folder_path: &str) -> Result<SqlFileNode, String> {
        let root = PathBuf::from(folder_path);
        if !root.exists() {
            return Err(format!("資料夾不存在: {}", folder_path));
        }
        if !root.is_dir() {
            return Err(format!("指定路徑非資料夾: {}", folder_path));
        }

        let root_name = root
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| folder_path.to_string());

        let children = Self::scan_dir_children(&root);

        Ok(SqlFileNode {
            name: root_name,
            path: root.to_string_lossy().to_string(),
            is_dir: true,
            size: None,
            modified_time: None,
            children: Some(children),
        })
    }

    /// Recursively scans directory children.
    /// Prunes subdirectories that do not contain any .sql files.
    fn scan_dir_children(dir: &Path) -> Vec<SqlFileNode> {
        let mut result = Vec::new();

        let entries = match std::fs::read_dir(dir) {
            Ok(entries) => entries,
            Err(_) => return result,
        };

        let mut sub_entries: Vec<std::fs::DirEntry> = entries.filter_map(|e| e.ok()).collect();

        // Sort: directories first (alphabetical), then files (alphabetical)
        sub_entries.sort_by(|a, b| {
            let a_is_dir = a.file_type().map(|t| t.is_dir()).unwrap_or(false);
            let b_is_dir = b.file_type().map(|t| t.is_dir()).unwrap_or(false);

            if a_is_dir != b_is_dir {
                b_is_dir.cmp(&a_is_dir) // directories first
            } else {
                a.file_name()
                    .to_string_lossy()
                    .to_lowercase()
                    .cmp(&b.file_name().to_string_lossy().to_lowercase())
            }
        });

        for entry in sub_entries {
            let path = entry.path();
            let ft = match entry.file_type() {
                Ok(ft) => ft,
                Err(_) => continue,
            };

            if ft.is_dir() {
                // Check if subfolder has .sql files recursively
                let sub_children = Self::scan_dir_children(&path);
                // "空資料夾不顯示": If no .sql files inside, skip this subfolder entirely!
                if !sub_children.is_empty() {
                    result.push(SqlFileNode {
                        name: entry.file_name().to_string_lossy().to_string(),
                        path: path.to_string_lossy().to_string(),
                        is_dir: true,
                        size: None,
                        modified_time: None,
                        children: Some(sub_children),
                    });
                }
            } else if ft.is_file() {
                if let Some(ext) = path.extension() {
                    if ext.to_string_lossy().eq_ignore_ascii_case("sql") {
                        let metadata = entry.metadata().ok();
                        let size = metadata.as_ref().map(|m| m.len());
                        let modified_time = metadata.and_then(|m| m.modified().ok()).map(|t| {
                            let dt: chrono::DateTime<chrono::Utc> = t.into();
                            dt.to_rfc3339()
                        });

                        result.push(SqlFileNode {
                            name: entry.file_name().to_string_lossy().to_string(),
                            path: path.to_string_lossy().to_string(),
                            is_dir: false,
                            size,
                            modified_time,
                            children: None,
                        });
                    }
                }
            }
        }

        result
    }

    /// Reads a SQL file from disk, transparently handling UTF-8, UTF-8 with BOM, and UTF-16 LE/BE (SSMS format)
    pub fn read_file(file_path: &str) -> Result<String, String> {
        let bytes = std::fs::read(file_path)
            .map_err(|e| format!("無法讀取檔案 [{}]: {}", file_path, e))?;

        if bytes.is_empty() {
            return Ok(String::new());
        }

        // 1. UTF-8 with BOM (0xEF, 0xBB, 0xBF)
        if bytes.starts_with(&[0xEF, 0xBB, 0xBF]) {
            return String::from_utf8(bytes[3..].to_vec())
                .map_err(|e| format!("檔案編碼解析錯誤 (UTF-8 with BOM): {}", e));
        }

        // 2. UTF-16 LE with BOM (0xFF, 0xFE) - standard SSMS export format
        if bytes.starts_with(&[0xFF, 0xFE]) {
            let u16_slice: Vec<u16> = bytes[2..]
                .chunks_exact(2)
                .map(|chunk| u16::from_le_bytes([chunk[0], chunk[1]]))
                .collect();
            return String::from_utf16(&u16_slice)
                .map_err(|e| format!("檔案編碼解析錯誤 (UTF-16 LE): {}", e));
        }

        // 3. UTF-16 BE with BOM (0xFE, 0xFF)
        if bytes.starts_with(&[0xFE, 0xFF]) {
            let u16_slice: Vec<u16> = bytes[2..]
                .chunks_exact(2)
                .map(|chunk| u16::from_be_bytes([chunk[0], chunk[1]]))
                .collect();
            return String::from_utf16(&u16_slice)
                .map_err(|e| format!("檔案編碼解析錯誤 (UTF-16 BE): {}", e));
        }

        // 4. Standard UTF-8 or lossy fallback
        match String::from_utf8(bytes.clone()) {
            Ok(s) => Ok(s),
            Err(_) => Ok(String::from_utf8_lossy(&bytes).into_owned()),
        }
    }

    /// Directly saves/overwrites content to the specified file path
    pub fn write_file(file_path: &str, content: &str) -> Result<(), String> {
        std::fs::write(file_path, content)
            .map_err(|e| format!("無法寫入檔案 [{}]: {}", file_path, e))
    }

    /// Renames a file or directory on disk
    pub fn rename_path(old_path: &str, new_path: &str) -> Result<(), String> {
        let old = PathBuf::from(old_path);
        if !old.exists() {
            return Err(format!("原檔案或資料夾不存在: {}", old_path));
        }
        let new = PathBuf::from(new_path);
        if new.exists() {
            return Err(format!("目標路徑已存在同名檔案或資料夾: {}", new_path));
        }
        if let Some(parent) = new.parent() {
            if !parent.exists() {
                return Err(format!("目標上層資料夾不存在: {}", parent.display()));
            }
        }
        std::fs::rename(&old, &new)
            .map_err(|e| format!("重新命名失敗: {}", e))
    }
}
