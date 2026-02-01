// AlgoTrade OS - Main Library
// Tauri ve Rust tabanlı modüler işlem platformu

pub mod core;
pub mod models;
pub mod modules;
pub mod security;
pub mod commands;
pub mod i18n;
pub mod exchange;
pub mod db;

use commands::{
    calculate_risk, get_settings, get_version,
    list_modules, toggle_module, health_check,
    set_language, get_current_language, get_available_languages,
    // Exchange commands
    connect_exchange, disconnect_exchange, get_connection_status,
    get_wallet_balance, get_ticker, get_all_tickers, get_instruments, get_all_instruments,
    get_klines, get_all_klines,
    save_api_credentials, test_api_connection,
    // Drawing commands
    save_drawing, get_drawings, delete_drawing, clear_drawings, get_all_drawings_for_symbol,
    // Drawing group commands
    create_drawing_group, get_drawing_groups, update_drawing_group, delete_drawing_group,
    toggle_group_visibility, move_drawing_to_group,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Logging başlat
    tracing_subscriber::fmt::init();

    // Initialize database
    if let Err(e) = db::init_database() {
        tracing::error!("Database initialization failed: {}", e);
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            // Core commands
            calculate_risk,
            get_settings,
            get_version,
            list_modules,
            toggle_module,
            health_check,
            // i18n commands
            set_language,
            get_current_language,
            get_available_languages,
            // Exchange commands
            connect_exchange,
            disconnect_exchange,
            get_connection_status,
            get_wallet_balance,
            get_ticker,
            get_all_tickers,
            get_instruments,
            get_all_instruments,
            get_klines,
            get_all_klines,
            save_api_credentials,
            test_api_connection,
            // Drawing commands
            save_drawing,
            get_drawings,
            delete_drawing,
            clear_drawings,
            get_all_drawings_for_symbol,
            // Drawing group commands
            create_drawing_group,
            get_drawing_groups,
            update_drawing_group,
            delete_drawing_group,
            toggle_group_visibility,
            move_drawing_to_group,
        ])
        .run(tauri::generate_context!())
        .expect("AlgoTrade OS başlatılırken hata oluştu");
}
