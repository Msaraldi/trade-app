# Alarm ve Bildirim Sistemi

Modüllerin kullanıcıyı uyarması için kullanılan merkezi sistemdir.

## Bildirim Tipleri
- **Visual:** Arayüzde parlayan uyarılar veya sesli sinyaller.
- **OS Native:** Tauri üzerinden Windows/macOS/Linux yerel bildirimleri.
- **Webhook:** (Opsiyonel) Telegram veya Discord üzerinden bilgilendirme.

## Alarm Koşulları
- **Price-Based:** Fiyat VAL veya VAH seviyesine dokunduğunda.
- **Condition-Based:** "VWAP altında 5 dakikalık mum kapandığında" gibi karmaşık mantıklar.