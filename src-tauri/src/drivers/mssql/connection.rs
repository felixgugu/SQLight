use crate::drivers::DatabaseConnection;
use crate::drivers::mssql::import_sql;
use crate::error::{AppError, AppResult};
use crate::models::import::{ImportCapabilities, ImportResult, ImportRowError, ImportRowPayload};
use crate::models::query::{CellValue, ColumnDef, QueryMessage, QueryResult, ResultSet};
use crate::models::schema::{ColumnItem, DatabaseItem, ForeignKeyItem, SchemaItem, TableItem, TableSchema};
use async_trait::async_trait;
use chrono::{NaiveDate, NaiveDateTime, NaiveTime, Timelike, Utc};
use std::time::Instant;
use tiberius::{Client, Column, ColumnData, FromSql, Row};
use tokio::net::TcpStream;
use tokio::sync::mpsc::UnboundedSender;
use tokio_util::compat::Compat;

pub type TiberiusClient = Client<Compat<TcpStream>>;

pub struct SqlServerConnection {
    client: TiberiusClient,
    current_database: String,
    spid: u32,
}

impl SqlServerConnection {
    pub fn new(client: TiberiusClient, database: String, spid: u32) -> Self {
        Self {
            client,
            current_database: database,
            spid,
        }
    }

    pub fn spid(&self) -> u32 {
        self.spid
    }

    fn column_data_to_cell(data: &ColumnData) -> CellValue {
        match data {
            ColumnData::U8(Some(v)) => CellValue::Int(*v as i64),
            ColumnData::I16(Some(v)) => CellValue::Int(*v as i64),
            ColumnData::I32(Some(v)) => CellValue::Int(*v as i64),
            ColumnData::I64(Some(v)) => CellValue::Int(*v),
            ColumnData::F32(Some(v)) => CellValue::Float(*v as f64),
            ColumnData::F64(Some(v)) => CellValue::Float(*v),
            ColumnData::Bit(Some(b)) => CellValue::Bool(*b),
            ColumnData::String(Some(s)) => CellValue::String(s.to_string()),
            ColumnData::Guid(Some(g)) => CellValue::String(g.to_string()),
            ColumnData::Binary(Some(b)) => CellValue::Binary {
                kind: "binary".to_string(),
                length: b.len(),
            },
            ColumnData::Numeric(Some(n)) => CellValue::String(n.to_string()),
            ColumnData::DateTime(Some(dt)) => {
                let col = ColumnData::DateTime(Some(*dt));
                match NaiveDateTime::from_sql(&col) {
                    Ok(Some(dt_val)) => {
                        if dt_val.nanosecond() > 0 {
                            CellValue::String(dt_val.format("%Y-%m-%d %H:%M:%S%.3f").to_string())
                        } else {
                            CellValue::String(dt_val.format("%Y-%m-%d %H:%M:%S").to_string())
                        }
                    }
                    _ => CellValue::Null,
                }
            }
            ColumnData::SmallDateTime(Some(dt)) => {
                let col = ColumnData::SmallDateTime(Some(*dt));
                match NaiveDateTime::from_sql(&col) {
                    Ok(Some(dt_val)) => CellValue::String(dt_val.format("%Y-%m-%d %H:%M:%S").to_string()),
                    _ => CellValue::Null,
                }
            }
            ColumnData::DateTime2(Some(dt)) => {
                let col = ColumnData::DateTime2(Some(*dt));
                match NaiveDateTime::from_sql(&col) {
                    Ok(Some(dt_val)) => {
                        if dt_val.nanosecond() > 0 {
                            CellValue::String(dt_val.format("%Y-%m-%d %H:%M:%S%.3f").to_string())
                        } else {
                            CellValue::String(dt_val.format("%Y-%m-%d %H:%M:%S").to_string())
                        }
                    }
                    _ => CellValue::Null,
                }
            }
            ColumnData::Date(Some(d)) => {
                let col = ColumnData::Date(Some(*d));
                match NaiveDate::from_sql(&col) {
                    Ok(Some(d_val)) => CellValue::String(d_val.format("%Y-%m-%d").to_string()),
                    _ => CellValue::Null,
                }
            }
            ColumnData::Time(Some(t)) => {
                let col = ColumnData::Time(Some(*t));
                match NaiveTime::from_sql(&col) {
                    Ok(Some(t_val)) => CellValue::String(t_val.format("%H:%M:%S%.3f").to_string()),
                    _ => CellValue::Null,
                }
            }
            ColumnData::DateTimeOffset(Some(dto)) => {
                let col = ColumnData::DateTime2(Some(dto.datetime2()));
                match NaiveDateTime::from_sql(&col) {
                    Ok(Some(dt)) => {
                        let offset_mins = dto.offset();
                        let hours = offset_mins / 60;
                        let mins = (offset_mins % 60).abs();
                        CellValue::String(format!(
                            "{} {:+03}:{:02}",
                            if dt.nanosecond() > 0 {
                                dt.format("%Y-%m-%d %H:%M:%S%.3f").to_string()
                            } else {
                                dt.format("%Y-%m-%d %H:%M:%S").to_string()
                            },
                            hours,
                            mins
                        ))
                    }
                    _ => CellValue::Null,
                }
            }
            ColumnData::Xml(Some(xml)) => CellValue::String(xml.to_string()),
            _ => CellValue::Null,
        }
    }

