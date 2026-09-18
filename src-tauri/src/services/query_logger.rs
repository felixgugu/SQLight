use crate::error::{AppError, AppResult};
use crate::models::query::QueryMessage;
use chrono::Local;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;

pub const LOG_FILE_NAME: &str = "sqlight.log";

static LOG_MUTEX: Mutex<()> = Mutex::new(());

pub struct QueryLogger;

impl QueryLogger {
    /// Resolves the path to sqlight.log located alongside the application.
    pub fn resolve_log_path() -> PathBuf {
        // 1. If running in development (target directory in executable path), place in cwd (project root)
        if let Ok(exe) = std::env::current_exe() {
            if let Some(parent) = exe.parent() {
                let parent_str = parent.to_string_lossy();
                if parent_str.contains("target") {
                    if let Ok(cwd) = std::env::current_dir() {
                        return cwd.join(LOG_FILE_NAME);
                    }
                }
                return parent.join(LOG_FILE_NAME);
            }
        }

        if let Ok(cwd) = std::env::current_dir() {
            return cwd.join(LOG_FILE_NAME);
        }

        PathBuf::from(LOG_FILE_NAME)
    }

    /// Clears/truncates the log file on application startup and writes the session header.
    pub fn init() -> AppResult<PathBuf> {
        let _guard = LOG_MUTEX.lock().unwrap_or_else(|e| e.into_inner());
        let path = Self::resolve_log_path();

        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }

        let now = Local::now().format("%Y-%m-%d %H:%M:%S");
        let header = format!(
            "================================================================================\n\
             SQLight Query Log - Session Started at {}\n\
             Log File: {}\n\
             ================================================================================\n\n",
            now,
            path.display()
        );

        fs::write(&path, header).map_err(|e| AppError::Internal {
            message: format!("Failed to initialize query log file ({}): {}", path.display(), e),
        })?;

        Ok(path)
    }

    /// Logs an executed query with its SQL statements and returned messages.
    /// Strictly excludes any result sets (rows/columns).
    pub fn log_query(
        connection_id: &str,
        database: &str,
        sql: &str,
        messages: &[QueryMessage],
        duration_ms: u64,
        status: &str,
    ) {
        let _guard = LOG_MUTEX.lock().unwrap_or_else(|e| e.into_inner());
        let path = Self::resolve_log_path();

        let mut file = match OpenOptions::new().create(true).append(true).open(&path) {
            Ok(f) => f,
            Err(e) => {
                eprintln!("[QueryLogger] Failed to open log file ({}): {}", path.display(), e);
                return;
            }
        };

        let now = Local::now().format("%Y-%m-%d %H:%M:%S");
        let conn_display = if connection_id.is_empty() { "default" } else { connection_id };
        let db_display = if database.is_empty() { "master" } else { database };

        let mut entry = format!(
            "[{}] [Connection: {}] [Database: {}] [Duration: {}ms] [Status: {}]\n\
             --- SQL ---\n\
             {}\n\
             --- MESSAGES ---\n",
            now, conn_display, db_display, duration_ms, status, sql.trim()
        );

        if messages.is_empty() {
            entry.push_str("(No messages)\n");
        } else {
            for msg in messages {
                let level = msg.level.to_uppercase();
                if let Some(code) = msg.code {
                    let line_str = msg.line_number.map(|l| format!(" Line {}", l)).unwrap_or_default();
                    entry.push_str(&format!("- [{}] (Code {}{}) {}\n", level, code, line_str, msg.message.trim()));
                } else {
                    entry.push_str(&format!("- [{}] {}\n", level, msg.message.trim()));
                }
            }
        }

        entry.push_str("--------------------------------------------------------------------------------\n\n");

        if let Err(e) = file.write_all(entry.as_bytes()) {
            eprintln!("[QueryLogger] Failed to write to log file: {}", e);
        }
    }

    /// Opens the log file using the operating system's default editor.
    pub fn open_log_file() -> AppResult<String> {
        let path = Self::resolve_log_path();
        if !path.exists() {
            let _ = Self::init();
        }

        let abs_path = fs::canonicalize(&path).unwrap_or(path);
        let path_str = abs_path.to_string_lossy().to_string();

        #[cfg(target_os = "windows")]
        {
            use std::process::Command;
            let _ = Command::new("cmd")
                .args(["/C", "start", "", &path_str])
                .spawn();
        }

        Ok(path_str)
    }

    /// Reveals the log file in Windows Explorer.
    pub fn reveal_in_explorer() -> AppResult<String> {
        let path = Self::resolve_log_path();
        if !path.exists() {
            let _ = Self::init();
        }

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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resolve_log_path() {
        let path = QueryLogger::resolve_log_path();
        assert!(path.to_string_lossy().ends_with(LOG_FILE_NAME));
    }

    #[test]
    fn test_log_formatting() {
        let msgs = vec![
            QueryMessage {
                level: "info".to_string(),
                message: "1 row affected".to_string(),
                code: None,
                line_number: None,
                timestamp: "2026-09-18T00:00:00Z".to_string(),
            },
            QueryMessage {
                level: "error".to_string(),
                message: "Invalid table".to_string(),
                code: Some(208),
                line_number: Some(1),
                timestamp: "2026-09-18T00:00:01Z".to_string(),
            },
        ];

        QueryLogger::log_query("test-conn", "test-db", "SELECT 1;", &msgs, 12, "SUCCESS");
        let path = QueryLogger::resolve_log_path();
        let content = fs::read_to_string(&path).unwrap_or_default();
        assert!(content.contains("SELECT 1;"));
        assert!(content.contains("1 row affected"));
        assert!(content.contains("Invalid table"));
        assert!(!content.contains("resultSets"));
    }
}
