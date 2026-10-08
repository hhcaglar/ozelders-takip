# 🎮 Ek Süre — Ödev teslim edilince Family Safety'den +1 saat

Bir ödevi **"Teslim edildi"** yaptığınızda öğrenci bir seferlik **+1 saat** ek süre hakkı kazanır.
Çocuğun bilgisayardaki süresi bitip **"Daha fazla süre iste"** dediğinde DersTakip bu isteği
**kendiliğinden onaylar**. Siz telefonu elinize almazsınız.

```
Öğretmen: ödev → "Teslim edildi"
        │
        ▼
DersTakip: bir seferlik +60 dk hak oluşturur (aynı ödev için ikinci kez açılmaz)
        │
Çocuk: süre bitti → "Daha fazla süre iste"  (Windows'taki Family Safety ekranı)
        │
        ▼
DersTakip (dakikada bir kontrol): hak var mı? bugünkü sınır doldu mu?
        ├─ hak var, sınır dolmadı → isteği +60 dk ONAYLAR, hak "kullanıldı" olur
        └─ hak yok / sınır doldu  → isteğe dokunmaz, karar sizde (Family Safety uygulaması)
```

## Neden "istek onaylama"?

Microsoft Family Safety'de ebeveynin **kendiliğinden "bugüne +1 saat ekle"** diyebileceği bir
özellik yok. Microsoft'un kendi uygulamasında da yok. Ek süre yalnızca çocuğun isteği
onaylanarak verilebiliyor. DersTakip bu yüzden, sizin yapacağınız onayı sizin yerinize ve
yalnızca ödev teslim edildiyse yapıyor.

> ⚠️ Microsoft, Family Safety için **resmî bir API sunmuyor**. Kullanılan yöntem, Family Safety
> Android uygulamasının kullandığı uç noktalardır. Home Assistant topluluğu da aynı yöntemi
> kullanıyor (pyfamilysafety, HAFamilySafety, ms-family-safety projeleri). Microsoft bu
> uygulamayı değiştirirse otomatik onay durabilir. O durumda hiçbir şey bozulmaz: istekler
> Family Safety uygulamanıza düşmeye devam eder, siz elle onaylarsınız.

## Kurallar (varsayılanlar)

| Kural | Varsayılan | Açıklama |
|---|---|---|
| Ödev başına ek süre | **60 dk** | Her teslim edilen ödev **bir kez** hak verir. Teslim → bekliyor → teslim yapmak ikinci hak açmaz. |
| Günde en fazla | **1 kez** | Aynı gün iki ödev teslim edilse de bir kez +1 saat onaylanır. Kalan haklar sonraki günlere kalır. |
| Onaylanacak istekler | **Hepsi** | Bilgisayarın genel ekran süresi ve uygulama süresi (ör. Minecraft) istekleri. |
| Uygulama filtresi | boş | Örneğin `minecraft` yazarsanız yalnızca Minecraft'ın süre isteği onaylanır. |

- Ödev teslimden **geri alınırsa** kullanılmamış hak iptal olur. Ödev silinirse hak durur, çünkü ödev yapılmıştı.
- Teslim edilmiş ödevlere **geriye dönük hak verilmez**. Yalnızca özellik açıldıktan sonraki teslimler sayılır.
- İsterseniz **"Elle hak ekle"** ile ödülden bağımsız bir hak tanımlayabilir, hazır bir hakkı **iptal** edebilirsiniz.

---

## Kurulum (bir kez, ~10 dakika)

Uygulamada **öğrenci → "Ek Süre" sekmesi → "Sunucu kurulumu"** bölümü bu adımları
sizin değerlerinizle doldurulmuş olarak gösterir ve hangi adımın tamam olduğunu işaretler.