    fn build_result_set(
        columns: &[Column],
        rows: &[Row],
        max_rows: Option<usize>,
    ) -> ResultSet {
        let col_defs: Vec<ColumnDef> = columns
            .iter()
            .enumerate()
            .map(|(idx, col)| ColumnDef {
                name: col.name().to_string(),
                data_type: format!("{:?}", col.column_type()),
                nullable: true,
                ordinal: idx,
            })
            .collect();

        let total_count = rows.len();
        let limit = max_rows.unwrap_or(usize::MAX);
        let is_truncated = total_count > limit;
        let effective_rows = if is_truncated { &rows[..limit] } else { rows };

        let mut data_rows = Vec::with_capacity(effective_rows.len());
        for row in effective_rows {
            let mut row_values = Vec::with_capacity(columns.len());
            for (_, cell_data) in row.cells() {
                row_values.push(Self::column_data_to_cell(cell_data));
            }
            data_rows.push(row_values);
        }

        let count = data_rows.len();
        ResultSet {
            columns: col_defs,
            rows: data_rows,
            row_count: count,
            total_count,
            is_truncated,
        }
    }

    fn col_str<'a>(row: &'a Row, idx: usize) -> Option<&'a str> {
        row.try_get::<&'a str, _>(idx).ok().flatten()
    }

    fn col_i32(row: &Row, idx: usize) -> Option<i32> {
        if let Ok(Some(v)) = row.try_get::<i32, _>(idx) {
            return Some(v);
        }
        if let Ok(Some(v)) = row.try_get::<u8, _>(idx) {
            return Some(v as i32);
        }
        if let Ok(Some(v)) = row.try_get::<i16, _>(idx) {
            return Some(v as i32);
        }
        if let Ok(Some(v)) = row.try_get::<i64, _>(idx) {
            return Some(v as i32);
        }
        None
    }

    fn col_bool(row: &Row, idx: usize) -> Option<bool> {
        if let Ok(Some(b)) = row.try_get::<bool, _>(idx) {
            return Some(b);
        }
        if let Some(num) = Self::col_i32(row, idx) {
            return Some(num != 0);
        }
        if let Some(s) = Self::col_str(row, idx) {
            return Some(s.eq_ignore_ascii_case("yes") || s == "1" || s.eq_ignore_ascii_case("true"));
        }
        None
    }

    /// Executes a script and drains the response; used for transaction control statements.
    async fn exec_script(&mut self, sql: &str) -> AppResult<()> {
        let stream = self.client.simple_query(sql).await?;
        let _ = stream.into_results().await?;
        Ok(())
    }

    /// Executes one import batch and returns (recorded error count, XACT_STATE()).
    /// `None` means the batch summary could not be read, which is treated as a failure.
    async fn exec_import_batch(&mut self, sql: &str) -> AppResult<Option<(i32, i32)>> {
        let stream = self.client.simple_query(sql).await?;
        let results = stream.into_results().await?;
        if let Some(rows) = results.first() {
            if let Some(row) = rows.first() {
                let err_count = Self::col_i32(row, 0).unwrap_or(0);
                let xact_state = Self::col_i32(row, 1).unwrap_or(0);
                return Ok(Some((err_count, xact_state)));
            }
        }
        Ok(None)
    }

    /// Reads whether the login may run `SET IDENTITY_INSERT` together with the engine edition.
    async fn query_alter_permission(&mut self, qualified: &str) -> AppResult<(bool, i32)> {
        let sql = format!(
            "SELECT CAST(ISNULL(HAS_PERMS_BY_NAME('{}', 'OBJECT', 'ALTER'), 0) AS INT) AS can_alter, \
             CAST(ISNULL(CAST(SERVERPROPERTY('EngineEdition') AS INT), 0) AS INT) AS engine_edition;",
            qualified.replace('\'', "''")
        );
        let stream = self.client.simple_query(sql).await?;
        let results = stream.into_results().await?;
        if let Some(rows) = results.first() {
            if let Some(row) = rows.first() {
                return Ok((
                    Self::col_bool(row, 0).unwrap_or(false),
                    Self::col_i32(row, 1).unwrap_or(0),
                ));
            }
        }
        Ok((false, 0))
    }

    /// Runs the rollback script, which first selects the collected row errors.
    async fn query_import_errors(&mut self, sql: &str) -> AppResult<Vec<ImportRowError>> {
        let stream = self.client.simple_query(sql).await?;
        let results = stream.into_results().await?;
        let mut errors = Vec::new();
        if let Some(rows) = results.first() {
            for row in rows {
                let line = Self::col_i32(row, 0).unwrap_or(0);
                if line <= 0 {
                    continue;
                }
                errors.push(ImportRowError {
                    line: line.max(0) as u32,
                    column: Self::col_str(row, 1).map(|c| c.to_string()),
                    message: Self::col_str(row, 2).unwrap_or("匯入失敗").to_string(),
                    server_code: Self::col_i32(row, 3),
                });
            }
        }
        Ok(errors)
    }
}

