pub mod commands;
pub mod drivers;
pub mod error;
pub mod models;
pub mod services;

use commands::connection_commands::*;
use commands::query_commands::*;
use commands::schema_commands::*;
use commands::sql_folder_commands::*;
use commands::template_commands::*;
use services::ConnectionManager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize/clear the query log file on each application launch
    if let Err(e) = services::QueryLogger::init() {
        eprintln!("[SQLight] Failed to initialize query log file: {}", e);
    }

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
            open_query_log_file,
            get_query_log_path,
            get_databases,
            get_tables,
            get_columns,
            get_foreign_keys,
            get_database_schema,
            switch_database,
            load_custom_templates,
            save_custom_templates,
            open_custom_templates_file,
            pick_sql_folder,
            scan_sql_folder,
            read_sql_file,
            write_sql_file,
        ])

        .run(tauri::generate_context!())
        .expect("error while running SQLight application");
}
