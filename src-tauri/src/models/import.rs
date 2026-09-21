use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportCapabilities {
    /// Name of the single identity column of the table, when present.
    pub identity_column: Option<String>,
    /// Number of columns that can be written by an INSERT (excludes computed / rowversion).
    pub writable_column_count: usize,
    pub can_alter_table: bool,
    pub engine_edition: i32,
    /// False for engines that do not support `SET IDENTITY_INSERT` (e.g. Synapse).
    pub supports_identity_insert: bool,
    /// Human readable reason shown when "manual identity" must stay disabled.
    pub disabled_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportRowPayload {
    /// 1-based line number in the original file / pasted text.
    pub line: u32,
    /// One entry per expected column; `None` means SQL NULL.
    pub values: Vec<Option<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportRowError {
    pub line: u32,
    pub column: Option<String>,
    pub message: String,
    pub server_code: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
    pub inserted_count: u64,
    pub rolled_back: bool,
    pub errors: Vec<ImportRowError>,
    pub execution_time_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportProgressEvent {
    pub import_id: String,
    pub processed_rows: usize,
    pub total_rows: usize,
}