#[async_trait]
impl DatabaseConnection for SqlServerConnection {
    fn spid(&self) -> u32 {
        self.spid
    }

    fn current_database(&self) -> &str {
        &self.current_database
    }

    async fn ping(&mut self) -> AppResult<()> {
        let stream = self
            .client
            .simple_query("SELECT 1;")
            .await
            .map_err(|e| AppError::Connection {
                message: format!("Pooled connection is no longer usable: {}", e),
            })?;
        stream
            .into_results()
            .await
            .map_err(|e| AppError::Connection {
                message: format!("Pooled connection is no longer usable: {}", e),
            })?;
        Ok(())
    }

    async fn execute_query(&mut self, sql: &str, max_rows: Option<usize>) -> AppResult<QueryResult> {
        let start = Instant::now();

        let stream = match self.client.simple_query(sql).await {
            Ok(s) => s,
            Err(e) => {
                let duration = start.elapsed().as_millis() as u64;
                let (code, line) = match &e {
                    tiberius::error::Error::Server(srv) => (Some(srv.code() as i32), Some(srv.line())),
                    _ => (None, None),
                };
                return Ok(QueryResult {
                    result_sets: Vec::new(),
                    messages: vec![QueryMessage {
                        level: "error".to_string(),
                        message: e.to_string(),
                        code,
                        line_number: line,
                        timestamp: Utc::now().to_rfc3339(),
                    }],
                    affected_rows: 0,
                    execution_time_ms: duration,
                });
            }
        };

        let result_sets_raw = match stream.into_results().await {
            Ok(r) => r,
            Err(e) => {
                let duration = start.elapsed().as_millis() as u64;
                let (code, line) = match &e {
                    tiberius::error::Error::Server(srv) => (Some(srv.code() as i32), Some(srv.line())),
                    _ => (None, None),
                };
                return Ok(QueryResult {
                    result_sets: Vec::new(),
                    messages: vec![QueryMessage {
                        level: "error".to_string(),
                        message: e.to_string(),
                        code,
                        line_number: line,
                        timestamp: Utc::now().to_rfc3339(),
                    }],
                    affected_rows: 0,
                    execution_time_ms: duration,
                });
            }
        };

        let elapsed = start.elapsed().as_millis() as u64;
        let mut result_sets = Vec::new();
        let mut total_rows = 0;
        let mut has_truncated = false;

        for rows in result_sets_raw {
            if let Some(first_row) = rows.first() {
                let columns = first_row.columns();
                let rs = Self::build_result_set(columns, &rows, max_rows);
                if rs.is_truncated {
                    has_truncated = true;
                }
                total_rows += rs.row_count as u64;
                result_sets.push(rs);
            }
        }

        let mut messages = Vec::new();

        if has_truncated {
            let limit_num = max_rows.unwrap_or(0);
            messages.push(QueryMessage {
                level: "warning".to_string(),
                message: format!(
                    "查詢結果已達最大限制 {} 筆，其餘資料已自動截斷以保護系統效能。",
                    limit_num
                ),
                code: None,
                line_number: None,
                timestamp: Utc::now().to_rfc3339(),
            });
        }

        let message = format!(
            "Query completed successfully. {} result set(s), {} rows returned.",
            result_sets.len(),
            total_rows
        );

        messages.push(QueryMessage {
            level: "info".to_string(),
            message,
            code: None,
            line_number: None,
            timestamp: Utc::now().to_rfc3339(),
        });

        Ok(QueryResult {
            result_sets,
            messages,
            affected_rows: total_rows,
            execution_time_ms: elapsed,
        })
    }

