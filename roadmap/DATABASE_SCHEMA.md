# Veritabanı Şeması (SQLite & In-Memory)

Uygulamanın hafızası iki katmanlıdır: Kalıcı (SQLite) ve Anlık (In-Memory).

## 1. SQLite (Kalıcı Veriler)
- **Table: `secure_vault`**: Şifrelenmiş API Key ve Secretlar.
- **Table: `user_settings`**: Tema tercihleri, varsayılan risk yüzdesi.
- **Table: `trade_logs`**: Geçmiş işlemler, kar/zarar oranları.

## 2. In-Memory (Hızlı Erişim - Rust Map/Vec)
- **Live Prices**: En son gelen fiyat verileri.
- **Active Alarms**: Fiyatın çarpması beklenen seviyeler (VWAP, VAL/VAH).
- **Module State**: Hangi modülün (tool) o an aktif veya pasif olduğu bilgisi.