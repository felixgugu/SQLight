use crate::drivers::mssql::SqlServerDriver;
use crate::drivers::{DatabaseConnection, DatabaseDriver};
use crate::error::{AppError, AppResult};
use crate::models::connection::{ConnectionProfile, SaveConnectionRequest};
use crate::models::query::QueryResult;
use crate::models::schema::{ColumnItem, DatabaseItem, TableItem, TableSchema};
use crate::services::credential_store::CredentialStore;
use crate::services::storage_service::StorageService;
use chrono::Utc;
use std::collections::HashMap;
use std::sync::{Arc, Mutex as StdMutex};
use tokio::sync::Mutex as TokioMutex;
use uuid::Uuid;

pub struct ConnectionManager {
    credential_store: CredentialStore,
    storage: StorageService,
    active_connections: Arc<TokioMutex<HashMap<String, Box<dyn DatabaseConnection>>>>,
    password_cache: Arc<StdMutex<HashMap<String, String>>>,
}

impl ConnectionManager {
    pub fn new() -> Self {
        Self {
            credential_store: CredentialStore::new(),
            storage: StorageService::new(),
            active_connections: Arc::new(TokioMutex::new(HashMap::new())),
            password_cache: Arc::new(StdMutex::new(HashMap::new())),
        }
    }

    pub fn get_profiles(&self) -> AppResult<Vec<ConnectionProfile>> {
        self.storage.load_profiles()
    }

    pub fn save_profile(&self, req: SaveConnectionRequest) -> AppResult<ConnectionProfile> {
        let mut profiles = self.storage.load_profiles()?;
        let now = Utc::now().to_rfc3339();

        let id = req.id.unwrap_or_else(|| Uuid::new_v4().to_string());

        let trimmed_name = req.name.trim();
        if trimmed_name.is_empty() {
            return Err(AppError::Connection {
                message: "Connection name cannot be empty".to_string(),
            });
        }

        if profiles
            .iter()
            .any(|p| p.id != id && p.name.trim().eq_ignore_ascii_case(trimmed_name))
        {
            return Err(AppError::Connection {
                message: format!(
                    "A connection named '{}' already exists. Please choose a different name.",
                    trimmed_name
                ),
            });
        }

        if let Some(ref password) = req.password {
            if !password.is_empty() {
                let _ = self.credential_store.save_password(&id, password);
                if let Ok(mut cache) = self.password_cache.lock() {
                    cache.insert(id.clone(), password.clone());
                }
            }
        }

        let profile = ConnectionProfile {
            id: id.clone(),
            name: trimmed_name.to_string(),
            engine: req.engine,
            host: req.host,
            port: req.port,
            database: req.database,
            username: req.username,
            encrypt: req.encrypt,
            trust_server_certificate: req.trust_server_certificate,
            created_at: now.clone(),
            updated_at: now,
        };

        if let Some(idx) = profiles.iter().position(|p| p.id == id) {
            let mut existing = profile.clone();
            existing.created_at = profiles[idx].created_at.clone();
            profiles[idx] = existing.clone();
            self.storage.save_profiles(&profiles)?;
            Ok(existing)
        } else {
            profiles.push(profile.clone());
            self.storage.save_profiles(&profiles)?;
            Ok(profile)
        }
    }

    pub async fn delete_profile(&self, id: &str) -> AppResult<()> {
        let mut profiles = self.storage.load_profiles()?;
        profiles.retain(|p| p.id != id);
        self.storage.save_profiles(&profiles)?;

        let _ = self.credential_store.delete_password(id);
        if let Ok(mut cache) = self.password_cache.lock() {
            cache.remove(id);
        }
        let mut conns = self.active_connections.lock().await;
        conns.remove(id);

        Ok(())
    }