    async fn get_databases(&mut self) -> AppResult<Vec<DatabaseItem>> {
        let sql = "SELECT name FROM sys.databases WHERE state = 0 ORDER BY name;";
        let stream = self.client.simple_query(sql).await?;
        let results = stream.into_results().await?;
        let mut dbs = Vec::new();

        if let Some(rows) = results.first() {
            for row in rows {
                if let Some(name) = Self::col_str(row, 0) {
                    dbs.push(DatabaseItem {
                        name: name.to_string(),
                    });
                }
            }
        }
        Ok(dbs)
    }

    async fn get_schemas(&mut self, database: Option<&str>) -> AppResult<Vec<SchemaItem>> {
        if let Some(db) = database {
            if !db.is_empty() && self.current_database != db {
                self.switch_database(db).await?;
            }
        }

        let sql = "SELECT name FROM sys.schemas WHERE name NOT IN ('guest', 'INFORMATION_SCHEMA', 'sys') ORDER BY name;";
        let stream = self.client.simple_query(sql).await?;
        let results = stream.into_results().await?;
        let mut schemas = Vec::new();

        if let Some(rows) = results.first() {
            for row in rows {
                if let Some(name) = Self::col_str(row, 0) {
                    schemas.push(SchemaItem {
                        name: name.to_string(),
                    });
                }
            }
        }
        Ok(schemas)
    }

    async fn get_tables(&mut self, database: Option<&str>, schema: Option<&str>) -> AppResult<Vec<TableItem>> {
        if let Some(db) = database {
            if !db.is_empty() && self.current_database != db {
                self.switch_database(db).await?;
            }
        }

        let sql = match schema {
            Some(s) => format!(
                "SELECT TABLE_SCHEMA, TABLE_NAME, TABLE_TYPE FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = '{}' ORDER BY TABLE_NAME;",
                s.replace('\'', "''")
            ),
            None => "SELECT TABLE_SCHEMA, TABLE_NAME, TABLE_TYPE FROM INFORMATION_SCHEMA.TABLES ORDER BY TABLE_SCHEMA, TABLE_NAME;".to_string(),
        };

        let stream = self.client.simple_query(sql).await?;
        let results = stream.into_results().await?;
        let mut tables = Vec::new();

        if let Some(rows) = results.first() {
            for row in rows {
                let schema = Self::col_str(row, 0).unwrap_or("dbo").to_string();
                let name = Self::col_str(row, 1).unwrap_or("").to_string();
                let kind = Self::col_str(row, 2).unwrap_or("BASE TABLE").to_string();
                if !name.is_empty() {
                    tables.push(TableItem { schema, name, kind });
                }
            }
        }
        Ok(tables)
    }

