use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug, Serialize, Deserialize)]
#[serde(tag = "type", content = "details")]
pub enum AppError {
    #[error("Database error: {message}")]
    Database {
        message: String,
        code: Option<i32>,
        line_number: Option<u32>,
    },

    #[error("Connection error: {message}")]
    Connection {
        message: String,
    },

    #[error("Credential store error: {message}")]
    Credential {
        message: String,
    },

    #[error("Internal error: {message}")]
    Internal {
        message: String,
    },

    #[error("Not found: {message}")]
    NotFound {
        message: String,
    },

    #[error("Query cancelled by user")]
    QueryCancelled,
}

pub type AppResult<T> = Result<T, AppError>;

impl From<tiberius::error::Error> for AppError {
    fn from(err: tiberius::error::Error) -> Self {
        match err {
            tiberius::error::Error::Server(server_err) => AppError::Database {
                message: server_err.message().to_string(),
                code: Some(server_err.code() as i32),
                line_number: Some(server_err.line()),
            },
            other => AppError::Database {
                message: other.to_string(),
                code: None,
                line_number: None,
            },
        }
    }
}

impl From<keyring::Error> for AppError {
    fn from(err: keyring::Error) -> Self {
        AppError::Credential {
            message: err.to_string(),
        }
    }
}

impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        AppError::Internal {
            message: err.to_string(),
        }
    }
}

impl From<serde_json::Error> for AppError {
    fn from(err: serde_json::Error) -> Self {
        AppError::Internal {
            message: err.to_string(),
        }
    }
}
