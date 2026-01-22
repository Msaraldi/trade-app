# Rust Core & Modül Mantığı

Sistemin kalbi, modülleri birer "Plugin" gibi çalıştıran yapıdır.

## Modül Trait Yapısı (Plugin Interface)
Her yeni özellik şu standart yapıyı izler:
- `on_price_tick()`: Fiyat değişimlerini dinle.
- `on_balance_change()`: Cüzdan değişimlerini izle.
- `authorize()`: Kullanıcıdan işlem yetkisi iste.

## Otomasyon Fonksiyonları
- **Batch Ordering:** `tokio::spawn` ile çoklu asenkron emir gönderimi.
- **Auto-Breakeven:** Fiyat `Entry + 1R` olduğunda stop emrini güncelleme döngüsü.