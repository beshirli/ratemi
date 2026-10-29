# Ratemi (web)

Ödeme planı, teklifin gerçek oranı (IRR) ve değer çevirici. Ratemi Android uygulamasının telefon ve bilgisayarda çalışan web sürümü.

- **Ödeme Planı Oluştur:** konut / taşıt / ihtiyaç, peşin iskonto, peşinat, ara ödemeler, ödemesiz dönem, vade farkı oranı.
- **Plan tablosu:** maliyet oranı ve NBD, satır düzenleme (tutar, ödeme günü, kilit, kapsam), blok taksit, hedef maliyet, geri al.
- **Şablonlar:** planı şablon olarak sakla; yeni liste fiyatıyla aynı maliyet oranında plan.
- **Teklifin gerçek oranı:** Newton-Raphson ile aylık ve yıllık IRR.
- **Değer çevirici:** tek tutar ya da ödeme dizisi, bugün ↔ gelecek.
- **PDF:** tarayıcının yazdırma penceresinden "PDF olarak kaydet".

Hesaplar cihazda yapılır; kayıtlar yalnız tarayıcının yerel deposunda tutulur, internete veri gönderilmez. Ayarlar › Yedek ile kayıtlar dosyaya alınıp başka cihaza taşınabilir. Telefonda "Ana ekrana ekle" ile uygulama gibi açılır ve internetsiz de çalışır.

## Geliştirme

Derleme adımı yok; düz HTML, CSS ve JavaScript (Preact + htm, `vendor/`).

```bash
python -m http.server 8321      # http://localhost:8321
node test/finance.test.mjs      # finans motoru testleri
```

Yeni sürüm yayınlarken `sw.js` içindeki `VERSION` değerini artır ki telefonlardaki önbellek yenilensin.
