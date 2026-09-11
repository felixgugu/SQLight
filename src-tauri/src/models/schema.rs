use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseItem {
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SchemaItem {
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TableItem {
    pub schema: String,
    pub name: String,
    pub kind: String, // 'BASE TABLE' or 'VIEW'
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ColumnItem {
    pub name: String,
    pub data_type: String,
    pub max_length: Option<i32>,
    pub precision: Option<i32>,
    pub scale: Option<i32>,
    pub is_nullable: bool,
    pub is_primary_key: bool,
    pub is_identity: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TableSchema {
    pub schema: String,
    pub name: String,
    pub kind: String, // 'BASE TABLE' or 'VIEW'
    pub columns: Vec<ColumnItem>,
}
