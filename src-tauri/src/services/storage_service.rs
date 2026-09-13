use crate::error::{AppError, AppResult};
use crate::models::connection::ConnectionProfile;
use std::fs;
use std::path::PathBuf;

#[derive(Clone)]
pub struct StorageService {
    config_path: PathBuf,
}

impl StorageService {
    pub fn new() -> Self {
        let mut path = dirs_next::data_local_dir()
            .or_else(dirs_next::config_dir)
            .unwrap_or_else(|| PathBuf::from("."));

        path.push("SQLight");
        let _ = fs::create_dir_all(&path);
        path.push("connections.json");

        Self { config_path: path }
    }

    pub fn load_profiles(&self) -> AppResult<Vec<ConnectionProfile>> {
        if !self.config_path.exists() {
            return Ok(Vec::new());
        }

        let content = fs::read_to_string(&self.config_path).map_err(|e| AppError::Internal {
            message: format!("Failed to read connections file: {}", e),
        })?;

        let profiles: Vec<ConnectionProfile> =
            serde_json::from_str(&content).unwrap_or_else(|_| Vec::new());
        Ok(profiles)
    }

    pub fn save_profiles(&self, profiles: &[ConnectionProfile]) -> AppResult<()> {
        let content = serde_json::to_string_pretty(profiles).map_err(|e| AppError::Internal {
            message: format!("Failed to serialize connection profiles: {}", e),
        })?;

        fs::write(&self.config_path, content).map_err(|e| AppError::Internal {
            message: format!("Failed to write connection profiles: {}", e),
        })?;

        Ok(())
    }
}
