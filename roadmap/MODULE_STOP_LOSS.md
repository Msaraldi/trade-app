# Özellik: Akıllı Stop-Loss & Risk Yönetimi

Bu dosya, uygulamaya bir "app" gibi eklenecek olan Stop-Loss modülünün tanımıdır.

## Yetenekler
- **Dynamic Calculation:** Giriş fiyatı ve belirlenen % risk oranına göre Lot büyüklüğünü belirleme.
- **Auto-Move:** Kâr miktarı arttıkça stopu otomatik olarak girişe (Breakeven) taşıma.
- **Multi-Asset Sync:** BTC, ETH ve SOL gibi yüksek hacimli varlıklarda aynı risk parametreleriyle toplu işlem başlatma.

## Tetikleyiciler
- **Price > Target:** Stop'u girişe çek.
- **Price < Stop:** Pozisyonu kapat ve bekleyen kâr al emirlerini iptal et.