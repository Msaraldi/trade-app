# Risk Yönetimi ve Hesaplama Servisi

Bu servis, işlem açılmadan önceki "son onay" merciidir. Uygulamanın en güvenli bölgesidir.

## 1. Cumulative Risk Calculation
- **Global Exposure:** O an açık olan tüm işlemlerin toplam riskini hesaplar. 
- **Margin Check:** Yeni bir işlem açılmadan önce "Kümülatif bakiyenin %X'i aşıldı mı?" kontrolü yapar.

## 2. Dynamic Position Sizer
- Kullanıcı sadece "Ben bu işlemde 100$ kaybetmeyi göze alıyorum" der.
- Servis; `(Giriş Fiyatı - Stop Fiyatı)` farkına bakarak kaç adet (lot) alınması gerektiğini anlık hesaplar.

## 3. Limitler (Guardrails)
- Kullanıcının önceden belirlediği "Günlük Max Zarar" limitine ulaşıldığında, sistem yeni işlem açılmasını modül bazında engeller.