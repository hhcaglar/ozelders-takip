# ozelders-takip — Net · Kazanım · Rehberlik Paneli

Okulizyon'daki öğrenci karne/optik sonuçlarını çekip **netleri hesaplayan**, **kural tabanlı yorum üreten**,
**MEB kazanımlarıyla kıyaslayan** ve **haftalık çalışma programı kuran** bir özel ders takip paneli.

```bash
npm install
npm run seed     # iki örnek öğrenci + 8 sınav + hazır program
npm run dev      # http://localhost:3000
```

## Veri akışı

```
Okulizyon (HTTP adaptörü / demo / CSV-JSON içe aktarma)
        │  karne normalizasyonu + ders adı çözümü + kazanım eşleştirme
        ▼
Sinav { bolumler[], sorular[{no, ders, kazanimId, dogru, isaretlendi}] }
        │  net hesabı (TYT/AYT 4 yanlış, LGS 3 yanlış) + kazanım ustalığı
        ▼
SinavAnalizi + KazanimDurumu[] (öncelik skoru ile sıralı)
        │  eşik kuralları                          │  hedef net ↔ puan dönüşümü
        ▼                                          ▼
YorumBlogu[] (gerekçeli Türkçe metin)      RehberlikSonucu (açık, öneri, risk)
        └───────────────┬──────────────────────────┘
                        ▼
        CalismaProgrami (konu / test / tekrar / deneme / yanlış analizi blokları)
```

## Modüller

| Yol | Görev |
| --- | --- |
| `lib/data/dersler.ts` | ÖSYM/MEB sınav yerleşimine göre ders kartları, soru sayıları, net böleni |
| `lib/data/kazanimlar.ts` | MEB müfredatından derlenmiş kazanım kataloğu (TYT 100 + AYT 118 + LGS 80 = 298 kazanım) |
| `lib/okulizyon/parse.ts` | Karne normalizasyonu, serbest metin ders adı çözümü, bulanık kazanım eşleştirme |
| `lib/okulizyon/http.ts` | Gerçek Okulizyon istemcisi (yapılandırılabilir uç noktalar) |
| `lib/okulizyon/demo.ts` | Deterministik örnek karne üreticisi |
| `lib/okulizyon/import.ts` | CSV / JSON manuel içe aktarma |
| `lib/analysis.ts` | Net, verim, yanlış/boş oranı, kazanım ustalığı, trend |
| `lib/yorum.ts` | Kural tabanlı yorum üreticisi |
| `lib/rehberlik-core.ts` | Net ↔ puan eğrileri, hedef kıyası, ders bazlı hedef dağıtımı |
| `lib/rehberlik.ts` | Rehberlik raporu: öneri, risk, öncelik sırası, tekrar listesi |
| `lib/plan.ts` | Çalışma programı üreticisi + ICS takvim çıktısı |
| `lib/db.ts` | Dosya tabanlı kalıcılık (atomik yazım, `data/` dizini) |

## Öne çıkan hesaplar

**Net.** `net = doğru − yanlış / bölen`. Bölen TYT ve AYT için 4, LGS için 3
(yayınevi karşılaştırma raporlarının kullandığı pratik; MEB resmî LGS hesabında doğru götürülmez).

**Kazanım ustalığı.** `doğru / (doğru + yanlış + boş)` — boş bırakılan soru da öğrenme eksiği sayılır.
Birden çok sınav birleştirilirken yakın tarihli sınavlar üstel olarak daha ağır basar (yarılanma ≈ 3 sınav).

**Öncelik skoru.** `ağırlık × (1 − ustalık) × ln(1 + ölçüm sayısı)`.
Müfredatta merkezi ama sık ölçülmemiş bir kazanım, önemsiz ama çok yanlış yapılan bir kazanımın önüne geçmez.

**Çalışma programı.** Kazanımlar öncelik skoruna göre kuyruğa alınır; ders payı zayıf derse daha çok verilir.
Her kazanım için *konu → test* ikilisi planlanır, testin ardından aralıklı tekrar vadeleri kurulur
(kritik kazanımlar 1-3-7 gün, geliştirilecekler 3-7). Haftada bir genel deneme ve bir yanlış-analizi yuvası
rezerve edilir; tekrar blokları toplamın %25'ini geçemez.

