// AlgoTrade OS - Bybit Exchange Client
// Bybit REST API ve WebSocket bağlantısı
// Spot, Linear Perpetual ve Inverse Perpetual desteği

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use chrono::Utc;
use sha2::Sha256;
use hmac::{Hmac, Mac};

type HmacSha256 = Hmac<Sha256>;

// Primary: bytick.com (works in Turkey and other restricted regions)
// Fallback: bybit.com
const BYBIT_REST_URL: &str = "https://api.bytick.com";
const BYBIT_TESTNET_REST_URL: &str = "https://api-testnet.bybit.com";
pub const BYBIT_WS_URL: &str = "wss://stream.bytick.com/v5/public/linear";
pub const BYBIT_WS_PRIVATE_URL: &str = "wss://stream.bytick.com/v5/private";
pub const BYBIT_TESTNET_WS_URL: &str = "wss://stream-testnet.bybit.com/v5/public/linear";

/// Market kategorisi
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum MarketCategory {
    Spot,
    Linear,   // USDT Perpetual
    Inverse,  // Coin-margined
}

impl MarketCategory {
    pub fn as_str(&self) -> &'static str {
        match self {
            MarketCategory::Spot => "spot",
            MarketCategory::Linear => "linear",
            MarketCategory::Inverse => "inverse",
        }
    }
}

impl Default for MarketCategory {
    fn default() -> Self {
        MarketCategory::Linear
    }
}

/// Bybit API istemcisi
#[derive(Clone)]
pub struct BybitClient {
    api_key: String,
    api_secret: String,
    testnet: bool,
    client: reqwest::Client,
}

impl BybitClient {
    pub fn new(api_key: String, api_secret: String, testnet: bool) -> Self {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");

        Self {
            api_key,
            api_secret,
            testnet,
            client,
        }
    }

    fn base_url(&self) -> &str {
        if self.testnet {
            BYBIT_TESTNET_REST_URL
        } else {
            BYBIT_REST_URL
        }
    }

    /// İmza oluştur (HMAC-SHA256)
    fn sign(&self, params: &str, timestamp: i64, recv_window: i64) -> String {
        let sign_str = format!("{}{}{}{}", timestamp, self.api_key, recv_window, params);

        let mut mac = HmacSha256::new_from_slice(self.api_secret.as_bytes())
            .expect("HMAC can take key of any size");
        mac.update(sign_str.as_bytes());

        hex::encode(mac.finalize().into_bytes())
    }

    /// API isteği için header'ları oluştur
    fn auth_headers(&self, params: &str) -> HashMap<String, String> {
        let timestamp = Utc::now().timestamp_millis();
        let recv_window: i64 = 5000;
        let signature = self.sign(params, timestamp, recv_window);

        let mut headers = HashMap::new();
        headers.insert("X-BAPI-API-KEY".to_string(), self.api_key.clone());
        headers.insert("X-BAPI-SIGN".to_string(), signature);
        headers.insert("X-BAPI-TIMESTAMP".to_string(), timestamp.to_string());
        headers.insert("X-BAPI-RECV-WINDOW".to_string(), recv_window.to_string());
        headers.insert("Content-Type".to_string(), "application/json".to_string());
        headers
    }

