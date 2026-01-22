// AlgoTrade OS - Internationalization (i18n)
// Backend çeviri sistemi

use std::collections::HashMap;
use serde::{Deserialize, Serialize};

/// Desteklenen diller
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Language {
    #[serde(rename = "en")]
    English,
    #[serde(rename = "tr")]
    Turkish,
}

impl Default for Language {
    fn default() -> Self {
        Language::English
    }
}

impl Language {
    pub fn code(&self) -> &'static str {
        match self {
            Language::English => "en",
            Language::Turkish => "tr",
        }
    }

    pub fn native_name(&self) -> &'static str {
        match self {
            Language::English => "English",
            Language::Turkish => "Türkçe",
        }
    }

    pub fn from_code(code: &str) -> Option<Self> {
        match code.to_lowercase().as_str() {
            "en" | "en-us" | "en-gb" => Some(Language::English),
            "tr" | "tr-tr" => Some(Language::Turkish),
            _ => None,
        }
    }
}

/// Çeviri anahtarları
pub struct Translations {
    current_language: Language,
    translations: HashMap<Language, HashMap<&'static str, &'static str>>,
}

impl Translations {
    pub fn new() -> Self {
        let mut translations = HashMap::new();

        // English translations
        let mut en = HashMap::new();
        // App
        en.insert("app.name", "AlgoTrade OS");
        en.insert("app.demo_mode", "Demo Mode");
        en.insert("app.live_mode", "Live Mode");

        // Errors
        en.insert("error.general", "An error occurred");
        en.insert("error.network", "Network error. Please check your connection.");
        en.insert("error.api", "API error. Please try again.");
        en.insert("error.unauthorized", "Unauthorized. Please login again.");
        en.insert("error.insufficient_balance", "Insufficient balance.");
        en.insert("error.order_failed", "Order failed. Please try again.");
        en.insert("error.connection_lost", "Connection lost. Attempting to reconnect...");
        en.insert("error.invalid_input", "Invalid input. Please check your values.");
        en.insert("error.risk_limit_exceeded", "Risk limit exceeded. Cannot open new position.");
        en.insert("error.daily_loss_limit", "Daily loss limit reached. Trading disabled.");

        // Success messages
        en.insert("success.order_placed", "Order placed successfully");
        en.insert("success.order_cancelled", "Order cancelled");
        en.insert("success.order_filled", "Order filled");
        en.insert("success.position_opened", "Position opened");
        en.insert("success.position_closed", "Position closed");
        en.insert("success.settings_saved", "Settings saved");
        en.insert("success.connection_restored", "Connection restored");
        en.insert("success.api_connected", "API connected successfully");

        // Warnings
        en.insert("warning.risk_approaching", "Risk limit approaching");
        en.insert("warning.high_leverage", "High leverage detected");
        en.insert("warning.volatile_market", "High market volatility detected");
        en.insert("warning.breakeven_triggered", "Breakeven triggered");
        en.insert("warning.stop_loss_hit", "Stop loss hit");

        // Modules
        en.insert("module.stop_loss.name", "Smart Stop-Loss");
        en.insert("module.stop_loss.description", "Intelligent stop-loss management with auto-breakeven");
        en.insert("module.batch_trading.name", "Batch Trading");
        en.insert("module.batch_trading.description", "Bulk trading and asset group management");
        en.insert("module.vwap_analyzer.name", "VWAP Analyzer");
        en.insert("module.vwap_analyzer.description", "VWAP, VAL/VAH calculation and visualization");
        en.insert("module.risk_monitor.name", "Risk Monitor");
        en.insert("module.risk_monitor.description", "Cumulative risk tracking and daily limit control");
        en.insert("module.sma_analyzer.name", "SMA Analyzer");
        en.insert("module.sma_analyzer.description", "Simple Moving Averages (200D, 50W, 100W, 200W)");
        en.insert("module.anchored_vwap.name", "Anchored VWAP");
        en.insert("module.anchored_vwap.description", "VWAP from a specific anchor point to current time");
        en.insert("module.strategy_builder.name", "Strategy Builder");
        en.insert("module.strategy_builder.description", "Create custom trading signals by combining multiple indicators");

        // Trading
        en.insert("trading.buy", "Buy");
        en.insert("trading.sell", "Sell");
        en.insert("trading.long", "Long");
        en.insert("trading.short", "Short");
        en.insert("trading.market", "Market");
        en.insert("trading.limit", "Limit");
        en.insert("trading.stop_market", "Stop Market");
        en.insert("trading.stop_limit", "Stop Limit");

        // Order status
        en.insert("order.pending", "Pending");
        en.insert("order.filled", "Filled");
        en.insert("order.partially_filled", "Partially Filled");
        en.insert("order.cancelled", "Cancelled");
        en.insert("order.rejected", "Rejected");

        // Logs
        en.insert("log.module_started", "Module started");
        en.insert("log.module_stopped", "Module stopped");
        en.insert("log.websocket_connected", "WebSocket connected");
        en.insert("log.websocket_disconnected", "WebSocket disconnected");
        en.insert("log.price_updated", "Price updated");
        en.insert("log.order_sent", "Order sent to exchange");

        translations.insert(Language::English, en);

        // Turkish translations
        let mut tr = HashMap::new();
        // App
        tr.insert("app.name", "AlgoTrade OS");
        tr.insert("app.demo_mode", "Demo Modu");
        tr.insert("app.live_mode", "Canlı Mod");

        // Errors
        tr.insert("error.general", "Bir hata oluştu");
        tr.insert("error.network", "Ağ hatası. Lütfen bağlantınızı kontrol edin.");
        tr.insert("error.api", "API hatası. Lütfen tekrar deneyin.");
        tr.insert("error.unauthorized", "Yetkisiz erişim. Lütfen tekrar giriş yapın.");
        tr.insert("error.insufficient_balance", "Yetersiz bakiye.");
        tr.insert("error.order_failed", "Emir başarısız. Lütfen tekrar deneyin.");
        tr.insert("error.connection_lost", "Bağlantı kesildi. Yeniden bağlanmaya çalışılıyor...");
        tr.insert("error.invalid_input", "Geçersiz giriş. Lütfen değerlerinizi kontrol edin.");
        tr.insert("error.risk_limit_exceeded", "Risk limiti aşıldı. Yeni pozisyon açılamaz.");
        tr.insert("error.daily_loss_limit", "Günlük kayıp limitine ulaşıldı. İşlem devre dışı.");

        // Success messages
        tr.insert("success.order_placed", "Emir başarıyla verildi");
        tr.insert("success.order_cancelled", "Emir iptal edildi");
        tr.insert("success.order_filled", "Emir gerçekleşti");
        tr.insert("success.position_opened", "Pozisyon açıldı");
        tr.insert("success.position_closed", "Pozisyon kapatıldı");
        tr.insert("success.settings_saved", "Ayarlar kaydedildi");
        tr.insert("success.connection_restored", "Bağlantı yeniden kuruldu");
        tr.insert("success.api_connected", "API başarıyla bağlandı");

        // Warnings
        tr.insert("warning.risk_approaching", "Risk limitine yaklaşılıyor");
        tr.insert("warning.high_leverage", "Yüksek kaldıraç tespit edildi");
        tr.insert("warning.volatile_market", "Yüksek piyasa oynaklığı tespit edildi");
        tr.insert("warning.breakeven_triggered", "Breakeven tetiklendi");
        tr.insert("warning.stop_loss_hit", "Stop loss tetiklendi");

        // Modules
        tr.insert("module.stop_loss.name", "Akıllı Stop-Loss");
        tr.insert("module.stop_loss.description", "Otomatik breakeven ile akıllı stop-loss yönetimi");
        tr.insert("module.batch_trading.name", "Toplu İşlem");
        tr.insert("module.batch_trading.description", "Toplu işlem ve varlık grubu yönetimi");
        tr.insert("module.vwap_analyzer.name", "VWAP Analizi");
        tr.insert("module.vwap_analyzer.description", "VWAP, VAL/VAH hesaplama ve görselleştirme");
        tr.insert("module.risk_monitor.name", "Risk İzleyici");
        tr.insert("module.risk_monitor.description", "Kümülatif risk takibi ve günlük limit kontrolü");
        tr.insert("module.sma_analyzer.name", "SMA Analizi");
        tr.insert("module.sma_analyzer.description", "Basit Hareketli Ortalamalar (200G, 50H, 100H, 200H)");
        tr.insert("module.anchored_vwap.name", "Çapalı VWAP");
        tr.insert("module.anchored_vwap.description", "Belirli bir noktadan günümüze VWAP hesaplama");
        tr.insert("module.strategy_builder.name", "Strateji Oluşturucu");
        tr.insert("module.strategy_builder.description", "Birden fazla göstergeyi birleştirerek özel işlem sinyalleri oluşturun");

        // Trading
        tr.insert("trading.buy", "Al");
        tr.insert("trading.sell", "Sat");
        tr.insert("trading.long", "Long");
        tr.insert("trading.short", "Short");
        tr.insert("trading.market", "Piyasa");
        tr.insert("trading.limit", "Limit");
        tr.insert("trading.stop_market", "Stop Piyasa");
        tr.insert("trading.stop_limit", "Stop Limit");

        // Order status
        tr.insert("order.pending", "Bekliyor");
        tr.insert("order.filled", "Gerçekleşti");
        tr.insert("order.partially_filled", "Kısmen Gerçekleşti");
        tr.insert("order.cancelled", "İptal Edildi");
        tr.insert("order.rejected", "Reddedildi");

        // Logs
        tr.insert("log.module_started", "Modül başlatıldı");
        tr.insert("log.module_stopped", "Modül durduruldu");
        tr.insert("log.websocket_connected", "WebSocket bağlandı");
        tr.insert("log.websocket_disconnected", "WebSocket bağlantısı kesildi");
        tr.insert("log.price_updated", "Fiyat güncellendi");
        tr.insert("log.order_sent", "Emir borsaya gönderildi");

        translations.insert(Language::Turkish, tr);

        Self {
            current_language: Language::default(),
            translations,
        }
    }

