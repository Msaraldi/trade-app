# Özellik: Toplu İşlem ve Hacim Grubu Yönetimi

Bu araç, yüksek hacimli paritelerde (Basket Trading) saniyeler içinde işlem yapmayı sağlar.

## Kullanım Senaryosu
- Kullanıcı bir "Varlık Grubu" oluşturur (Örn: BTC, ETH, SOL, ARB).
- "Buy Group" butonuna bastığında, belirlenen toplam risk bu paritelere hacim ağırlıklı veya eşit olarak dağıtılır.

## Teknik Akış
1. **Validation:** Seçilen tüm paritelerin bakiyeye uygunluğu denetlenir.
2. **Async Execution:** `join_all(orders)` komutu ile tüm emirler borsaya aynı milisaniye içinde gönderilir.
3. **Group Tracking:** Grup içindeki bir parite stop olursa, isteğe bağlı olarak diğerlerini de kapatma (Linked Orders) opsiyonu sunulur.