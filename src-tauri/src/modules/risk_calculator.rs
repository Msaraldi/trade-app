// AlgoTrade OS - Risk Calculator Module
// Pozisyon boyutu ve risk hesaplama modülü

use crate::models::RiskCalculation;

/// Risk hesaplayıcı
pub struct RiskCalculator;

impl RiskCalculator {
    /// Pozisyon boyutunu hesapla
    ///
    /// # Arguments
    /// * `account_balance` - Hesap bakiyesi
    /// * `risk_percent` - Risk yüzdesi (örn: 1.0 = %1)
    /// * `entry_price` - Giriş fiyatı
    /// * `stop_price` - Stop-loss fiyatı
    /// * `take_profit_price` - Take-profit fiyatı (opsiyonel)
    pub fn calculate_position_size(
        account_balance: f64,
        risk_percent: f64,
        entry_price: f64,
        stop_price: f64,
        take_profit_price: Option<f64>,
    ) -> RiskCalculation {
        // Risk edilecek miktar
        let risk_amount = account_balance * (risk_percent / 100.0);

        // Fiyat başına risk (entry - stop)
        let risk_per_unit = (entry_price - stop_price).abs();

        // Pozisyon boyutu (lot/adet)
        let position_size = if risk_per_unit > 0.0 {
            risk_amount / risk_per_unit
        } else {
            0.0
        };

        // Potansiyel kayıp
        let potential_loss = position_size * risk_per_unit;

        // Potansiyel kar ve R:R oranı
        let (potential_profit, risk_reward_ratio) = if let Some(tp) = take_profit_price {
            let profit_per_unit = (tp - entry_price).abs();
            let profit = position_size * profit_per_unit;
            let rr = if risk_per_unit > 0.0 {
                profit_per_unit / risk_per_unit
            } else {
                0.0
            };
            (profit, rr)
        } else {
            (0.0, 0.0)
        };

        RiskCalculation {
            position_size,
            risk_amount,
            risk_percent,
            potential_loss,
            potential_profit,
            risk_reward_ratio,
        }
    }

    /// Kümülatif risk hesapla (tüm açık pozisyonların toplam riski)
    pub fn calculate_cumulative_risk(
        account_balance: f64,
        positions_risk: Vec<f64>,
    ) -> (f64, f64) {
        let total_risk: f64 = positions_risk.iter().sum();
        let risk_percent = if account_balance > 0.0 {
            (total_risk / account_balance) * 100.0
        } else {
            0.0
        };
        (total_risk, risk_percent)
    }

    /// Günlük maksimum kayıp kontrolü
    pub fn check_daily_loss_limit(
        daily_pnl: f64,
        max_daily_loss: f64,
        account_balance: f64,
    ) -> bool {
        let loss_percent = if account_balance > 0.0 {
            (daily_pnl.abs() / account_balance) * 100.0
        } else {
            0.0
        };

        // true = limit aşılmadı, trading devam edebilir
        // false = limit aşıldı, trading durdurulmalı
        daily_pnl >= 0.0 || loss_percent < max_daily_loss
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_position_size_calculation() {
        let result = RiskCalculator::calculate_position_size(
            10000.0,  // $10,000 hesap
            1.0,      // %1 risk
            100.0,    // $100 giriş
            95.0,     // $95 stop
            Some(110.0), // $110 TP
        );

        assert_eq!(result.risk_amount, 100.0); // $100 risk
        assert_eq!(result.position_size, 20.0); // 20 adet
        assert_eq!(result.risk_reward_ratio, 2.0); // 2:1 R:R
    }

    #[test]
    fn test_cumulative_risk() {
        let (total, percent) = RiskCalculator::calculate_cumulative_risk(
            10000.0,
            vec![100.0, 150.0, 50.0],
        );

        assert_eq!(total, 300.0);
        assert_eq!(percent, 3.0);
    }

    #[test]
    fn test_daily_loss_limit() {
        // Limit aşılmadı
        assert!(RiskCalculator::check_daily_loss_limit(-200.0, 5.0, 10000.0));
        // Limit aşıldı
        assert!(!RiskCalculator::check_daily_loss_limit(-600.0, 5.0, 10000.0));
        // Kar durumunda
        assert!(RiskCalculator::check_daily_loss_limit(500.0, 5.0, 10000.0));
    }
}