    pub async fn test_connection(&self, req: SaveConnectionRequest) -> AppResult<()> {
        let temp_profile = ConnectionProfile {
            id: "test".to_string(),
            name: req.name,
            engine: req.engine,
            host: req.host,
            port: req.port,
            database: req.database,
            username: req.username,
            encrypt: req.encrypt,
            trust_server_certificate: req.trust_server_certificate,
            created_at: String::new(),
            updated_at: String::new(),
        };

        let password = req.password.unwrap_or_default();
        let driver = SqlServerDriver::new();
        driver.test_connection(&temp_profile, &password).await
    }

    pub async fn connect(&self, id: &str) -> AppResult<()> {
        let profiles = self.storage.load_profiles()?;
        let profile = profiles
            .iter()
            .find(|p| p.id == id)
            .ok_or_else(|| AppError::NotFound {
                message: format!("Connection profile {} not found", id),
            })?;

        // 1. Check in-memory password cache first
        let cached_password = self
            .password_cache
            .lock()
            .ok()
            .and_then(|cache| cache.get(id).cloned());

        // 2. Check Windows Credential Manager if not in cache
        let password = match cached_password {
            Some(p) if !p.is_empty() => p,
            _ => {
                let from_store = self
                    .credential_store
                    .get_password(id)
                    .ok()
                    .flatten()
                    .unwrap_or_default();

                if !from_store.is_empty() {
                    if let Ok(mut cache) = self.password_cache.lock() {
                        cache.insert(id.to_string(), from_store.clone());
                    }
                }
                from_store
            }
        };

        let driver = SqlServerDriver::new();
        let conn = driver.connect(profile, &password).await?;

        let mut conns = self.active_connections.lock().await;
        conns.insert(id.to_string(), conn);
        Ok(())
    }

    pub async fn disconnect(&self, id: &str) -> AppResult<()> {
        let mut conns = self.active_connections.lock().await;
        conns.remove(id);
        Ok(())
    }

    pub async fn execute_query(
        &self,
        id: &str,
        sql: &str,
        max_rows: Option<usize>,
    ) -> AppResult<QueryResult> {
        let mut conns = self.active_connections.lock().await;
        let conn = conns.get_mut(id).ok_or_else(|| AppError::Connection {
            message: format!("Not connected to connection '{}'", id),
        })?;

        conn.execute_query(sql, max_rows).await
    }

    pub async fn get_databases(&self, id: &str) -> AppResult<Vec<DatabaseItem>> {
        let mut conns = self.active_connections.lock().await;
        let conn = conns.get_mut(id).ok_or_else(|| AppError::Connection {
            message: format!("Not connected to connection '{}'", id),
        })?;

        conn.get_databases().await
    }

    pub async fn get_tables(
        &self,
        id: &str,
        database: Option<&str>,
        schema: Option<&str>,
    ) -> AppResult<Vec<TableItem>> {
        let mut conns = self.active_connections.lock().await;
        let conn = conns.get_mut(id).ok_or_else(|| AppError::Connection {
            message: format!("Not connected to connection '{}'", id),
        })?;

        conn.get_tables(database, schema).await
    }

    pub async fn get_columns(
        &self,
        id: &str,
        database: Option<&str>,
        schema: &str,
        table: &str,
    ) -> AppResult<Vec<ColumnItem>> {
        let mut conns = self.active_connections.lock().await;
        let conn = conns.get_mut(id).ok_or_else(|| AppError::Connection {
            message: format!("Not connected to connection '{}'", id),
        })?;

        conn.get_columns(database, schema, table).await
    }

    pub async fn get_database_schema(
        &self,
        id: &str,
        database: Option<&str>,
    ) -> AppResult<Vec<TableSchema>> {
        let mut conns = self.active_connections.lock().await;
        let conn = conns.get_mut(id).ok_or_else(|| AppError::Connection {
            message: format!("Not connected to connection '{}'", id),
        })?;

        conn.get_database_schema(database).await
    }

    pub async fn switch_database(&self, id: &str, database: &str) -> AppResult<()> {
        let mut conns = self.active_connections.lock().await;
        let conn = conns.get_mut(id).ok_or_else(|| AppError::Connection {
            message: format!("Not connected to connection '{}'", id),
        })?;

        conn.switch_database(database).await
    }
}
