use crate::error::{AppError, AppResult};
use keyring::Entry;

/// Keyring service name used after the PuffSQL rebrand.
const SERVICE_NAME: &str = "PuffSQLDesktopClient";
/// Service name used before the rebrand. Secrets stored there stay reachable and are promoted.
const LEGACY_SERVICE_NAME: &str = "SQLightDesktopClient";

fn entry_for(service: &str, connection_id: &str) -> AppResult<Entry> {
    Entry::new(service, connection_id).map_err(|e| AppError::Credential {
        message: format!("Failed to create keyring entry: {}", e),
    })
}

#[derive(Clone)]
pub struct CredentialStore;

impl CredentialStore {
    pub fn new() -> Self {
        Self
    }

    pub fn save_password(&self, connection_id: &str, password: &str) -> AppResult<()> {
        let entry = entry_for(SERVICE_NAME, connection_id)?;

        entry.set_password(password).map_err(|e| AppError::Credential {
            message: format!("Failed to store password in OS keychain: {}", e),
        })?;

        Ok(())
    }

    pub fn get_password(&self, connection_id: &str) -> AppResult<Option<String>> {
        let entry = entry_for(SERVICE_NAME, connection_id)?;

        match entry.get_password() {
            Ok(pwd) => Ok(Some(pwd)),
            Err(keyring::Error::NoEntry) => self.promote_legacy_password(connection_id),
            Err(e) => Err(AppError::Credential {
                message: format!("Failed to retrieve password from OS keychain: {}", e),
            }),
        }
    }

    /// Reads a password saved before the rebrand and copies it under the new service name so the
    /// migration only happens once per connection.
    fn promote_legacy_password(&self, connection_id: &str) -> AppResult<Option<String>> {
        let legacy = entry_for(LEGACY_SERVICE_NAME, connection_id)?;

        match legacy.get_password() {
            Ok(pwd) => {
                if let Ok(current) = entry_for(SERVICE_NAME, connection_id) {
                    let _ = current.set_password(&pwd);
                }
                Ok(Some(pwd))
            }
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(AppError::Credential {
                message: format!("Failed to retrieve password from OS keychain: {}", e),
            }),
        }
    }

    pub fn delete_password(&self, connection_id: &str) -> AppResult<()> {
        let entry = entry_for(SERVICE_NAME, connection_id)?;

        match entry.delete_credential() {
            Ok(_) | Err(keyring::Error::NoEntry) => {}
            Err(e) => {
                return Err(AppError::Credential {
                    message: format!("Failed to remove password from OS keychain: {}", e),
                })
            }
        }

        // Drop the pre-rename copy as well so a deleted connection leaves no secret behind.
        if let Ok(legacy) = entry_for(LEGACY_SERVICE_NAME, connection_id) {
            let _ = legacy.delete_credential();
        }

        Ok(())
    }
}
