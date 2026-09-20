use crate::error::{AppError, AppResult};
use chrono::Local;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;

pub const LOG_FILE_NAME: &str = "ai.log";

static LOG_MUTEX: Mutex<()> = Mutex::new(());

pub struct AiLogger;

impl AiLogger {
    /// Resolves the path to ai.log located alongside the application.
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
             SQLight AI Request Log - Session Started at {}\n\
             Log File: {}\n\
             ================================================================================\n\n",
            now,
            path.display()
        );

        fs::write(&path, header).map_err(|e| AppError::Internal {
            message: format!("Failed to initialize AI log file ({}): {}", path.display(), e),
        })?;

        Ok(path)
    }

    /// Logs an AI API request with its endpoint, method, and payload content.
    pub fn log_request(endpoint: &str, method: &str, content: &str) {
        let _guard = LOG_MUTEX.lock().unwrap_or_else(|e| e.into_inner());
        let path = Self::resolve_log_path();

        let mut file = match OpenOptions::new().create(true).append(true).open(&path) {
            Ok(f) => f,
            Err(e) => {
                eprintln!("[AiLogger] Failed to open log file ({}): {}", path.display(), e);
                return;
            }
        };

        let now = Local::now().format("%Y-%m-%d %H:%M:%S");
        let method_display = if method.is_empty() { "POST" } else { method };

        // Attempt pretty-printing if content is JSON
        let formatted_content = if let Ok(val) = serde_json::from_str::<serde_json::Value>(content) {
            serde_json::to_string_pretty(&val).unwrap_or_else(|_| content.to_string())
        } else {
            content.to_string()
        };

        let entry = format!(
            "[{}] [REQUEST] [{}] {}\n\
             --- REQUEST CONTENT ---\n\
             {}\n\
             --------------------------------------------------------------------------------\n\n",
            now, method_display, endpoint, formatted_content.trim()
        );

        if let Err(e) = file.write_all(entry.as_bytes()) {
            eprintln!("[AiLogger] Failed to write to AI log file: {}", e);
        }
    }

    /// Logs an AI API response with its endpoint, status code, duration, and response payload content.
    pub fn log_response(
        endpoint: &str,
        content: &str,
        status: Option<u16>,
        duration_ms: Option<u64>,
        is_error: bool,
    ) {
        let _guard = LOG_MUTEX.lock().unwrap_or_else(|e| e.into_inner());
        let path = Self::resolve_log_path();

        let mut file = match OpenOptions::new().create(true).append(true).open(&path) {
            Ok(f) => f,
            Err(e) => {
                eprintln!("[AiLogger] Failed to open log file ({}): {}", path.display(), e);
                return;
            }
        };

        let now = Local::now().format("%Y-%m-%d %H:%M:%S");
        let status_str = match status {
            Some(code) => format!("HTTP {}", code),
            None => if is_error { "ERROR".to_string() } else { "OK".to_string() },
        };
        let duration_str = match duration_ms {
            Some(ms) => format!(" [Duration: {}ms]", ms),
            None => String::new(),
        };
        let tag = if is_error { "RESPONSE ERROR" } else { "RESPONSE" };

        // Attempt pretty-printing if content is JSON
        let formatted_content = if let Ok(val) = serde_json::from_str::<serde_json::Value>(content) {
            serde_json::to_string_pretty(&val).unwrap_or_else(|_| content.to_string())
        } else {
            content.to_string()
        };

        let entry = format!(
            "[{}] [{}] [{}] {}{}\n\
             --- RESPONSE CONTENT ---\n\
             {}\n\
             --------------------------------------------------------------------------------\n\n",
            now, tag, status_str, endpoint, duration_str, formatted_content.trim()
        );

        if let Err(e) = file.write_all(entry.as_bytes()) {
            eprintln!("[AiLogger] Failed to write to AI log file: {}", e);
        }
    }

    /// Opens the log file using the operating system's default viewer.
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
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resolve_log_path() {
        let path = AiLogger::resolve_log_path();
        assert!(path.to_string_lossy().ends_with(LOG_FILE_NAME));
    }

    #[test]
    fn test_ai_log_lifecycle() {
        // Test initialization (clearing)
        let _ = AiLogger::init();
        let path = AiLogger::resolve_log_path();
        let content_after_init = fs::read_to_string(&path).unwrap_or_default();
        assert!(content_after_init.contains("SQLight AI Request Log"));

        // Test logging an AI request
        let sample_req = r#"{"model":"gpt-4o","messages":[{"role":"user","content":"SELECT 1;"}]}"#;
        AiLogger::log_request("https://api.openai.com/v1/chat/completions", "POST", sample_req);

        // Test logging an AI response
        let sample_resp = r#"{"choices":[{"message":{"role":"assistant","content":"Here is the result"}}],"usage":{"total_tokens":42}}"#;
        AiLogger::log_response("https://api.openai.com/v1/chat/completions", sample_resp, Some(200), Some(125), false);

        let content_after_log = fs::read_to_string(&path).unwrap_or_default();
        assert!(content_after_log.contains("https://api.openai.com/v1/chat/completions"));
        assert!(content_after_log.contains("--- REQUEST CONTENT ---"));
        assert!(content_after_log.contains("SELECT 1;"));
        assert!(content_after_log.contains("gpt-4o"));
        assert!(content_after_log.contains("--- RESPONSE CONTENT ---"));
        assert!(content_after_log.contains("Here is the result"));
        assert!(content_after_log.contains("Duration: 125ms"));
        assert!(content_after_log.contains("HTTP 200"));

        // Re-init (simulating application reopen) should clear old requests & responses
        let _ = AiLogger::init();
        let content_after_reopen = fs::read_to_string(&path).unwrap_or_default();
        assert!(content_after_reopen.contains("SQLight AI Request Log"));
        assert!(!content_after_reopen.contains("SELECT 1;"));
        assert!(!content_after_reopen.contains("Here is the result"));
    }
}
