use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum DatabaseEngine {
    Mssql,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionConfig {
    pub name: String,
    #[serde(default)]
    pub alias: Option<String>,
    pub host: String,
    pub port: u16,
    pub database: String,
    pub username: String,
    pub encrypt: bool,
    pub trust_server_certificate: bool,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default)]
    pub modification_prompt: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionProfile {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub alias: Option<String>,
    pub engine: DatabaseEngine,
    pub host: String,
    pub port: u16,
    pub database: String,
    pub username: String,
    pub encrypt: bool,
    pub trust_server_certificate: bool,
    pub created_at: String,
    pub updated_at: String,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default)]
    pub modification_prompt: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveConnectionRequest {
    pub id: Option<String>,
    pub name: String,
    #[serde(default)]
    pub alias: Option<String>,
    pub engine: DatabaseEngine,
    pub host: String,
    pub port: u16,
    pub database: String,
    pub username: String,
    pub password: Option<String>,
    pub encrypt: bool,
    pub trust_server_certificate: bool,
    #[serde(default)]
    pub copy_password_from: Option<String>,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default)]
    pub modification_prompt: Option<bool>,
}
