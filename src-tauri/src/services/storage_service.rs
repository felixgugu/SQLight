use crate::error::{AppError, AppResult};
use crate::models::connection::ConnectionProfile;
use std::fs;
use std::path::{Path, PathBuf};

/// Folder inside the platform data directory that holds `connections.json`.
const APP_DIR_NAME: &str = "PuffSQL";
/// Pre-rename folder, migrated once so saved connections survive the rebrand.
const LEGACY_APP_DIR_NAME: &str = "SQLight";

/// Resolves (and creates) the application data directory, moving the pre-rename folder the first
/// time a renamed build runs. Kept side-effect-explicit so it can be unit tested on a temp dir.
fn resolve_app_dir(base: &Path) -> PathBuf {
    let current = base.join(APP_DIR_NAME);
    let legacy = base.join(LEGACY_APP_DIR_NAME);

    if !current.exists() && legacy.exists() {
        let _ = fs::rename(&legacy, &current);
    }

    current
}

#[derive(Clone)]
pub struct StorageService {
    config_path: PathBuf,
}

impl StorageService {
    pub fn new() -> Self {
        let base = dirs_next::data_local_dir()
            .or_else(dirs_next::config_dir)
            .unwrap_or_else(|| PathBuf::from("."));

        let mut path = resolve_app_dir(&base);
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_base_dir(label: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or_default();
        let dir = std::env::temp_dir().join(format!("puffsql-storage-{}-{}", label, unique));
        let _ = fs::create_dir_all(&dir);
        dir
    }

    #[test]
    fn migrates_profiles_saved_before_the_rebrand() {
        let base = temp_base_dir("legacy");
        let legacy_dir = base.join(LEGACY_APP_DIR_NAME);
        fs::create_dir_all(&legacy_dir).unwrap();
        fs::write(legacy_dir.join("connections.json"), "[]").unwrap();

        let resolved = resolve_app_dir(&base);

        assert_eq!(resolved, base.join(APP_DIR_NAME));
        assert!(resolved.join("connections.json").exists(), "profiles must move with the folder");
        assert!(!legacy_dir.exists(), "the legacy folder should not be left behind");

        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn keeps_an_existing_folder_and_leaves_a_fresh_install_alone() {
        let base = temp_base_dir("current");
        fs::create_dir_all(base.join(APP_DIR_NAME)).unwrap();

        let resolved = resolve_app_dir(&base);

        assert_eq!(resolved, base.join(APP_DIR_NAME));
        assert!(resolved.exists());

        let empty_base = temp_base_dir("empty");
        let fresh = resolve_app_dir(&empty_base);
        assert_eq!(fresh, empty_base.join(APP_DIR_NAME));

        let _ = fs::remove_dir_all(&base);
        let _ = fs::remove_dir_all(&empty_base);
    }
}
