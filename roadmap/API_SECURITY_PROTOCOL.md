# Güvenlik Protokolleri ve API Yönetimi

Kullanıcı güvenliği en yüksek önceliktir. Veriler asla dış sunucuya gönderilmez.

## 1. Local Vault (Yerel Kasa)
- API Key ve Secret bilgileri **AES-256-GCM** ile şifrelenir.
- Şifreleme anahtarı, kullanıcının cihazındaki yerel anahtarlıkta (Keychain) saklanır.

## 2. İzole Çalışma (Sandboxing)
- Modüller sadece kendilerine verilen izinler dahilinde API'ye erişebilir.
- Bir "Analiz Modülü" (örneğin sadece grafik çizen) asla "İşlem Yetkisi"ne sahip olamaz.

## 3. Global Kill-Switch
- Uygulama kapatıldığında veya acil durumda tüm API bağlantılarını kesen ana anahtar.