use crate::error::{AppError, AppResult};
use keyring::Entry;

const SERVICE_NAME: &str = "SQLightDesktopClient";

#[derive(Clone)]
pub struct CredentialStore;

impl CredentialStore {
    pub fn new() -> Self {
        Self
    }

    pub fn save_password(&self, connection_id: &str, password: &str) -> AppResult<()> {
        let entry = Entry::new(SERVICE_NAME, connection_id).map_err(|e| AppError::Credential {
            message: format!("Failed to create keyring entry: {}", e),
        })?;

        entry.set_password(password).map_err(|e| AppError::Credential {
            message: format!("Failed to store password in OS keychain: {}", e),
        })?;

        Ok(())
    }

    pub fn get_password(&self, connection_id: &str) -> AppResult<Option<String>> {
        let entry = Entry::new(SERVICE_NAME, connection_id).map_err(|e| AppError::Credential {
            message: format!("Failed to create keyring entry: {}", e),
        })?;

        match entry.get_password() {
            Ok(pwd) => Ok(Some(pwd)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(AppError::Credential {
                message: format!("Failed to retrieve password from OS keychain: {}", e),
            }),
        }
    }

    pub fn delete_password(&self, connection_id: &str) -> AppResult<()> {
        let entry = Entry::new(SERVICE_NAME, connection_id).map_err(|e| AppError::Credential {
            message: format!("Failed to create keyring entry: {}", e),
        })?;

        match entry.delete_credential() {
            Ok(_) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(AppError::Credential {
                message: format!("Failed to remove password from OS keychain: {}", e),
            }),
        }
    }
}