### 1) Veritabanını güncelleyin
Supabase → **SQL Editor** → `supabase/schema.sql` dosyasının **tamamını** yapıştırın → **Run**.
Mevcut öğrenci verilerinize dokunmaz, yalnızca yeni tabloları ve fonksiyonları ekler. Defalarca
çalıştırmak güvenlidir.

### 2) Vercel'e iki ortam değişkeni ekleyin
Vercel → projeniz → **Settings → Environment Variables**:

| Ad | Değer |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → **Project Settings → API Keys** → `service_role` (yeni arayüzde **secret**) anahtarı |
| `AILE_SENKRON_ANAHTARI` | Uzun rastgele bir metin. "Sunucu kurulumu" bölümü sizin için üretir, **Kopyala** deyin. |

⚠️ `SUPABASE_SERVICE_ROLE_KEY` gizli bir anahtardır ve yalnızca sunucuda kalır. Adını **asla**
`VITE_` ile başlatmayın, aksi hâlde tarayıcıya gömülür.

Ardından **Deployments → son deploy → ⋯ → Redeploy**.

### 3) Zamanlayıcıyı kurun
Supabase → **SQL Editor**'de, "Sunucu kurulumu" bölümündeki **doldurulmuş SQL**'i çalıştırın.
(Elle yapmak isterseniz: `supabase/ek-sure-zamanlayici.sql` içindeki `__SITE_ADRESI__` ve
`__GIZLI_ANAHTAR__` değerlerini değiştirin.)

Bu görev dakikada bir çalışır. **Kullanılmamış hak yoksa Microsoft'a hiç gidilmez.** Yalnızca her
gece 04:00'te oturumu taze tutmak için bir kontrol yapılır.

### 4) Microsoft hesabını bağlayın
Öğrenci → **Ek Süre** sekmesi:
1. **"Microsoft ile giriş yap"** → Family Safety'yi yönettiğiniz (**aile düzenleyicisi**) hesapla giriş yapın.
2. Giriş bitince **boş bir sayfa** açılır. Adres çubuğundaki adresin **tamamını** kopyalayın
   (`https://login.live.com/oauth20_desktop.srf?code=…` ile başlar).
3. Adresi kutuya yapıştırıp **Bağla** deyin. Kod birkaç dakika geçerlidir, hemen yapıştırın.

### 5) Öğrenciyi eşleştirin
"Bu öğrenci Family Safety'de hangisi?" listesinden çocuğun hesabını seçip **Eşleştir** deyin.
Bunu her öğrenci için bir kez yaparsınız.

### 6) Deneyin
Bir ödevi "Teslim edildi" yapın. Çocuğun bilgisayarında süre bitince **"Daha fazla süre iste"**ye
basılsın. 1–2 dakika içinde onaylanmalı. Hemen denemek için sekmedeki **"Şimdi kontrol et"**
düğmesini kullanabilirsiniz. Sonuç **"Son olaylar"** listesinde görünür.

---

## Sık sorulanlar / sorun giderme

| Belirti | Çözüm |
|---|---|
| Kurulum kartında ✗ "Sunucu anahtarı" | 2. adım: değişkeni ekleyip **Redeploy** edin. |
| "Veritabanı fonksiyonları — schema.sql yeniden çalıştırılmalı" | 1. adımı tekrarlayın. |
| "bekleyen hak var ama 5 dakikadır kontrol yapılmadı" | 3. adım çalışmamış. SQL Editor'de `select jobname, active from cron.job;` ile görevi kontrol edin. `select status_code, content from net._http_response order by created desc limit 5;` sitenin yanıtını gösterir. 401 dönüyorsa anahtarlar farklıdır. |
| "Microsoft oturumunu yenileyin" uyarısı | Oturum süresi dolmuş (örneğin şifre değişti). 4. adımı tekrarlayın, haklar kaybolmaz. |
| İstek onaylanmadı, olaylarda "bugünkü ek süre hakkı kullanıldı" yazıyor | Günlük sınır doldu. Yarın otomatik onaylanır, isterseniz siz elle onaylayabilirsiniz. |
| İstek hiç görünmüyor | Çocuğun hesabı doğru eşleşti mi? Family Safety'de o çocuk için süre sınırı açık mı? İstek gerçekten gönderildi mi (Family Safety uygulamanıza bildirim geldi mi)? |
| "Giriş kodu geçersiz veya süresi dolmuş" | Kod tek kullanımlık ve kısa ömürlü. Girişi baştan yapıp yeni adresi hemen yapıştırın. |

