# Veri Akış ve Dağıtım Motoru (Data Dispatcher)

Bu modül, borsadan (Binance, Bybit vb.) gelen karmaşık WebSocket verilerini temizleyerek yüklü olan tüm "Tool"lara (modüllere) dağıtır.

## 1. WebSocket Manager
- **Multi-Stream:** Aynı anda Price, Orderbook ve User Data streamlerini yönetir.
- **Reconnection Logic:** Bağlantı koptuğunda otomatik olarak (Exponential Backoff ile) yeniden bağlanır.

## 2. Event Dispatcher (Olay Dağıtıcı)
- Rust'ın `tokio::sync::broadcast` kanalını kullanarak gelen veriyi modüllere yayınlar (Pub/Sub).
- Örnek: Fiyat değiştiğinde `PriceUpdated` olayı fırlatılır; hem VWAP modülü hem de Stop-Loss modülü bu veriyi eş zamanlı alır.

## 3. Normalization (Standardizasyon)
- Farklı borsalardan gelen farklı JSON formatları, uygulamanın anlayacağı tek bir `StandardTick` struct'ına dönüştürülür.