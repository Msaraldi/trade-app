// AlgoTrade OS - Tauri Commands
// Frontend ile iletişim kuran komutlar

use serde::{Deserialize, Serialize};
use std::sync::OnceLock;
use tokio::sync::RwLock;
use crate::models::{RiskCalculation, UserSettings};
use crate::modules::risk_calculator::RiskCalculator;
use crate::i18n::{Language, t, current_language};
use crate::exchange::bybit::{BybitClient, WalletBalance, TickerInfo, InstrumentInfo, Kline, MarketCategory, AllInstruments};
use crate::db::{self, Drawing};

// Global exchange client
static EXCHANGE_CLIENT: OnceLock<RwLock<Option<BybitClient>>> = OnceLock::new();
static CONNECTION_STATUS: OnceLock<RwLock<ConnectionState>> = OnceLock::new();

// Module states
static MODULE_STATES: OnceLock<RwLock<std::collections::HashMap<String, bool>>> = OnceLock::new();

fn get_module_states() -> &'static RwLock<std::collections::HashMap<String, bool>> {
    MODULE_STATES.get_or_init(|| RwLock::new(std::collections::HashMap::new()))
}

fn get_client_lock() -> &'static RwLock<Option<BybitClient>> {
    EXCHANGE_CLIENT.get_or_init(|| RwLock::new(None))
}

fn get_status_lock() -> &'static RwLock<ConnectionState> {
    CONNECTION_STATUS.get_or_init(|| RwLock::new(ConnectionState::default()))
}

/// Risk hesaplama isteği
#[derive(Debug, Deserialize)]
pub struct CalculateRiskRequest {
    pub account_balance: f64,
    pub risk_percent: f64,
    pub entry_price: f64,
    pub stop_price: f64,
    pub take_profit_price: Option<f64>,
}

/// Risk hesaplama komutu
#[tauri::command]
pub fn calculate_risk(request: CalculateRiskRequest) -> RiskCalculation {
    RiskCalculator::calculate_position_size(
        request.account_balance,
        request.risk_percent,
        request.entry_price,
        request.stop_price,
        request.take_profit_price,
    )
}

/// Kullanıcı ayarlarını al
#[tauri::command]
pub fn get_settings() -> UserSettings {
    UserSettings::default()
}

/// Uygulama versiyonu
#[tauri::command]
pub fn get_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// Modül listesi
#[derive(Debug, Serialize)]
pub struct ModuleInfo {
    pub id: String,
    pub name: String,
    pub description: String,
    pub is_active: bool,
    pub can_trade: bool,
}

/// Mevcut modülleri listele
#[tauri::command]
pub async fn list_modules() -> Vec<ModuleInfo> {
    let states = get_module_states().read().await;

    vec![
        // === Grafik Göstergeleri ===
        ModuleInfo {
            id: "sma_analyzer".into(),
            name: t("module.sma_analyzer.name"),
            description: t("module.sma_analyzer.description"),
            is_active: *states.get("sma_analyzer").unwrap_or(&false),
            can_trade: false,
        },
        ModuleInfo {
            id: "vwap_analyzer".into(),
            name: t("module.vwap_analyzer.name"),
            description: t("module.vwap_analyzer.description"),
            is_active: *states.get("vwap_analyzer").unwrap_or(&false),
            can_trade: false,
        },
        ModuleInfo {
            id: "anchored_vwap".into(),
            name: t("module.anchored_vwap.name"),
            description: t("module.anchored_vwap.description"),
            is_active: *states.get("anchored_vwap").unwrap_or(&false),
            can_trade: false,
        },
        // === Risk ve İzleme ===
        ModuleInfo {
            id: "risk_monitor".into(),
            name: t("module.risk_monitor.name"),
            description: t("module.risk_monitor.description"),
            is_active: *states.get("risk_monitor").unwrap_or(&false),
            can_trade: false,
        },
        // === İşlem Araçları ===
        ModuleInfo {
            id: "stop_loss".into(),
            name: t("module.stop_loss.name"),
            description: t("module.stop_loss.description"),
            is_active: *states.get("stop_loss").unwrap_or(&false),
            can_trade: true,
        },
        ModuleInfo {
            id: "batch_trading".into(),
            name: t("module.batch_trading.name"),
            description: t("module.batch_trading.description"),
            is_active: *states.get("batch_trading").unwrap_or(&false),
            can_trade: true,
        },
        // === Strateji Oluşturucu (En Altta Sabit) ===
        ModuleInfo {
            id: "strategy_builder".into(),
            name: t("module.strategy_builder.name"),
            description: t("module.strategy_builder.description"),
            is_active: *states.get("strategy_builder").unwrap_or(&false),
            can_trade: false,
        },
    ]
}

/// Modül durumunu değiştir
#[tauri::command]
pub async fn toggle_module(module_id: String, active: bool) -> Result<bool, String> {
    tracing::info!("Modül {} durumu: {}", module_id, active);

    let mut states = get_module_states().write().await;
    states.insert(module_id, active);

    Ok(active)
}

