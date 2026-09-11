pub mod commands;
pub mod drivers;
pub mod error;
pub mod models;
pub mod services;

use commands::connection_commands::*;
use commands::query_commands::*;
use commands::schema_commands::*;
use services::ConnectionManager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let connection_manager = ConnectionManager::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(connection_manager)
        .invoke_handler(tauri::generate_handler![
            get_connections,
            save_connection,
            delete_connection,
            test_connection,
            connect,
            disconnect,
            execute_query,
            get_databases,
            get_tables,
            get_columns,
            get_database_schema,
            switch_database,
        ])
        .run(tauri::generate_context!())
        .expect("error while running SQLight application");
}