    async fn get_columns(&mut self, database: Option<&str>, schema: &str, table: &str) -> AppResult<Vec<ColumnItem>> {
        if let Some(db) = database {
            if !db.is_empty() && self.current_database != db {
                self.switch_database(db).await?;
            }
        }

        let sql = format!(
            r#"
            SELECT 
                c.COLUMN_NAME,
                c.DATA_TYPE,
                CAST(c.CHARACTER_MAXIMUM_LENGTH AS INT) AS CHARACTER_MAXIMUM_LENGTH,
                CAST(c.NUMERIC_PRECISION AS INT) AS NUMERIC_PRECISION,
                CAST(c.NUMERIC_SCALE AS INT) AS NUMERIC_SCALE,
                CASE WHEN c.IS_NULLABLE = 'YES' THEN 1 ELSE 0 END AS IS_NULLABLE,
                CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END AS IS_PRIMARY_KEY,
                CAST(ISNULL(COLUMNPROPERTY(OBJECT_ID(c.TABLE_SCHEMA + '.' + c.TABLE_NAME), c.COLUMN_NAME, 'IsIdentity'), 0) AS INT) AS IS_IDENTITY,
                CAST(ISNULL(COLUMNPROPERTY(OBJECT_ID(c.TABLE_SCHEMA + '.' + c.TABLE_NAME), c.COLUMN_NAME, 'IsComputed'), 0) AS INT) AS IS_COMPUTED,
                CASE WHEN c.DATA_TYPE IN ('timestamp', 'rowversion') THEN 1 ELSE 0 END AS IS_ROW_VERSION
            FROM INFORMATION_SCHEMA.COLUMNS c
            LEFT JOIN (
                SELECT ku.TABLE_SCHEMA, ku.TABLE_NAME, ku.COLUMN_NAME
                FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
                JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku
                    ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
                    AND tc.TABLE_SCHEMA = ku.TABLE_SCHEMA
                WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
            ) pk ON c.TABLE_SCHEMA = pk.TABLE_SCHEMA 
                AND c.TABLE_NAME = pk.TABLE_NAME 
                AND c.COLUMN_NAME = pk.COLUMN_NAME
            WHERE c.TABLE_SCHEMA = '{schema}' AND c.TABLE_NAME = '{table}'
            ORDER BY c.ORDINAL_POSITION;
            "#,
            schema = schema.replace('\'', "''"),
            table = table.replace('\'', "''")
        );

        let stream = self.client.simple_query(sql).await?;
        let results = stream.into_results().await?;
        let mut columns = Vec::new();

        if let Some(rows) = results.first() {
            for row in rows {
                let name = Self::col_str(row, 0).unwrap_or("").to_string();
                let data_type = Self::col_str(row, 1).unwrap_or("").to_string();
                let max_length = Self::col_i32(row, 2);
                let precision = Self::col_i32(row, 3);
                let scale = Self::col_i32(row, 4);
                let is_nullable = Self::col_bool(row, 5).unwrap_or(true);
                let is_primary_key = Self::col_bool(row, 6).unwrap_or(false);
                let is_identity = Self::col_bool(row, 7).unwrap_or(false);
                let is_computed = Self::col_bool(row, 8).unwrap_or(false);
                let is_row_version = Self::col_bool(row, 9).unwrap_or(false);

                if !name.is_empty() {
                    columns.push(ColumnItem {
                        name,
                        data_type,
                        max_length,
                        precision,
                        scale,
                        is_nullable,
                        is_primary_key,
                        is_identity,
                        is_computed,
                        is_row_version,
                    });
                }
            }
        }
        Ok(columns)
    }