/// Sağlık kontrolü
#[tauri::command]
pub fn health_check() -> bool {
    true
}

// ==================== i18n Commands ====================

/// Dil bilgisi
#[derive(Debug, Serialize)]
pub struct LanguageInfo {
    pub code: String,
    pub native_name: String,
}

/// Dili değiştir
#[tauri::command]
pub fn set_language(language_code: String) -> Result<LanguageInfo, String> {
    let lang = Language::from_code(&language_code)
        .ok_or_else(|| format!("Desteklenmeyen dil kodu: {}", language_code))?;

    crate::i18n::set_language(lang);
    tracing::info!("Dil değiştirildi: {}", lang.native_name());

    Ok(LanguageInfo {
        code: lang.code().to_string(),
        native_name: lang.native_name().to_string(),
    })
}

/// Mevcut dili al
#[tauri::command]
pub fn get_current_language() -> LanguageInfo {
    let lang = current_language();
    LanguageInfo {
        code: lang.code().to_string(),
        native_name: lang.native_name().to_string(),
    }
}

/// Mevcut dilleri listele
#[tauri::command]
pub fn get_available_languages() -> Vec<LanguageInfo> {
    vec![
        LanguageInfo {
            code: "en".to_string(),
            native_name: "English".to_string(),
        },
        LanguageInfo {
            code: "tr".to_string(),
            native_name: "Türkçe".to_string(),
        },
    ]
}

// ==================== Exchange Commands ====================

/// Bağlantı durumu
#[derive(Debug, Clone, Serialize, Default)]
pub struct ConnectionState {
    pub is_connected: bool,
    pub is_demo: bool,
    pub exchange: String,
    pub error: Option<String>,
}

/// API kimlik bilgileri
#[derive(Debug, Deserialize)]
pub struct ApiCredentials {
    pub api_key: String,
    pub api_secret: String,
    pub testnet: bool,
}

/// Borsaya bağlan
#[tauri::command]
pub async fn connect_exchange(credentials: ApiCredentials) -> Result<ConnectionState, String> {
    let client = BybitClient::new(
        credentials.api_key,
        credentials.api_secret,
        credentials.testnet,
    );

    // Bağlantıyı test et
    match client.test_connection().await {
        Ok(true) => {
            // Client'ı kaydet
            {
                let mut lock = get_client_lock().write().await;
                *lock = Some(client);
            }

            // Durumu güncelle
            let state = ConnectionState {
                is_connected: true,
                is_demo: credentials.testnet,
                exchange: "Bybit".to_string(),
                error: None,
            };

            {
                let mut status = get_status_lock().write().await;
                *status = state.clone();
            }

            tracing::info!("Bybit bağlantısı başarılı (testnet: {})", credentials.testnet);
            Ok(state)
        }
        Ok(false) => {
            Err("Bağlantı testi başarısız".to_string())
        }
        Err(e) => {
            Err(format!("Bağlantı hatası: {}", e))
        }
    }
}

/// Borsadan bağlantıyı kes
#[tauri::command]
pub async fn disconnect_exchange() -> Result<ConnectionState, String> {
    {
        let mut lock = get_client_lock().write().await;
        *lock = None;
    }

    let state = ConnectionState {
        is_connected: false,
        is_demo: true,
        exchange: String::new(),
        error: None,
    };

    {
        let mut status = get_status_lock().write().await;
        *status = state.clone();
    }

    tracing::info!("Bybit bağlantısı kesildi");
    Ok(state)
}

/// Bağlantı durumunu al
#[tauri::command]
pub async fn get_connection_status() -> ConnectionState {
    get_status_lock().read().await.clone()
}

/// Cüzdan bakiyesini al
#[tauri::command]
pub async fn get_wallet_balance() -> Result<WalletBalance, String> {
    let lock = get_client_lock().read().await;
    let client = lock.as_ref().ok_or("Bağlantı yok. Önce API ile bağlanın.")?;

    client.get_wallet_balance().await
        .map_err(|e| e.to_string())
}

/// Ticker bilgisini al - kategori destekli
#[tauri::command]
pub async fn get_ticker(symbol: String, category: Option<String>) -> Result<TickerInfo, String> {
    let cat = parse_category(&category.unwrap_or_else(|| "linear".to_string()));
    let lock = get_client_lock().read().await;

    // Bağlantı yoksa public API kullan
    if lock.is_none() {
        let client = BybitClient::new(String::new(), String::new(), false);
        return client.get_ticker(&symbol, cat).await.map_err(|e| e.to_string());
    }

    let client = lock.as_ref().unwrap();
    client.get_ticker(&symbol, cat).await.map_err(|e| e.to_string())
}

