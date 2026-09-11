use crate::drivers::DatabaseConnection;
use crate::error::AppResult;
use crate::models::query::{CellValue, ColumnDef, QueryMessage, QueryResult, ResultSet};
use crate::models::schema::{ColumnItem, DatabaseItem, SchemaItem, TableItem};
use async_trait::async_trait;
use chrono::{NaiveDate, NaiveDateTime, NaiveTime, Timelike, Utc};
use std::time::Instant;
use tiberius::{Client, Column, ColumnData, FromSql, Row};
use tokio::net::TcpStream;
use tokio_util::compat::Compat;

pub type TiberiusClient = Client<Compat<TcpStream>>;

pub struct SqlServerConnection {
    client: TiberiusClient,
    current_database: String,
}

impl SqlServerConnection {
    pub fn new(client: TiberiusClient, database: String) -> Self {
        Self {
            client,
            current_database: database,
        }
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
}

#[async_trait]
impl DatabaseConnection for SqlServerConnection {
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
                CAST(ISNULL(COLUMNPROPERTY(OBJECT_ID(c.TABLE_SCHEMA + '.' + c.TABLE_NAME), c.COLUMN_NAME, 'IsIdentity'), 0) AS INT) AS IS_IDENTITY
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
                    });
                }
            }
        }
        Ok(columns)
    }

    async fn switch_database(&mut self, database: &str) -> AppResult<()> {
        let sql = format!("USE [{}];", database.replace(']', "]]"));
        let stream = self.client.simple_query(sql).await?;
        let _ = stream.into_results().await?;
        self.current_database = database.to_string();
        Ok(())
    }
}
