# DersTakip v3 — Öğrenci/Veli Takip Sistemi


## v3 yenilikleri

- **Veli kayıt sistemi:** veli artık hesap açabiliyor (ad + e-posta + şifre + öğretmen erişim kodu).
  Hesap, RLS üzerinden yalnızca kendi çocuğunun verisini salt-okunur görür. Hızlı (hesapsız) kod girişi de hâlâ çalışır.
- **Öğrenci düzenleme:** öğretmen, ad/sınıf/veli bilgilerini sonradan değiştirebilir (başlıktaki "Düzenle").
- **Hesap ayarları:** şifre değiştirme, (velide) öğrenci bağlantısını kesme, çıkış — kenar çubuğundaki "Ayarlar".
- **Öğrenci arama + sayacı** (10+ öğrencide arama kutusu otomatik görünür).
- **Ödev filtreleri:** Tümü / Bekleyen / Geciken / Teslim.
- **Bağlı veli hesapları:** Rapor sekmesinde öğrenciye hangi velilerin bağlandığı listelenir.
- **Görsel cila:** hover efektleri, yumuşak geçişler, yeni giriş ekranı, ikon düğmeleri.

> ⚠️ v3'e geçiş: `supabase/schema.sql` dosyasını Supabase SQL Editor'de **tekrar** çalıştırın
> (idempotenttir — mevcut verilerinize zarar vermez). Yeni tablo: `parent_users`,
> yeni fonksiyonlar: `parent_link`, `parent_get_me`, `parent_unlink`, `student_parents`.

React 19 + Vite 8 + Supabase tabanlı öğrenci ders/ödev/sınav takip paneli.

## v2'de çözülen sorunlar

| Sorun (v1) | Çözüm (v2) |
|---|---|
| Veriler her yenilemede siliniyordu (`window.storage` yok) | Veri katmanı Supabase'e bağlandı; Supabase yoksa **localStorage** yedeği devrede. Otomatik kaydetme + hata durumunda "Tekrar dene" |
| Kimlik doğrulama yoktu, herkes öğretmendiydi | Öğretmen için **Supabase Auth** (e-posta/şifre), veli için **erişim kodu** ile salt-okunur giriş |
| RLS yok, veritabanı herkese açılabilirdi | `supabase/schema.sql` içinde satır-seviyesi güvenlik + veli RPC fonksiyonu |
| `package.json`'da her şey `latest` | Sürümler sabitlendi, build araçları `devDependencies`'e taşındı |
| Hash'li dosyalar `max-age=0` ile geliyordu | `vercel.json`: `/assets/*` için `immutable` cache |
| Güvenlik header'ları yok | `vercel.json`: CSP, X-Frame-Options, HSTS vb. |
| favicon/robots.txt 404, OG etiketleri yok | Eklendi |
| Fontlar JS içinden `@import` | `index.html`'de `preconnect` + `<link>` |
| 578 KB tek bundle | recharts yalnızca grafikte lazy-load ile ayrı parçada |
| `window.confirm` | Uygulama içi onay penceresi |
| Mobilde sabit 240px kenar çubuğu | 760px altında açılır-kapanır çekmece menü |

## Yerelde çalıştırma

```bash
npm ci        # lockfile'a birebir uyar
cp .env.example .env.local   # doldur (isteğe bağlı — girilmezse yerel mod)
npm run dev
```

> `.env.local` girilmemişse uygulama **yerel modda** çalışır: veriler yalnızca bu
> tarayıcıda saklanır ve uygulama bunu kenar çubuğunda açıkça belirtir.

## Supabase kurulumu (üretim için önerilir)

1. [supabase.com](https://supabase.com) → yeni proje oluştur.
2. **SQL Editor** → `supabase/schema.sql` içeriğini çalıştır.
   (Tablolar, RLS politikaları ve veli erişim fonksiyonu oluşur.)
3. **Authentication → Users → Add user**: öğretmen e-posta + şifre oluştur.
4. Davetsiz kaydı kapat: **Authentication → Providers → Email → "Allow new users to sign up"** kapalı.
   (Uygulamadaki "Hesap Oluştur" yalnızca ilk kurulum içindir.)
5. **Project Settings → API** → URL ve **publishable (anon)** anahtarını al.

## Vercel'e dağıtım

1. Repo'yu GitHub'a yükle (`.env.local` `.gitignore` içinde — yüklenmez).
2. Vercel → New Project → repo'yu seç.
   - Build Command: `npm run build`
   - Output Directory: `dist`
3. **Settings → Environment Variables**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
4. Deploy. ⚠️ Env değişkenleri build anında gömülür — değiştirirsen **yeniden deploy** et.
5. Doğrulama: yayındaki site kaynağında JS bundle içinde `supabase.co` geçmeli
   (`curl -s https://SITE/assets/*.js | grep -o supabase.co | head -1`).

`vercel.json` cache, güvenlik header'ları ve SPA rewrite'larını otomatik uygular.

## Veli erişimi nasıl çalışır?

- Öğretmen yeni öğrenci ekleyince otomatik **erişim kodu** üretilir (örn. `K7QM-3XPA`).
- Kodu **Rapor** sekmesinden kopyalayıp veli ile paylaş.
- Veli `veli.siteadresi.com`'a girip **Veli** sekmesinden kodu yazarak yalnızca
  kendi çocuğunun verilerini **salt-okunur** görür.
- Güvence: kod, veritabanında `security definer` RPC fonksiyonuyla doğrulanır;
  veli tablolara doğrudan asla erişemez (RLS).

## Proje yapısı

```
├── index.html              # meta, OG, font linkleri, favicon
├── vercel.json             # cache + güvenlik header'ları + SPA rewrite
├── supabase/schema.sql     # tablolar + RLS + veli RPC
├── public/                 # favicon.svg, robots.txt
└── src/
    ├── main.jsx            # giriş
    ├── index.css           # global stiller + tasarım değişkenleri
    ├── App.jsx             # ana ekran, otomatik kaydetme, sekmeler
    ├── lib/
    │   ├── supabaseClient.js   # env → client (yoksa yerel mod)
    │   ├── auth.jsx            # öğretmen oturumu + veli kodu durumu
    │   ├── dataService.js      # Supabase arka planı + veli RPC
    │   ├── localBackend.js     # localStorage arka planı
    │   ├── demoData.js         # örnek veri üretici
    │   └── utils.js            # net hesabı, tarih, uid, kod üretimi
    └── components/
        ├── ui.jsx              # Button, Card, Modal, ConfirmDialog…
        ├── Sidebar.jsx         # öğrenci listesi (mobilde çekmece)
        ├── StudentHeader.jsx   # istatistik şeridi
        ├── LoginScreen.jsx     # öğretmen/veli girişi
        ├── NetChart.jsx        # recharts (lazy-loaded)
        └── tabs/               # Konular, Sınavlar, Ödevler, Plan, Öneriler, Rapor
```
