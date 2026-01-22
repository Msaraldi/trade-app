// AlgoTrade OS - Event Dispatcher
// Borsa verilerini modüllere dağıtan Pub/Sub sistemi

use tokio::sync::broadcast;
use crate::models::StandardTick;

/// Sistem içindeki olaylar
#[derive(Debug, Clone)]
pub enum AppEvent {
    /// Fiyat güncellemesi
    PriceUpdated(StandardTick),
    /// Bakiye değişikliği
    BalanceChanged { symbol: String, balance: f64 },
    /// Pozisyon açıldı
    PositionOpened { position_id: String },
    /// Pozisyon kapandı
    PositionClosed { position_id: String, pnl: f64 },
    /// Alarm tetiklendi
    AlarmTriggered { alarm_id: String },
    /// Modül durumu değişti
    ModuleStateChanged { module_id: String, is_active: bool },
}

/// Olay dağıtıcı - tüm modüller buradan veri alır
pub struct EventDispatcher {
    sender: broadcast::Sender<AppEvent>,
}

impl EventDispatcher {
    /// Yeni bir dispatcher oluştur
    pub fn new(capacity: usize) -> Self {
        let (sender, _) = broadcast::channel(capacity);
        Self { sender }
    }

    /// Olay yayınla
    pub fn publish(&self, event: AppEvent) -> Result<usize, broadcast::error::SendError<AppEvent>> {
        self.sender.send(event)
    }

    /// Olaylara abone ol
    pub fn subscribe(&self) -> broadcast::Receiver<AppEvent> {
        self.sender.subscribe()
    }
}

impl Default for EventDispatcher {
    fn default() -> Self {
        Self::new(1024) // Varsayılan kapasite
    }
}

impl Clone for EventDispatcher {
    fn clone(&self) -> Self {
        Self {
            sender: self.sender.clone(),
        }
    }
}