    /// Cüzdan bakiyesini al
    pub async fn get_wallet_balance(&self) -> Result<WalletBalance, BybitError> {
        let endpoint = "/v5/account/wallet-balance";
        let params = "accountType=UNIFIED";
        let url = format!("{}{}?{}", self.base_url(), endpoint, params);

        let headers = self.auth_headers(params);

        let mut request = self.client.get(&url);

        for (key, value) in headers {
            request = request.header(&key, value);
        }

        let response = request.send().await
            .map_err(|e| BybitError::NetworkError(e.to_string()))?;

        let body = response.text().await
            .map_err(|e| BybitError::NetworkError(e.to_string()))?;

        let result: BybitResponse<WalletBalanceResult> = serde_json::from_str(&body)
            .map_err(|e| BybitError::ParseError(format!("{}: {}", e, body)))?;

        if result.ret_code != 0 {
            return Err(BybitError::ApiError(result.ret_msg));
        }

        result.result
            .and_then(|r| r.list.into_iter().next())
            .and_then(|account| {
                let total_equity: f64 = account.coin.iter()
                    .filter_map(|c| c.equity.parse::<f64>().ok())
                    .sum();
                let available: f64 = account.coin.iter()
                    .filter_map(|c| c.available_to_withdraw.parse::<f64>().ok())
                    .sum();

                Some(WalletBalance {
                    total_equity,
                    available_balance: available,
                    coins: account.coin.into_iter().map(|c| CoinBalance {
                        coin: c.coin,
                        equity: c.equity.parse().unwrap_or(0.0),
                        available: c.available_to_withdraw.parse().unwrap_or(0.0),
                        unrealized_pnl: c.unrealised_pnl.parse().unwrap_or(0.0),
                    }).collect(),
                })
            })
            .ok_or(BybitError::ParseError("No balance data".to_string()))
    }

    /// Ticker bilgisini al (fiyat) - kategori destekli
    pub async fn get_ticker(&self, symbol: &str, category: MarketCategory) -> Result<TickerInfo, BybitError> {
        let endpoint = "/v5/market/tickers";
        let params = format!("category={}&symbol={}", category.as_str(), symbol);
        let url = format!("{}{}?{}", self.base_url(), endpoint, params);

        let response = self.client.get(&url).send().await
            .map_err(|e| BybitError::NetworkError(e.to_string()))?;

        let body = response.text().await
            .map_err(|e| BybitError::NetworkError(e.to_string()))?;

        let result: BybitResponse<TickerResult> = serde_json::from_str(&body)
            .map_err(|e| BybitError::ParseError(format!("{}: {}", e, body)))?;

        if result.ret_code != 0 {
            return Err(BybitError::ApiError(result.ret_msg));
        }

        result.result
            .and_then(|r| r.list.into_iter().next())
            .map(|t| TickerInfo {
                symbol: t.symbol,
                last_price: t.last_price.parse().unwrap_or(0.0),
                price_24h_pcnt: t.price_24h_pcnt.parse().unwrap_or(0.0),
                high_price_24h: t.high_price_24h.parse().unwrap_or(0.0),
                low_price_24h: t.low_price_24h.parse().unwrap_or(0.0),
                volume_24h: t.volume_24h.parse().unwrap_or(0.0),
                turnover_24h: t.turnover_24h.parse().unwrap_or(0.0),
                category,
                max_leverage: 0.0, // Will be enriched later if needed
            })
            .ok_or(BybitError::ParseError("No ticker data".to_string()))
    }

    /// Tüm ticker'ları al - kategori destekli
    pub async fn get_all_tickers(&self, category: MarketCategory) -> Result<Vec<TickerInfo>, BybitError> {
        let endpoint = "/v5/market/tickers";
        let params = format!("category={}", category.as_str());
        let url = format!("{}{}?{}", self.base_url(), endpoint, params);

        let response = self.client.get(&url).send().await
            .map_err(|e| BybitError::NetworkError(e.to_string()))?;

        let body = response.text().await
            .map_err(|e| BybitError::NetworkError(e.to_string()))?;

        let result: BybitResponse<TickerResult> = serde_json::from_str(&body)
            .map_err(|e| BybitError::ParseError(format!("{}: {}", e, body)))?;

        if result.ret_code != 0 {
            return Err(BybitError::ApiError(result.ret_msg));
        }

        Ok(result.result
            .map(|r| r.list.into_iter().map(|t| TickerInfo {
                symbol: t.symbol,
                last_price: t.last_price.parse().unwrap_or(0.0),
                price_24h_pcnt: t.price_24h_pcnt.parse().unwrap_or(0.0),
                high_price_24h: t.high_price_24h.parse().unwrap_or(0.0),
                low_price_24h: t.low_price_24h.parse().unwrap_or(0.0),
                volume_24h: t.volume_24h.parse().unwrap_or(0.0),
                turnover_24h: t.turnover_24h.parse().unwrap_or(0.0),
                category,
                max_leverage: 0.0,
            }).collect())
            .unwrap_or_default())
    }

