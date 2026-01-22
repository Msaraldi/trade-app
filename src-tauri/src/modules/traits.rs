// AlgoTrade OS - Module Traits
// Tüm modüllerin uygulaması gereken arayüz

use async_trait::async_trait;
use crate::models::{StandardTick, Position};
use std::sync::Arc;
use crate::core::AppState;

/// Her modülün uygulaması gereken temel trait
#[async_trait]
pub trait TradingModule: Send + Sync {
    /// Modül kimliği
    fn id(&self) -> &str;

    /// Modül adı (UI'da gösterilecek)
    fn name(&self) -> &str;

    /// Modül açıklaması
    fn description(&self) -> &str;

    /// Modül başlatma
    async fn initialize(&mut self, state: Arc<AppState>) -> Result<(), ModuleError>;

    /// Modül durdurma
    async fn shutdown(&mut self) -> Result<(), ModuleError>;

    /// Fiyat güncellemesi geldiğinde çağrılır
    async fn on_price_tick(&mut self, tick: &StandardTick) -> Result<(), ModuleError>;

    /// Bakiye değiştiğinde çağrılır
    async fn on_balance_change(&mut self, symbol: &str, new_balance: f64) -> Result<(), ModuleError>;

    /// Pozisyon açıldığında çağrılır
    async fn on_position_opened(&mut self, position: &Position) -> Result<(), ModuleError>;

    /// Pozisyon kapandığında çağrılır
    async fn on_position_closed(&mut self, position: &Position, pnl: f64) -> Result<(), ModuleError>;

    /// Modülün emir gönderme yetkisi var mı?
    fn can_execute_orders(&self) -> bool {
        false // Varsayılan: hayır (güvenlik için)
    }

    /// Modül aktif mi?
    fn is_active(&self) -> bool;

    /// Modülü aktif/pasif yap
    fn set_active(&mut self, active: bool);
}

/// Modül hatası
#[derive(Debug, Clone)]
pub enum ModuleError {
    /// Başlatma hatası
    InitializationFailed(String),
    /// İşlem hatası
    ExecutionFailed(String),
    /// Yetki hatası
    Unauthorized(String),
    /// Bağlantı hatası
    ConnectionError(String),
    /// Genel hata
    Other(String),
}

impl std::fmt::Display for ModuleError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ModuleError::InitializationFailed(msg) => write!(f, "Initialization failed: {}", msg),
            ModuleError::ExecutionFailed(msg) => write!(f, "Execution failed: {}", msg),
            ModuleError::Unauthorized(msg) => write!(f, "Unauthorized: {}", msg),
            ModuleError::ConnectionError(msg) => write!(f, "Connection error: {}", msg),
            ModuleError::Other(msg) => write!(f, "Error: {}", msg),
        }
    }
}

impl std::error::Error for ModuleError {}

/// Modül izinleri
#[derive(Debug, Clone, PartialEq)]
pub enum ModulePermission {
    /// Sadece okuma (fiyat, orderbook vb.)
    ReadOnly,
    /// Analiz yapabilir (hesaplama, grafik)
    Analysis,
    /// Emir gönderebilir
    Trading,
    /// Tam yetki
    Full,
}