    /// Dili değiştir
    pub fn set_language(&mut self, language: Language) {
        self.current_language = language;
    }

    /// Mevcut dili al
    pub fn current_language(&self) -> Language {
        self.current_language
    }

    /// Çeviri al
    pub fn get<'a>(&'a self, key: &'a str) -> &'a str {
        self.translations
            .get(&self.current_language)
            .and_then(|lang| lang.get(key))
            .copied()
            .or_else(|| {
                // Fallback to English
                self.translations
                    .get(&Language::English)
                    .and_then(|lang| lang.get(key))
                    .copied()
            })
            .unwrap_or(key) // Return key if not found
    }

    /// Parametreli çeviri al
    pub fn get_with_params(&self, key: &str, params: &[(&str, &str)]) -> String {
        let mut result = self.get(key).to_string();
        for (param_key, param_value) in params {
            result = result.replace(&format!("{{{}}}", param_key), param_value);
        }
        result
    }
}

impl Default for Translations {
    fn default() -> Self {
        Self::new()
    }
}

/// Global çeviri instance'ı için lazy static
use std::sync::OnceLock;
use std::sync::RwLock;

static TRANSLATIONS: OnceLock<RwLock<Translations>> = OnceLock::new();

/// Global çeviri al
pub fn t(key: &str) -> String {
    TRANSLATIONS
        .get_or_init(|| RwLock::new(Translations::new()))
        .read()
        .unwrap()
        .get(key)
        .to_string()
}

/// Global dil değiştir
pub fn set_language(language: Language) {
    if let Some(translations) = TRANSLATIONS.get() {
        translations.write().unwrap().set_language(language);
    }
}

/// Mevcut dili al
pub fn current_language() -> Language {
    TRANSLATIONS
        .get_or_init(|| RwLock::new(Translations::new()))
        .read()
        .unwrap()
        .current_language()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_translations() {
        let mut translations = Translations::new();

        // Test English
        assert_eq!(translations.get("app.name"), "AlgoTrade OS");
        assert_eq!(translations.get("error.general"), "An error occurred");

        // Test Turkish
        translations.set_language(Language::Turkish);
        assert_eq!(translations.get("app.name"), "AlgoTrade OS");
        assert_eq!(translations.get("error.general"), "Bir hata oluştu");

        // Test fallback
        assert_eq!(translations.get("unknown.key"), "unknown.key");
    }

    #[test]
    fn test_language_code() {
        assert_eq!(Language::from_code("en"), Some(Language::English));
        assert_eq!(Language::from_code("tr"), Some(Language::Turkish));
        assert_eq!(Language::from_code("tr-TR"), Some(Language::Turkish));
        assert_eq!(Language::from_code("xx"), None);
    }
}
