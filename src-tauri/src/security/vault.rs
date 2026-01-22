// AlgoTrade OS - Secure Vault
// AES-256-GCM ile şifrelenmiş API anahtar yönetimi

use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use rand::Rng;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Şifrelenmiş API bilgisi
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptedCredential {
    /// Şifrelenmiş veri (base64)
    pub encrypted_data: Vec<u8>,
    /// Nonce (IV)
    pub nonce: [u8; 12],
}

/// Güvenli kasa - API anahtarlarını saklar
pub struct SecureVault {
    /// Şifreleme anahtarı (32 bytes = 256 bit)
    key: [u8; 32],
    /// Saklanan kimlik bilgileri
    credentials: HashMap<String, EncryptedCredential>,
}

impl SecureVault {
    /// Yeni vault oluştur
    pub fn new(key: [u8; 32]) -> Self {
        Self {
            key,
            credentials: HashMap::new(),
        }
    }

    /// Rastgele anahtar oluştur
    pub fn generate_key() -> [u8; 32] {
        let mut key = [0u8; 32];
        rand::thread_rng().fill(&mut key);
        key
    }

    /// Veriyi şifrele ve sakla
    pub fn store(&mut self, id: &str, data: &str) -> Result<(), VaultError> {
        let cipher = Aes256Gcm::new_from_slice(&self.key)
            .map_err(|_| VaultError::EncryptionFailed("Invalid key".into()))?;

        // Rastgele nonce oluştur
        let mut nonce_bytes = [0u8; 12];
        rand::thread_rng().fill(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);

        // Şifrele
        let encrypted_data = cipher
            .encrypt(nonce, data.as_bytes())
            .map_err(|_| VaultError::EncryptionFailed("Encryption failed".into()))?;

        self.credentials.insert(
            id.to_string(),
            EncryptedCredential {
                encrypted_data,
                nonce: nonce_bytes,
            },
        );

        Ok(())
    }

    /// Saklanan veriyi çöz
    pub fn retrieve(&self, id: &str) -> Result<String, VaultError> {
        let cred = self
            .credentials
            .get(id)
            .ok_or(VaultError::NotFound(id.to_string()))?;

        let cipher = Aes256Gcm::new_from_slice(&self.key)
            .map_err(|_| VaultError::DecryptionFailed("Invalid key".into()))?;

        let nonce = Nonce::from_slice(&cred.nonce);

        let decrypted = cipher
            .decrypt(nonce, cred.encrypted_data.as_ref())
            .map_err(|_| VaultError::DecryptionFailed("Decryption failed".into()))?;

        String::from_utf8(decrypted)
            .map_err(|_| VaultError::DecryptionFailed("Invalid UTF-8".into()))
    }

    /// Kimlik bilgisini sil
    pub fn remove(&mut self, id: &str) -> bool {
        self.credentials.remove(id).is_some()
    }

    /// Tüm kimlik bilgisi ID'lerini listele
    pub fn list_ids(&self) -> Vec<String> {
        self.credentials.keys().cloned().collect()
    }

    /// Vault'u temizle (tüm verileri sil)
    pub fn clear(&mut self) {
        self.credentials.clear();
    }
}

/// Vault hataları
#[derive(Debug, Clone)]
pub enum VaultError {
    EncryptionFailed(String),
    DecryptionFailed(String),
    NotFound(String),
    StorageError(String),
}

impl std::fmt::Display for VaultError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            VaultError::EncryptionFailed(msg) => write!(f, "Encryption failed: {}", msg),
            VaultError::DecryptionFailed(msg) => write!(f, "Decryption failed: {}", msg),
            VaultError::NotFound(id) => write!(f, "Credential not found: {}", id),
            VaultError::StorageError(msg) => write!(f, "Storage error: {}", msg),
        }
    }
}

impl std::error::Error for VaultError {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_store_and_retrieve() {
        let key = SecureVault::generate_key();
        let mut vault = SecureVault::new(key);

        vault.store("binance_api_key", "my_secret_api_key").unwrap();
        let retrieved = vault.retrieve("binance_api_key").unwrap();

        assert_eq!(retrieved, "my_secret_api_key");
    }

    #[test]
    fn test_not_found() {
        let key = SecureVault::generate_key();
        let vault = SecureVault::new(key);

        let result = vault.retrieve("nonexistent");
        assert!(matches!(result, Err(VaultError::NotFound(_))));
    }

    #[test]
    fn test_remove() {
        let key = SecureVault::generate_key();
        let mut vault = SecureVault::new(key);

        vault.store("test_key", "test_value").unwrap();
        assert!(vault.remove("test_key"));
        assert!(!vault.remove("test_key")); // İkinci silme false döner
    }
}