    /// Tüm ticker'ları leverage ile birlikte al
    pub async fn get_all_tickers_with_leverage(&self, category: MarketCategory) -> Result<Vec<TickerInfo>, BybitError> {
        // Paralel olarak ticker ve instrument verilerini çek
        let (tickers_result, instruments_result) = tokio::join!(
            self.get_all_tickers(category),
            self.get_instruments(category)
        );

        let mut tickers = tickers_result?;
        let instruments = instruments_result.unwrap_or_default();

        // Instrument'lardan leverage bilgisini al ve ticker'lara ekle
        let leverage_map: std::collections::HashMap<String, f64> = instruments
            .into_iter()
            .map(|i| (i.symbol, i.max_leverage))
            .collect();

        for ticker in &mut tickers {
            if let Some(&leverage) = leverage_map.get(&ticker.symbol) {
                ticker.max_leverage = leverage;
            }
        }

        Ok(tickers)
    }

    /// Tüm sembolleri al - kategori destekli
    pub async fn get_instruments(&self, category: MarketCategory) -> Result<Vec<InstrumentInfo>, BybitError> {
        let endpoint = "/v5/market/instruments-info";
        let params = format!("category={}&limit=500", category.as_str());
        let url = format!("{}{}?{}", self.base_url(), endpoint, params);

        let response = self.client.get(&url).send().await
            .map_err(|e| BybitError::NetworkError(e.to_string()))?;

        let body = response.text().await
            .map_err(|e| BybitError::NetworkError(e.to_string()))?;

        let result: BybitResponse<InstrumentsResult> = serde_json::from_str(&body)
            .map_err(|e| BybitError::ParseError(format!("{}: {}", e, body)))?;

        if result.ret_code != 0 {
            return Err(BybitError::ApiError(result.ret_msg));
        }

        Ok(result.result
            .map(|r| r.list.into_iter().map(|i| {
                let max_leverage = i.leverage_filter
                    .as_ref()
                    .and_then(|lf| lf.max_leverage.parse::<f64>().ok())
                    .unwrap_or(1.0);
                InstrumentInfo {
                    symbol: i.symbol,
                    base_coin: i.base_coin,
                    quote_coin: i.quote_coin,
                    status: i.status,
                    category,
                    max_leverage,
                }
            }).collect())
            .unwrap_or_default())
    }

    /// Tüm kategorilerden sembolleri al
    pub async fn get_all_instruments(&self) -> Result<AllInstruments, BybitError> {
        let (spot, linear, inverse) = tokio::join!(
            self.get_instruments(MarketCategory::Spot),
            self.get_instruments(MarketCategory::Linear),
            self.get_instruments(MarketCategory::Inverse)
        );

        Ok(AllInstruments {
            spot: spot.unwrap_or_default(),
            linear: linear.unwrap_or_default(),
            inverse: inverse.unwrap_or_default(),
        })
    }

    /// Kline (mum) verilerini al - kategori destekli
    pub async fn get_klines(&self, symbol: &str, category: MarketCategory, interval: &str, limit: u32) -> Result<Vec<Kline>, BybitError> {
        let endpoint = "/v5/market/kline";
        let params = format!("category={}&symbol={}&interval={}&limit={}", category.as_str(), symbol, interval, limit);
        let url = format!("{}{}?{}", self.base_url(), endpoint, params);

        let response = self.client.get(&url).send().await
            .map_err(|e| BybitError::NetworkError(e.to_string()))?;

        let body = response.text().await
            .map_err(|e| BybitError::NetworkError(e.to_string()))?;

        let result: BybitResponse<KlineResult> = serde_json::from_str(&body)
            .map_err(|e| BybitError::ParseError(format!("{}: {}", e, body)))?;

        if result.ret_code != 0 {
            return Err(BybitError::ApiError(result.ret_msg));
        }

        Ok(result.result
            .map(|r| r.list.into_iter().map(|k| Kline {
                timestamp: k.0.parse().unwrap_or(0),
                open: k.1.parse().unwrap_or(0.0),
                high: k.2.parse().unwrap_or(0.0),
                low: k.3.parse().unwrap_or(0.0),
                close: k.4.parse().unwrap_or(0.0),
                volume: k.5.parse().unwrap_or(0.0),
            }).collect())
            .unwrap_or_default())
    }