    async fn get_foreign_keys(
        &mut self,
        database: Option<&str>,
        schema: Option<&str>,
        table: Option<&str>,
    ) -> AppResult<Vec<ForeignKeyItem>> {
        if let Some(db) = database {
            if !db.is_empty() && self.current_database != db {
                self.switch_database(db).await?;
            }
        }

        let mut sql = r#"
            SELECT 
                fk.name AS constraint_name,
                s_from.name AS from_schema,
                t_from.name AS from_table,
                c_from.name AS from_column,
                s_to.name AS to_schema,
                t_to.name AS to_table,
                c_to.name AS to_column
            FROM sys.foreign_keys fk
            INNER JOIN sys.foreign_key_columns fkc 
                ON fk.object_id = fkc.constraint_object_id
            INNER JOIN sys.tables t_from 
                ON fkc.parent_object_id = t_from.object_id
            INNER JOIN sys.schemas s_from 
                ON t_from.schema_id = s_from.schema_id
            INNER JOIN sys.columns c_from 
                ON fkc.parent_object_id = c_from.object_id 
                AND fkc.parent_column_id = c_from.column_id
            INNER JOIN sys.tables t_to 
                ON fkc.referenced_object_id = t_to.object_id
            INNER JOIN sys.schemas s_to 
                ON t_to.schema_id = s_to.schema_id
            INNER JOIN sys.columns c_to 
                ON fkc.referenced_object_id = c_to.object_id 
                AND fkc.referenced_column_id = c_to.column_id
        "#.to_string();

        if let Some(tbl) = table {
            if !tbl.is_empty() {
                let sanitized_table = tbl.replace('\'', "''");
                if let Some(sch) = schema {
                    if !sch.is_empty() {
                        let sanitized_schema = sch.replace('\'', "''");
                        sql.push_str(&format!(
                            " WHERE ((s_from.name = '{}' AND t_from.name = '{}') OR (s_to.name = '{}' AND t_to.name = '{}'))",
                            sanitized_schema, sanitized_table, sanitized_schema, sanitized_table
                        ));
                    } else {
                        sql.push_str(&format!(
                            " WHERE (t_from.name = '{}' OR t_to.name = '{}')",
                            sanitized_table, sanitized_table
                        ));
                    }
                } else {
                    sql.push_str(&format!(
                        " WHERE (t_from.name = '{}' OR t_to.name = '{}')",
                        sanitized_table, sanitized_table
                    ));
                }
            }
        }

        sql.push_str(" ORDER BY fk.name, fkc.constraint_column_id;");

        let stream = self.client.simple_query(sql).await?;
        let results = stream.into_results().await?;
        let mut fks = Vec::new();

        if let Some(rows) = results.first() {
            for row in rows {
                let constraint_name = Self::col_str(row, 0).unwrap_or("").to_string();
                let from_schema = Self::col_str(row, 1).unwrap_or("dbo").to_string();
                let from_table = Self::col_str(row, 2).unwrap_or("").to_string();
                let from_column = Self::col_str(row, 3).unwrap_or("").to_string();
                let to_schema = Self::col_str(row, 4).unwrap_or("dbo").to_string();
                let to_table = Self::col_str(row, 5).unwrap_or("").to_string();
                let to_column = Self::col_str(row, 6).unwrap_or("").to_string();

                if !constraint_name.is_empty() && !from_table.is_empty() && !to_table.is_empty() {
                    fks.push(ForeignKeyItem {
                        constraint_name,
                        from_schema,
                        from_table,
                        from_column,
                        to_schema,
                        to_table,
                        to_column,
                    });
                }
            }
        }

        Ok(fks)
    }