## Güvenlik ve gizlilik

- **Şifreniz DersTakip'e hiç gelmez.** Giriş Microsoft'un kendi sayfasında yapılır. Saklanan şey,
  yalnızca Family Safety servisine erişebilen bir yenileme anahtarıdır
  (`service::familymobile.microsoft.com::MBI_SSL`). E-posta veya OneDrive'a erişemez.
- Bu anahtar `fs_connections` tablosunda durur. Tarayıcı rolleri (`anon`, `authenticated`) bu
  tabloyu **okuyamaz**. Yalnızca Vercel'deki sunucu fonksiyonu (service_role) kullanır.
  Öğretmen arayüzüne anahtar hiçbir zaman gönderilmez.
- "Bağlantıyı kaldır" anahtarı anında siler.
- Zamanlayıcı ile sunucu arasındaki gizli anahtar Supabase **Vault**'ta şifreli saklanır.
- Veli hesapları Microsoft bağlayamaz ve Ek Süre sekmesini görmez.

## Teknik ayrıntılar

| Parça | Dosya |
|---|---|
| Tablolar, tetikleyici, RPC'ler | `supabase/schema.sql` → bölüm 6 (`fs_connections`, `fs_links`, `fs_credits`, `fs_events`) |
| Zamanlayıcı (pg_cron + pg_net + Vault) | `supabase/ek-sure-zamanlayici.sql` |
| Microsoft istemcisi | `api/_lib/microsoft.js` |
| Onay mantığı | `api/_lib/senkron.js` |
| Sunucu uç noktaları | `api/aile-durum.js`, `api/aile-baglan.js`, `api/aile-cocuklar.js`, `api/aile-senkron.js` |
| Arayüz | `src/components/tabs/EkSureTab.jsx`, `src/components/EkSureKurulumKarti.jsx`, `src/components/tabs/HomeworksTab.jsx` |

Önemli uygulama ayrıntıları:
- Ödev hakkı veritabanı **tetikleyicisiyle** oluşur (`students` güncellenince). Tarayıcı kapansa bile hak kaçmaz.
- Onay süresi milisaniye olarak gönderilir (60 dk = 3.600.000). pyfamilysafety'deki `×100` hatası (60 dk yerine 6 dk) burada yoktur.
- Family Safety, bekleyen isteğin `id`'sini **her sorguda değiştirir**. Bu yüzden "aynı istek ikinci kez onaylanmasın" denetimi `id` yerine kalıcı alanlardan (çocuk, tür, platform, istek zamanı, uygulama adı) üretilen bir anahtarla yapılır.
- Hak, onaydan **önce** veritabanında kilitli olarak ayrılır. Aynı anda gelen çağrılar çift onay yapamaz, onay başarısız olursa hak geri verilir.

### Testler
```bash
npm ci
npm install --no-save embedded-postgres pg   # yalnızca veritabanı testleri için, package.json'a eklenmez
npm run test:ek-sure    # veritabanı (gerçek PostgreSQL) + uçtan uca + zamanlayıcı + arayüz
npm run test:smoke      # mevcut duman testi (yerel mod)
```
Uçtan uca test gerçek Microsoft'a bağlanmaz. Gerçek API'nin bilinen tuhaflıklarını taklit eden bir sahte sunucu kullanır: değişen istek id'leri, büyük sayısal kimlikler, tek kullanımlık giriş kodu, dönen yenileme anahtarı.