    /// Tüm tarihsel kline verilerini al (pagination ile, paralel istekler)
    /// start_time: Başlangıç timestamp (milisaniye), None ise en eskiden başlar
    /// end_time: Bitiş timestamp (milisaniye), None ise şimdiye kadar
    pub async fn get_all_klines(
        &self,
        symbol: &str,
        category: MarketCategory,
        interval: &str,
        start_time: Option<i64>,
        end_time: Option<i64>,
    ) -> Result<Vec<Kline>, BybitError> {
        use futures::future::join_all;

        let current_end = end_time.unwrap_or_else(|| chrono::Utc::now().timestamp_millis());
        let start = start_time.unwrap_or(1583020800000); // Default: 2020-03-01
        let limit = 1000u32;

        // Interval'a göre her mum kaç ms
        let interval_ms: i64 = match interval {
            "1" => 60_000,
            "3" => 180_000,
            "5" => 300_000,
            "15" => 900_000,
            "30" => 1_800_000,
            "60" => 3_600_000,
            "120" => 7_200_000,
            "240" => 14_400_000,
            "360" => 21_600_000,
            "720" => 43_200_000,
            "D" | "d" => 86_400_000,
            "W" | "w" => 604_800_000,
            "M" | "m" => 2_592_000_000,
            _ => 900_000, // default 15m
        };

        // Her batch 1000 mum kapsar
        let batch_duration = interval_ms * 1000;

        // Kaç batch gerekli hesapla
        let total_duration = current_end - start;
        let num_batches = ((total_duration as f64) / (batch_duration as f64)).ceil() as usize;
        let num_batches = num_batches.min(20); // Maksimum 20 paralel istek (20,000 mum)

        // Paralel istekler için time range'leri oluştur
        let mut batch_ranges: Vec<(i64, i64)> = Vec::new();
        let mut batch_end = current_end;

        for _ in 0..num_batches {
            let batch_start = (batch_end - batch_duration).max(start);
            batch_ranges.push((batch_start, batch_end));
            batch_end = batch_start - 1;
            if batch_end <= start {
                break;
            }
        }

        // 5'li gruplar halinde paralel istek at (rate limiting için)
        let mut all_klines: Vec<Kline> = Vec::new();

        for chunk in batch_ranges.chunks(5) {
            let futures: Vec<_> = chunk.iter().map(|&(_start_ts, end_ts)| {
                let url = format!(
                    "{}{}?category={}&symbol={}&interval={}&limit={}&end={}",
                    self.base_url(),
                    "/v5/market/kline",
                    category.as_str(),
                    symbol,
                    interval,
                    limit,
                    end_ts
                );
                self.client.get(&url).send()
            }).collect();

            let results = join_all(futures).await;

            for result in results {
                if let Ok(response) = result {
                    if let Ok(body) = response.text().await {
                        if let Ok(result) = serde_json::from_str::<BybitResponse<KlineResult>>(&body) {
                            if result.ret_code == 0 {
                                if let Some(r) = result.result {
                                    let klines: Vec<Kline> = r.list.into_iter().map(|k| Kline {
                                        timestamp: k.0.parse().unwrap_or(0),
                                        open: k.1.parse().unwrap_or(0.0),
                                        high: k.2.parse().unwrap_or(0.0),
                                        low: k.3.parse().unwrap_or(0.0),
                                        close: k.4.parse().unwrap_or(0.0),
                                        volume: k.5.parse().unwrap_or(0.0),
                                    }).collect();
                                    all_klines.extend(klines);
                                }
                            }
                        }
                    }
                }
            }

            // Gruplar arası kısa bekleme (rate limiting)
            tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;
        }

        // start_time filtresi uygula
        if let Some(start_ts) = start_time {
            all_klines.retain(|k| k.timestamp >= start_ts);
        }

        // Timestamp'e göre sırala (eskiden yeniye)
        all_klines.sort_by_key(|k| k.timestamp);

        // Duplikatları kaldır
        all_klines.dedup_by_key(|k| k.timestamp);

        Ok(all_klines)
    }