    async fn get_database_schema(&mut self, database: Option<&str>) -> AppResult<Vec<TableSchema>> {
        if let Some(db) = database {
            if !db.is_empty() && self.current_database != db {
                self.switch_database(db).await?;
            }
        }

        let sql = r#"
            SELECT 
                t.TABLE_SCHEMA,
                t.TABLE_NAME,
                t.TABLE_TYPE,
                c.COLUMN_NAME,
                c.DATA_TYPE,
                CAST(c.CHARACTER_MAXIMUM_LENGTH AS INT) AS CHARACTER_MAXIMUM_LENGTH,
                CAST(c.NUMERIC_PRECISION AS INT) AS NUMERIC_PRECISION,
                CAST(c.NUMERIC_SCALE AS INT) AS NUMERIC_SCALE,
                CASE WHEN c.IS_NULLABLE = 'YES' THEN 1 ELSE 0 END AS IS_NULLABLE,
                CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END AS IS_PRIMARY_KEY,
                CAST(ISNULL(COLUMNPROPERTY(OBJECT_ID(c.TABLE_SCHEMA + '.' + c.TABLE_NAME), c.COLUMN_NAME, 'IsIdentity'), 0) AS INT) AS IS_IDENTITY,
                CAST(ISNULL(COLUMNPROPERTY(OBJECT_ID(c.TABLE_SCHEMA + '.' + c.TABLE_NAME), c.COLUMN_NAME, 'IsComputed'), 0) AS INT) AS IS_COMPUTED,
                CASE WHEN c.DATA_TYPE IN ('timestamp', 'rowversion') THEN 1 ELSE 0 END AS IS_ROW_VERSION
            FROM INFORMATION_SCHEMA.TABLES t
            LEFT JOIN INFORMATION_SCHEMA.COLUMNS c 
                ON t.TABLE_SCHEMA = c.TABLE_SCHEMA AND t.TABLE_NAME = c.TABLE_NAME
            LEFT JOIN (
                SELECT ku.TABLE_SCHEMA, ku.TABLE_NAME, ku.COLUMN_NAME
                FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
                JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku
                    ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
                    AND tc.TABLE_SCHEMA = ku.TABLE_SCHEMA
                WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
            ) pk ON c.TABLE_SCHEMA = pk.TABLE_SCHEMA 
                AND c.TABLE_NAME = pk.TABLE_NAME 
                AND c.COLUMN_NAME = pk.COLUMN_NAME
            WHERE t.TABLE_TYPE IN ('BASE TABLE', 'VIEW')
            ORDER BY t.TABLE_SCHEMA, t.TABLE_NAME, c.ORDINAL_POSITION;
        "#;

        let stream = self.client.simple_query(sql).await?;
        let results = stream.into_results().await?;
        let mut tables_map: std::collections::BTreeMap<(String, String), TableSchema> = std::collections::BTreeMap::new();

        if let Some(rows) = results.first() {
            for row in rows {
                let schema = Self::col_str(row, 0).unwrap_or("dbo").to_string();
                let name = Self::col_str(row, 1).unwrap_or("").to_string();
                let kind = Self::col_str(row, 2).unwrap_or("BASE TABLE").to_string();

                if name.is_empty() {
                    continue;
                }

                let key = (schema.clone(), name.clone());
                let entry = tables_map.entry(key).or_insert_with(|| TableSchema {
                    schema,
                    name,
                    kind,
                    columns: Vec::new(),
                });

                if let Some(col_name) = Self::col_str(row, 3) {
                    if !col_name.is_empty() {
                        let data_type = Self::col_str(row, 4).unwrap_or("").to_string();
                        let max_length = Self::col_i32(row, 5);
                        let precision = Self::col_i32(row, 6);
                        let scale = Self::col_i32(row, 7);
                        let is_nullable = Self::col_bool(row, 8).unwrap_or(true);
                        let is_primary_key = Self::col_bool(row, 9).unwrap_or(false);
                        let is_identity = Self::col_bool(row, 10).unwrap_or(false);
                        let is_computed = Self::col_bool(row, 11).unwrap_or(false);
                        let is_row_version = Self::col_bool(row, 12).unwrap_or(false);

                        entry.columns.push(ColumnItem {
                            name: col_name.to_string(),
                            data_type,
                            max_length,
                            precision,
                            scale,
                            is_nullable,
                            is_primary_key,
                            is_identity,
                            is_computed,
                            is_row_version,
                        });
                    }
                }
            }
        }

        Ok(tables_map.into_values().collect())
    }

    async fn switch_database(&mut self, database: &str) -> AppResult<()> {
        let sql = format!("USE [{}];", database.replace(']', "]]"));
        let stream = self.client.simple_query(sql).await?;
        let _ = stream.into_results().await?;
        self.current_database = database.to_string();
        Ok(())
    }

    async fn get_import_capabilities(
        &mut self,
        database: Option<&str>,
        schema: &str,
        table: &str,
    ) -> AppResult<ImportCapabilities> {
        if let Some(db) = database {
            if !db.is_empty() && self.current_database != db {
                self.switch_database(db).await?;
            }
        }

        let columns = self.get_columns(None, schema, table).await?;
        let qualified = import_sql::qualified_table(schema, table);
        let (can_alter_table, engine_edition) =
            self.query_alter_permission(&qualified).await?;

        let writable = import_sql::writable_columns(&columns);
        let identity_column = writable
            .iter()
            .find(|c| c.is_identity)
            .map(|c| c.name.clone());
        let supports_identity_insert = engine_edition != 6;

        let disabled_reason = if identity_column.is_none() {
            Some("此資料表沒有識別欄位 (IDENTITY)".to_string())
        } else if !supports_identity_insert {
            Some("此資料庫引擎不支援 SET IDENTITY_INSERT".to_string())
        } else if !can_alter_table {
            Some(format!(
                "目前使用者沒有 {} 的 ALTER 權限，無法使用 SET IDENTITY_INSERT",
                qualified
            ))
        } else {
            None
        };

        Ok(ImportCapabilities {
            identity_column,
            writable_column_count: writable.len(),
            can_alter_table,
            engine_edition,
            supports_identity_insert,
            disabled_reason,
        })
    }

