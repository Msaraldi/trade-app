# Proje Yapısı: AlgoTrade OS

Bu belge, Tauri ve Rust tabanlı modüler işlem platformunun genel mimarisini tanımlar.

## Mimari Katmanlar
1. **Frontend (UI):** React + Tailwind CSS. Kullanıcı arayüzü "Widget" tabanlıdır.
2. **Tauri Bridge:** Frontend ile Rust backend arasındaki güvenli iletişim köprüsü.
3. **Core (Kernel):** Rust ile yazılmış, borsa verilerini ve modülleri yöneten ana motor.
4. **Plugin System:** Stop-loss, VWAP gibi özelliklerin çalışma mantığı.

## Klasör Organizasyonu
- `/src`: React arayüz kodları ve Widget bileşenleri.
- `/src-tauri/src/core`: Borsa bağlantıları ve veri dağıtıcı (Dispatcher).
- `/src-tauri/src/modules`: Yüklenebilir araçlar (Stop-Loss, Risk Engine vb.).
- `/src-tauri/src/security`: Şifreleme ve Vault mekanizması.