## Okulizyon bağlantısı — bilmen gerekenler

Okulizyon'un **kamuya açık, belgelenmiş bir REST API'si yoktur**; platform mobil uygulama ve
`okulizyon.com` öğrenci girişi üstünden çalışır.

**Doğrulananlar** (`okulizyon.com` erişilerek teyit edildi, varsayılan olarak dolu gelir):

| | |
| --- | --- |
| Taban adres | `https://okulizyon.com` (ana site `/app/index.php`) |
| Öğrenci girişi | `/app2/ogrgiris` · öğretmen girişi `/app2/giris` |
| Kimlik sekmeleri | Öğrenci No / T.C. Kimlik No / Telefon — üçü de destekleniyor |
| Form alanları | sınıf, il, ilçe, kurum, şifre |
| Kurum kodu | giriş adresinde `?kk=…` parametresi gözlemlendi |
| Alternatif barındırma | `okulizyon.karnemiz.com/<eğitim-yılı>/ogrenci/` (OrbimSoft) |

**Bilinmeyenler** (uydurulmadı, boş bırakıldı):

- **Giriş ve karne uç noktaları.** Yalnızca oturum açmış bir tarayıcının ağ sekmesinden okunabiliyor.
  `/baglanti` ekranında adım adım tarif var. Boşken istek atılmaz; hata mesajı tarifi gösterir.
- **Karne cevap şeması.** Kurumdan kuruma değişebiliyor. Normalize edici alan adı alternatiflerini
  tolere eder (`dogru/correct`, `bos/empty/blank`, `kazanım/konu/outcome`, …) ama gerçek cevabı ağ
  sekmesinden kopyalayıp örnek şemayla karşılaştırman gerekiyor.
- **Optik sonuç dosyası biçimi.** Okulizyon sonuçları `.TXT` / `.DAT` olarak veriyor; sütun düzeni
  belgelenmemiş. Bu biçim desteklenmiyor — iki CSV şemasından birine dönüştürüp içe aktar.

**Demo mod (varsayılan):** Okulizyon biçiminde örnek karne üretir. Panelin tamamı — normalizasyon,
kazanım eşleştirme, analiz, yorum, program — gerçek kod yolundan geçer.

> Yalnızca kendi/kurumunun hesabı ve kendi öğrencisinin verisi için kullan. Otomatik çekimden önce
> kurumun kullanım koşullarını kontrol et. Şifre diske yazılmaz; yalnızca istek süresince bellekte kalır.

## Yaklaşık olan kısımlar

Net→puan dönüşümü ve sıralama tahmini **yaklaşıktır**. ÖSYM ve MEB gerçek hesaplamada ham puanı
standart puana (T-puan) çevirir; bu dönüşüm sınav popülasyonunun ortalamasına ve standart sapmasına
bağlıdır ve sınavdan önce bilinemez. `lib/rehberlik-core.ts` içindeki eğriler geçmiş yılların tipik
dağılımlarına oturtulmuş monoton, doğrusal-parçalı eğrilerdir ve amaçları "hedefim için kaç net gerekir"
sorusuna yön gösterici bir eşik vermektir. Arayüzde bu uyarı her sayfada görünür.

## Geliştirme

```bash
npm run typecheck   # tsc --noEmit
npm test            # 40 test (node:test + tsx)
npm run build       # next build
DATA_DIR=/tmp/x npm run seed   # veriyi başka dizine yaz
```

Testler gerçek kod yollarını çalıştırır: `tests/baglanti.test.ts` sahte bir Okulizyon sunucusu ayağa
kaldırıp `httpAdapter`'ın giriş → jeton → karne → normalizasyon zincirini gerçekten çağırır;
`tests/akis.test.ts` demo veriden programa kadar tüm zinciri, `tests/veritabani.test.ts` kalıcılığı,
`tests/parse.test.ts` karne/CSV çözümlemeyi doğrular.

Veri `data/` altında JSON olarak tutulur (gitignore'da). Kalıcılık için harici bir veritabanı gerekmez.
