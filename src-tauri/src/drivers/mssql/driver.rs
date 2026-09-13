use super::connection::SqlServerConnection;
use crate::drivers::{DatabaseConnection, DatabaseDriver};
use crate::error::{AppError, AppResult};
use crate::models::connection::ConnectionProfile;
use async_trait::async_trait;
use tiberius::{AuthMethod, Client, Config};
use tokio::net::TcpStream;
use tokio_util::compat::TokioAsyncWriteCompatExt;

pub struct SqlServerDriver;

impl SqlServerDriver {
    pub fn new() -> Self {
        Self
    }

    fn build_config(&self, profile: &ConnectionProfile, password: &str) -> Config {
        let mut config = Config::new();
        config.host(&profile.host);
        config.port(profile.port);
        config.database(&profile.database);
        config.authentication(AuthMethod::sql_server(&profile.username, password));

        if profile.trust_server_certificate {
            config.trust_cert();
        }

        config
    }
}

#[async_trait]
impl DatabaseDriver for SqlServerDriver {
    async fn connect(
        &self,
        profile: &ConnectionProfile,
        password: &str,
    ) -> AppResult<Box<dyn DatabaseConnection>> {
        let config = self.build_config(profile, password);
        let addr = config.get_addr().to_string();

        let tcp = TcpStream::connect(&addr).await.map_err(|e| AppError::Connection {
            message: format!("Failed to connect to {}: {}", addr, e),
        })?;

        let _ = tcp.set_nodelay(true);

        let mut client = Client::connect(config, tcp.compat_write())
            .await
            .map_err(|e| AppError::Connection {
                message: format!("SQL Server handshake/authentication failed: {}", e),
            })?;

        let spid = match client.simple_query("SELECT @@SPID;").await {
            Ok(stream) => match stream.into_results().await {
                Ok(results) => results
                    .first()
                    .and_then(|rows| rows.first())
                    .and_then(|row| {
                        if let Ok(Some(v)) = row.try_get::<i32, _>(0) {
                            return Some(v as u32);
                        }
                        if let Ok(Some(v)) = row.try_get::<i16, _>(0) {
                            return Some(v as u32);
                        }
                        if let Ok(Some(v)) = row.try_get::<i64, _>(0) {
                            return Some(v as u32);
                        }
                        None
                    })
                    .unwrap_or(0),
                Err(_) => 0,
            },
            Err(_) => 0,
        };

        Ok(Box::new(SqlServerConnection::new(
            client,
            profile.database.clone(),
            spid,
        )))
    }

    async fn test_connection(&self, profile: &ConnectionProfile, password: &str) -> AppResult<()> {
        let mut conn = self.connect(profile, password).await?;
        let _ = conn.execute_query("SELECT 1;", Some(1)).await?;
        Ok(())
    }
}