    /// Bağlantı testi
    pub async fn test_connection(&self) -> Result<bool, BybitError> {
        let endpoint = "/v5/market/time";
        let url = format!("{}{}", self.base_url(), endpoint);

        let response = self.client.get(&url).send().await
            .map_err(|e| BybitError::NetworkError(e.to_string()))?;

        Ok(response.status().is_success())
    }
}

// ==================== Response Types ====================

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BybitResponse<T> {
    ret_code: i32,
    ret_msg: String,
    result: Option<T>,
}

#[derive(Debug, Deserialize)]
struct WalletBalanceResult {
    list: Vec<AccountInfo>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AccountInfo {
    coin: Vec<CoinInfo>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CoinInfo {
    coin: String,
    equity: String,
    available_to_withdraw: String,
    #[serde(default)]
    unrealised_pnl: String,
}

#[derive(Debug, Deserialize)]
struct TickerResult {
    list: Vec<TickerData>,
}

#[derive(Debug, Deserialize)]
struct TickerData {
    symbol: String,
    #[serde(rename = "lastPrice")]
    last_price: String,
    #[serde(rename = "price24hPcnt", default)]
    price_24h_pcnt: String,
    #[serde(rename = "highPrice24h", default)]
    high_price_24h: String,
    #[serde(rename = "lowPrice24h", default)]
    low_price_24h: String,
    #[serde(rename = "volume24h", default)]
    volume_24h: String,
    #[serde(rename = "turnover24h", default)]
    turnover_24h: String,
}

#[derive(Debug, Deserialize)]
struct InstrumentsResult {
    list: Vec<InstrumentData>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct InstrumentData {
    symbol: String,
    #[serde(default)]
    base_coin: String,
    #[serde(default)]
    quote_coin: String,
    status: String,
    #[serde(default)]
    leverage_filter: Option<LeverageFilter>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LeverageFilter {
    #[serde(default)]
    max_leverage: String,
    #[serde(default)]
    min_leverage: String,
}

#[derive(Debug, Deserialize)]
struct KlineResult {
    list: Vec<(String, String, String, String, String, String, String)>,
}

// ==================== Public Types ====================

#[derive(Debug, Clone, Serialize)]
pub struct WalletBalance {
    pub total_equity: f64,
    pub available_balance: f64,
    pub coins: Vec<CoinBalance>,
}

#[derive(Debug, Clone, Serialize)]
pub struct CoinBalance {
    pub coin: String,
    pub equity: f64,
    pub available: f64,
    pub unrealized_pnl: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct TickerInfo {
    pub symbol: String,
    pub last_price: f64,
    pub price_24h_pcnt: f64,
    pub high_price_24h: f64,
    pub low_price_24h: f64,
    pub volume_24h: f64,
    pub turnover_24h: f64,
    pub category: MarketCategory,
    #[serde(default)]
    pub max_leverage: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct InstrumentInfo {
    pub symbol: String,
    pub base_coin: String,
    pub quote_coin: String,
    pub status: String,
    pub category: MarketCategory,
    pub max_leverage: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct AllInstruments {
    pub spot: Vec<InstrumentInfo>,
    pub linear: Vec<InstrumentInfo>,
    pub inverse: Vec<InstrumentInfo>,
}

#[derive(Debug, Clone, Serialize)]
pub struct Kline {
    pub timestamp: i64,
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub volume: f64,
}

// ==================== Errors ====================

#[derive(Debug, Clone)]
pub enum BybitError {
    NetworkError(String),
    ApiError(String),
    ParseError(String),
    AuthError(String),
}

impl std::fmt::Display for BybitError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            BybitError::NetworkError(msg) => write!(f, "Network error: {}", msg),
            BybitError::ApiError(msg) => write!(f, "API error: {}", msg),
            BybitError::ParseError(msg) => write!(f, "Parse error: {}", msg),
            BybitError::AuthError(msg) => write!(f, "Auth error: {}", msg),
        }
    }
}

impl std::error::Error for BybitError {}
