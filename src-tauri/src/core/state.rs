// AlgoTrade OS - Application State
// Uygulama durumu ve paylaşılan veriler

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use crate::models::{StandardTick, Alarm, UserSettings, Position};
use crate::core::EventDispatcher;

/// Uygulama durumu - tüm modüller tarafından paylaşılır
pub struct AppState {
    /// Olay dağıtıcı
    pub dispatcher: EventDispatcher,
    /// Canlı fiyatlar (symbol -> tick)
    pub live_prices: Arc<RwLock<HashMap<String, StandardTick>>>,
    /// Aktif alarmlar
    pub alarms: Arc<RwLock<Vec<Alarm>>>,
    /// Kullanıcı ayarları
    pub settings: Arc<RwLock<UserSettings>>,
    /// Açık pozisyonlar
    pub positions: Arc<RwLock<Vec<Position>>>,
    /// Aktif modüller
    pub active_modules: Arc<RwLock<HashMap<String, bool>>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            dispatcher: EventDispatcher::default(),
            live_prices: Arc::new(RwLock::new(HashMap::new())),
            alarms: Arc::new(RwLock::new(Vec::new())),
            settings: Arc::new(RwLock::new(UserSettings::default())),
            positions: Arc::new(RwLock::new(Vec::new())),
            active_modules: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Fiyat güncelle
    pub async fn update_price(&self, tick: StandardTick) {
        let symbol = tick.symbol.clone();
        {
            let mut prices = self.live_prices.write().await;
            prices.insert(symbol, tick.clone());
        }
        let _ = self.dispatcher.publish(crate::core::dispatcher::AppEvent::PriceUpdated(tick));
    }

    /// Belirli bir sembolün son fiyatını al
    pub async fn get_price(&self, symbol: &str) -> Option<StandardTick> {
        let prices = self.live_prices.read().await;
        prices.get(symbol).cloned()
    }

    /// Modül durumunu güncelle
    pub async fn set_module_active(&self, module_id: &str, is_active: bool) {
        {
            let mut modules = self.active_modules.write().await;
            modules.insert(module_id.to_string(), is_active);
        }
        let _ = self.dispatcher.publish(crate::core::dispatcher::AppEvent::ModuleStateChanged {
            module_id: module_id.to_string(),
            is_active,
        });
    }

    /// Modül aktif mi?
    pub async fn is_module_active(&self, module_id: &str) -> bool {
        let modules = self.active_modules.read().await;
        modules.get(module_id).copied().unwrap_or(false)
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}
