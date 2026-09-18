use crate::error::AppResult;
use crate::models::connection::ConnectionProfile;
use crate::models::query::QueryResult;
use crate::models::schema::{ColumnItem, DatabaseItem, ForeignKeyItem, SchemaItem, TableItem, TableSchema};
use async_trait::async_trait;

pub mod mssql;

#[async_trait]
pub trait DatabaseConnection: Send + Sync {
    fn spid(&self) -> u32 { 0 }
    fn current_database(&self) -> &str { "" }
    async fn execute_query(&mut self, sql: &str, max_rows: Option<usize>) -> AppResult<QueryResult>;
    async fn get_databases(&mut self) -> AppResult<Vec<DatabaseItem>>;
    async fn get_schemas(&mut self, database: Option<&str>) -> AppResult<Vec<SchemaItem>>;
    async fn get_tables(&mut self, database: Option<&str>, schema: Option<&str>) -> AppResult<Vec<TableItem>>;
    async fn get_columns(&mut self, database: Option<&str>, schema: &str, table: &str) -> AppResult<Vec<ColumnItem>>;
    async fn get_foreign_keys(&mut self, database: Option<&str>, schema: Option<&str>, table: Option<&str>) -> AppResult<Vec<ForeignKeyItem>>;
    async fn get_database_schema(&mut self, database: Option<&str>) -> AppResult<Vec<TableSchema>>;
    async fn switch_database(&mut self, database: &str) -> AppResult<()>;
}

#[async_trait]
pub trait DatabaseDriver: Send + Sync {
    async fn connect(
        &self,
        profile: &ConnectionProfile,
        password: &str,
    ) -> AppResult<Box<dyn DatabaseConnection>>;

    async fn test_connection(
        &self,
        profile: &ConnectionProfile,
        password: &str,
    ) -> AppResult<()>;
}