    async fn import_table_rows(
        &mut self,
        database: Option<&str>,
        schema: &str,
        table: &str,
        columns: &[String],
        rows: &[ImportRowPayload],
        manual_identity: bool,
        progress: Option<UnboundedSender<usize>>,
    ) -> AppResult<ImportResult> {
        let start = Instant::now();
        if let Some(db) = database {
            if !db.is_empty() && self.current_database != db {
                self.switch_database(db).await?;
            }
        }

        let server_columns = self.get_columns(None, schema, table).await?;
        if server_columns.is_empty() {
            return Err(AppError::Database {
                message: format!("找不到資料表 [{}].[{}] 的欄位定義", schema, table),
                code: None,
                line_number: None,
            });
        }

        let expected = import_sql::import_columns(&server_columns);
        let mismatch = expected.len() != columns.len()
            || columns
                .iter()
                .zip(expected.iter())
                .any(|(provided, column)| !provided.eq_ignore_ascii_case(&column.name));
        if mismatch {
            return Err(AppError::Database {
                message: "匯入欄位清單與資料表目前定義不符，請關閉後重新開啟匯入視窗".to_string(),
                code: None,
                line_number: None,
            });
        }

        if rows.is_empty() {
            return Ok(ImportResult {
                inserted_count: 0,
                rolled_back: false,
                errors: Vec::new(),
                execution_time_ms: 0,
            });
        }

        let qualified = import_sql::qualified_table(schema, table);
        let use_identity_insert = manual_identity && expected.iter().any(|c| c.is_identity);
        let total_rows = rows.len();

        let (prepared, preparation_errors) = import_sql::prepare_rows(rows, &expected, &qualified);
        if !preparation_errors.is_empty() {
            return Ok(ImportResult {
                inserted_count: 0,
                rolled_back: true,
                errors: preparation_errors,
                execution_time_ms: start.elapsed().as_millis() as u64,
            });
        }

        if let Err(err) = self
            .exec_script(&import_sql::build_setup_script(&qualified, use_identity_insert))
            .await
        {
            let _ = self
                .exec_script(&import_sql::build_rollback_script(&qualified, use_identity_insert))
                .await;
            return Err(err);
        }

        let batches = import_sql::chunk_prepared_rows(&prepared);
        let mut processed = 0usize;
        let mut failure_message: Option<String> = None;

        for batch in batches.iter() {
            match self
                .exec_import_batch(&import_sql::build_batch_script(batch))
                .await
            {
                Ok(Some((err_count, xact_state))) => {
                    processed += batch.len();
                    if let Some(sender) = progress.as_ref() {
                        let _ = sender.send(processed);
                    }
                    if err_count > 0 || xact_state == -1 {
                        failure_message = Some(format!(
                            "第 {} 列批次寫入失敗（伺服器回報 {} 筆錯誤）",
                            processed,
                            err_count.max(1)
                        ));
                        break;
                    }
                }
                Ok(None) => {
                    failure_message =
                        Some("無法確認批次執行結果，已停止匯入並回滾".to_string());
                    break;
                }
                Err(err) => {
                    failure_message = Some(err.to_string());
                    break;
                }
            }
        }

        if let Some(message) = failure_message {
            return match self
                .query_import_errors(&import_sql::build_rollback_script(
                    &qualified,
                    use_identity_insert,
                ))
                .await
            {
                Ok(mut errors) => {
                    if errors.is_empty() {
                        errors.push(ImportRowError {
                            line: 0,
                            column: None,
                            message: message.clone(),
                            server_code: None,
                        });
                    }
                    Ok(ImportResult {
                        inserted_count: 0,
                        rolled_back: true,
                        errors,
                        execution_time_ms: start.elapsed().as_millis() as u64,
                    })
                }
                // The transaction could not be confirmed as rolled back; surface it as an
                // error so the caller can drop this session instead of reusing it.
                Err(err) => Err(AppError::Database {
                    message: format!("匯入失敗且無法確認交易已回滾：{}（原始錯誤：{}）", err, message),
                    code: None,
                    line_number: None,
                }),
            };
        }

        self.exec_script(&import_sql::build_commit_script(&qualified, use_identity_insert))
            .await?;
        if let Some(sender) = progress.as_ref() {
            let _ = sender.send(total_rows);
        }

        Ok(ImportResult {
            inserted_count: total_rows as u64,
            rolled_back: false,
            errors: Vec::new(),
            execution_time_ms: start.elapsed().as_millis() as u64,
        })
    }
}
