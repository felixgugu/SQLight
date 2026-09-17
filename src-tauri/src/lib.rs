pub mod commands;
pub mod drivers;
pub mod error;
pub mod models;
pub mod services;

use commands::connection_commands::*;
use commands::query_commands::*;
use commands::schema_commands::*;
use commands::template_commands::*;
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
            cancel_query,
            get_connection_spid,
            get_databases,
            get_tables,
            get_columns,
            get_foreign_keys,
            get_database_schema,
            switch_database,
            load_custom_templates,
            save_custom_templates,
            open_custom_templates_file,
        ])

        .run(tauri::generate_context!())
        .expect("error while running SQLight application");
}
