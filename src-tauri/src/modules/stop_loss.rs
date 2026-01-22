// AlgoTrade OS - Smart Stop-Loss Module
// Akıllı stop-loss ve risk yönetimi modülü

use async_trait::async_trait;
use std::sync::Arc;
use crate::core::AppState;
use crate::models::{StandardTick, Position, PositionSide};
use super::traits::{TradingModule, ModuleError};

/// Akıllı Stop-Loss modülü
pub struct StopLossModule {
    is_active: bool,
    state: Option<Arc<AppState>>,
    /// Auto-breakeven aktif mi?
    auto_breakeven: bool,
    /// Breakeven için gereken R miktarı (örn: 1.0 = 1R)
    breakeven_threshold: f64,
}

impl StopLossModule {
    pub fn new() -> Self {
        Self {
            is_active: false,
            state: None,
            auto_breakeven: true,
            breakeven_threshold: 1.0,
        }
    }

    /// Pozisyon için breakeven kontrolü
    async fn check_breakeven(&self, position: &Position, current_price: f64) -> bool {
        let entry = position.entry_price;
        let stop = position.stop_loss.unwrap_or(entry);

        // Risk miktarı (1R)
        let risk = (entry - stop).abs();

        match position.side {
            PositionSide::Long => {
                // Long pozisyon: Fiyat entry + threshold*R üzerindeyse breakeven
                current_price >= entry + (risk * self.breakeven_threshold)
            }
            PositionSide::Short => {
                // Short pozisyon: Fiyat entry - threshold*R altındaysa breakeven
                current_price <= entry - (risk * self.breakeven_threshold)
            }
        }
    }
}

impl Default for StopLossModule {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl TradingModule for StopLossModule {
    fn id(&self) -> &str {
        "stop_loss"
    }

    fn name(&self) -> &str {
        "Smart Stop-Loss"
    }

    fn description(&self) -> &str {
        "Akıllı stop-loss yönetimi ve otomatik breakeven"
    }

    async fn initialize(&mut self, state: Arc<AppState>) -> Result<(), ModuleError> {
        self.state = Some(state);
        tracing::info!("StopLoss modülü başlatıldı");
        Ok(())
    }

    async fn shutdown(&mut self) -> Result<(), ModuleError> {
        self.state = None;
        tracing::info!("StopLoss modülü durduruldu");
        Ok(())
    }

    async fn on_price_tick(&mut self, tick: &StandardTick) -> Result<(), ModuleError> {
        if !self.is_active {
            return Ok(());
        }

        let state = self.state.as_ref().ok_or_else(|| {
            ModuleError::InitializationFailed("State not initialized".into())
        })?;

        // Açık pozisyonları kontrol et
        let positions = state.positions.read().await;
        for position in positions.iter() {
            if position.symbol == tick.symbol {
                // Breakeven kontrolü
                if self.auto_breakeven && self.check_breakeven(position, tick.price).await {
                    tracing::info!(
                        "Breakeven tetiklendi: {} @ {}",
                        position.symbol,
                        tick.price
                    );
                    // TODO: Stop emrini güncelle (borsaya gönder)
                }

                // Stop-loss kontrolü
                if let Some(stop) = position.stop_loss {
                    let should_close = match position.side {
                        PositionSide::Long => tick.price <= stop,
                        PositionSide::Short => tick.price >= stop,
                    };

                    if should_close {
                        tracing::warn!(
                            "Stop-loss tetiklendi: {} @ {} (stop: {})",
                            position.symbol,
                            tick.price,
                            stop
                        );
                        // TODO: Pozisyonu kapat (borsaya emir gönder)
                    }
                }
            }
        }

        Ok(())
    }

    async fn on_balance_change(&mut self, _symbol: &str, _new_balance: f64) -> Result<(), ModuleError> {
        // Bu modül bakiye değişikliklerini izlemiyor
        Ok(())
    }

    async fn on_position_opened(&mut self, position: &Position) -> Result<(), ModuleError> {
        tracing::info!("Yeni pozisyon izlemeye alındı: {}", position.symbol);
        Ok(())
    }

    async fn on_position_closed(&mut self, position: &Position, pnl: f64) -> Result<(), ModuleError> {
        tracing::info!(
            "Pozisyon kapatıldı: {} | PnL: {:.2}",
            position.symbol,
            pnl
        );
        Ok(())
    }

    fn can_execute_orders(&self) -> bool {
        true // Bu modül emir gönderebilir
    }

    fn is_active(&self) -> bool {
        self.is_active
    }

    fn set_active(&mut self, active: bool) {
        self.is_active = active;
    }
}
