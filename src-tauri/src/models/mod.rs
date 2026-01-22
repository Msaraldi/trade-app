// AlgoTrade OS - Data Models
// Tüm veri yapıları burada tanımlanır

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

/// Standart fiyat tick verisi - tüm borsalardan gelen veri bu formata dönüştürülür
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StandardTick {
    pub symbol: String,
    pub price: f64,
    pub volume: f64,
    pub timestamp: DateTime<Utc>,
    pub exchange: Exchange,
}

/// Desteklenen borsalar
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum Exchange {
    Binance,
    Bybit,
    // Gelecekte eklenecek borsalar
}

/// Pozisyon bilgisi
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Position {
    pub id: String,
    pub symbol: String,
    pub side: PositionSide,
    pub entry_price: f64,
    pub quantity: f64,
    pub stop_loss: Option<f64>,
    pub take_profit: Option<f64>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum PositionSide {
    Long,
    Short,
}

/// Emir tipi
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Order {
    pub id: String,
    pub symbol: String,
    pub side: OrderSide,
    pub order_type: OrderType,
    pub price: Option<f64>,
    pub quantity: f64,
    pub status: OrderStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum OrderSide {
    Buy,
    Sell,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum OrderType {
    Market,
    Limit,
    StopMarket,
    StopLimit,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum OrderStatus {
    Pending,
    Filled,
    PartiallyFilled,
    Cancelled,
    Rejected,
}

/// Kullanıcı ayarları
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserSettings {
    pub default_risk_percent: f64,
    pub max_daily_loss: f64,
    pub theme: Theme,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum Theme {
    Light,
    Dark,
}

impl Default for UserSettings {
    fn default() -> Self {
        Self {
            default_risk_percent: 1.0,
            max_daily_loss: 5.0,
            theme: Theme::Dark,
        }
    }
}

/// Alarm tanımı
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Alarm {
    pub id: String,
    pub symbol: String,
    pub condition: AlarmCondition,
    pub target_price: f64,
    pub is_active: bool,
    pub notification_type: NotificationType,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AlarmCondition {
    PriceAbove,
    PriceBelow,
    CrossVwap,
    CrossVal,
    CrossVah,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum NotificationType {
    Visual,
    Sound,
    OsNative,
    Webhook,
}

/// Risk hesaplama sonucu
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskCalculation {
    pub position_size: f64,
    pub risk_amount: f64,
    pub risk_percent: f64,
    pub potential_loss: f64,
    pub potential_profit: f64,
    pub risk_reward_ratio: f64,
}