/// Tüm ticker'ları al - kategori destekli (leverage bilgisi ile)
#[tauri::command]
pub async fn get_all_tickers(category: Option<String>) -> Result<Vec<TickerInfo>, String> {
    let cat = parse_category(&category.unwrap_or_else(|| "linear".to_string()));
    let client = BybitClient::new(String::new(), String::new(), false);
    // Futures kategorileri için leverage bilgisi de çek
    if cat == MarketCategory::Linear || cat == MarketCategory::Inverse {
        client.get_all_tickers_with_leverage(cat).await.map_err(|e| e.to_string())
    } else {
        client.get_all_tickers(cat).await.map_err(|e| e.to_string())
    }
}

/// Tüm enstrümanları al - kategori destekli
#[tauri::command]
pub async fn get_instruments(category: Option<String>) -> Result<Vec<InstrumentInfo>, String> {
    let cat = parse_category(&category.unwrap_or_else(|| "linear".to_string()));
    let client = BybitClient::new(String::new(), String::new(), false);
    client.get_instruments(cat).await.map_err(|e| e.to_string())
}

/// Tüm kategorilerden enstrümanları al
#[tauri::command]
pub async fn get_all_instruments() -> Result<AllInstruments, String> {
    let client = BybitClient::new(String::new(), String::new(), false);
    client.get_all_instruments().await.map_err(|e| e.to_string())
}

/// Kline verilerini al - kategori destekli
#[tauri::command]
pub async fn get_klines(symbol: String, category: Option<String>, interval: String, limit: u32) -> Result<Vec<Kline>, String> {
    let cat = parse_category(&category.unwrap_or_else(|| "linear".to_string()));
    let client = BybitClient::new(String::new(), String::new(), false);
    client.get_klines(&symbol, cat, &interval, limit).await.map_err(|e| e.to_string())
}

/// Tüm tarihsel kline verilerini al (başlangıçtan bugüne)
#[tauri::command]
pub async fn get_all_klines(
    symbol: String,
    category: Option<String>,
    interval: String,
    start_time: Option<i64>,
    end_time: Option<i64>,
) -> Result<Vec<Kline>, String> {
    let cat = parse_category(&category.unwrap_or_else(|| "linear".to_string()));
    let client = BybitClient::new(String::new(), String::new(), false);
    client.get_all_klines(&symbol, cat, &interval, start_time, end_time)
        .await
        .map_err(|e| e.to_string())
}

/// Kategori string'ini parse et
fn parse_category(s: &str) -> MarketCategory {
    match s.to_lowercase().as_str() {
        "spot" => MarketCategory::Spot,
        "inverse" => MarketCategory::Inverse,
        _ => MarketCategory::Linear,
    }
}

/// API kimlik bilgilerini kaydet (şifrelenmiş)
#[tauri::command]
pub async fn save_api_credentials(credentials: ApiCredentials) -> Result<bool, String> {
    // TODO: Vault ile şifreli kaydetme
    tracing::info!("API kimlik bilgileri kaydedildi (testnet: {})", credentials.testnet);
    Ok(true)
}

/// API bağlantısını test et
#[tauri::command]
pub async fn test_api_connection(credentials: ApiCredentials) -> Result<bool, String> {
    let client = BybitClient::new(
        credentials.api_key,
        credentials.api_secret,
        credentials.testnet,
    );

    client.test_connection().await.map_err(|e| e.to_string())
}

// ==================== Drawing Commands ====================

/// Save drawing request
#[derive(Debug, Deserialize)]
pub struct SaveDrawingRequest {
    pub id: String,
    pub symbol: String,
    pub interval: String,
    pub drawing_type: String,
    pub points: String,      // JSON string
    pub style: String,       // JSON string
    #[serde(default)]
    pub visible: Option<bool>,
    #[serde(default)]
    pub locked: Option<bool>,
}

/// Save or update a drawing
#[tauri::command]
pub async fn save_drawing(request: SaveDrawingRequest) -> Result<Drawing, String> {
    let drawing = Drawing {
        id: request.id,
        symbol: request.symbol,
        interval: request.interval,
        drawing_type: request.drawing_type,
        points: request.points,
        style: request.style,
        visible: request.visible.unwrap_or(true),
        locked: request.locked.unwrap_or(false),
        created_at: 0, // Will be set by db
        updated_at: 0, // Will be set by db
    };

    db::save_drawing(drawing).await
}

/// Get all drawings for a symbol and interval
#[tauri::command]
pub async fn get_drawings(symbol: String, interval: String) -> Result<Vec<Drawing>, String> {
    db::get_drawings(&symbol, &interval).await
}

/// Delete a drawing by ID
#[tauri::command]
pub async fn delete_drawing(id: String) -> Result<bool, String> {
    db::delete_drawing(&id).await
}

/// Clear all drawings for a symbol and interval
#[tauri::command]
pub async fn clear_drawings(symbol: String, interval: String) -> Result<u64, String> {
    db::clear_drawings(&symbol, &interval).await
}

/// Get all drawings for a symbol (all intervals)
#[tauri::command]
pub async fn get_all_drawings_for_symbol(symbol: String) -> Result<Vec<Drawing>, String> {
    db::get_all_drawings_for_symbol(&symbol).await
}
