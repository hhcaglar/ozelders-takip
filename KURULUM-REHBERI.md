# 🚀 veli.corluders.com'a Kurulum Rehberi

Bu rehber, `ders-takip` v2 projesini mevcut sitenizin (veli.corluders.com — Vercel'de barındırılıyor) yerine kurar.
Toplam süre: ~15 dakika. DNS ayarı **gerekmez**.

---

## Adım 0 — Projeyi indirin (1 dk)

1. Bu sohbetteki çalışma alanından **`ders-takip.zip`** dosyasını indirin.
2. Bilgisayarınızda bir klasöre çıkartın.
3. (İsteğe bağlı sağlamlık kontrolü) Klasörde `npm ci && npm run build` çalıştırın — sorunsuz derlenmeli.

---

## Adım 1 — Supabase kurulumu (5 dk)

> Veritabanı + giriş sistemi burada olacak. Ücretsiz plan yeterli.

1. [supabase.com](https://supabase.com) → login → **New project** (veya mevcut projeniz varsa onu açın).
   - Region: **Frankfurt (eu-central-1)** önerilir (Türkiye'ye en yakın).
2. Sol menüden **SQL Editor** → **New query** → `supabase/schema.sql` dosyasının içeriğini yapıştırın → **Run**.
   ✅ Tablolar, RLS güvenlik politikaları ve veli erişim fonksiyonu oluşur.
3. Sol menü **Authentication → Users → Add user**:
   - E-posta: kendi e-postanız, Şifre: güçlü bir şifre → **Auto Confirm User** açık → Create.
   👉 Bu, öğretmen giriş bilgileriniz.
4. **Authentication → Sign In / Providers → Email** → **"Allow new users to sign up"** seçeneğini KAPATIN.
   👉 Artık sadece sizin oluşturduğunuz hesapla giriş yapılabilir.
5. **Project Settings → API** bölümünden şunları kopyalayın (Adım 3'te lazım):
   - **Project URL** → `https://xxxxx.supabase.co`
   - **Publishable / anon key** → `eyJ...` ile başlayan uzun anahtar
   ⚠️ **service_role** anahtarını ASLA siteye koymayın — yalnızca publishable (anon) key.

---

## Adım 2 — Kodu GitHub'a yükleyin (5 dk)

Mevcut siteniz büyük olasılıkla bir GitHub reposundan deploy ediliyor. **En temiz yol: reposunun içeriğini tamamen yenisiyle değiştirmek.**

1. GitHub'da mevcut reponuzu açın (veya yeni repo oluşturun: **New repository**, ör. `ders-takip`).
2. Bilgisayarınıza çıkarttığınız klasörün **içindeki tüm dosyaları** repo köküne yükleyin:
   - Eski `src/`, eski `package.json` vb. **kalmamalı** — hepsini yenisiyle değiştirin.
   - `.env.local` yüklemeyin (`.gitignore` zaten engelliyor).
3. Komut satırıyla:

```bash
cd ders-takip          # çıkarttığınız klasör
git init               # yeni repoyse (mevcut repoyu indirip üzerine kopyalayabilirsiniz)
git add .
git commit -m "DersTakip v2 - Supabase + güvenlik + performans"
git branch -M main
git remote add origin https://github.com/KULLANICI-ADI/REPO-ADI.git
git push -u origin main
```

*(Komut satırı istemiyorsanız: GitHub → repo → "Add file → Upload files" ile sürükle-bırak da olur.)*

---

## Adım 3 — Vercel'e bağlayın (3 dk)

### A) Mevcut projeyi güncelliyorsanız (önerilen — alan adı otomatik kalır)
Reponun eski içeriğini yenisiyle değiştirdiyseniz Vercel **otomatik deploy eder**. Sadece env değişkenlerini ekleyin:

1. Vercel → projeniz → **Settings → Environment Variables**:
   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | `https://xxxxx.supabase.co` |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | `eyJ...` (anon key) |
2. **Deployments** sekmesi → en son deploy → ⋯ menüsü → **Redeploy**.
   ⚠️ Env değişkenleri build anında gömülür — ekledikten sonra mutlaka **yeniden deploy** edin.

### B) Yeni proje oluşturuyorsanız
1. Vercel → **Add New → Project** → reponuzu **Import**.
2. Framework: Vite otomatik tanınır (Build: `npm run build`, Output: `dist`).
3. Yukarıdaki 2 env değişkenini ekleyin → **Deploy**.
4. Alan adını taşıyın: eski proje → **Settings → Domains** → `veli.corluders.com` → **Remove**;
   yeni proje → **Settings → Domains** → **Add** → `veli.corluders.com`.
   (DNS kaydınız CORLUDERS tarafında aynı kalır, değişiklik gerekmez.)

> `vercel.json` içindeki cache, güvenlik header'ları ve SPA yönlendirmeleri otomatik uygulanır — ekstra işlem gerekmez.

---

## Adım 4 — Doğrulama (2 dk)

1. `https://veli.corluders.com` → artık **giriş ekranı** karşılamalı (herkes doğrudan panel giremez ✅).
2. Adım 1'de oluşturduğunuz e-posta/şifre ile **Öğretmen** sekmesinden giriş yapın.
3. Boş gelir — "**örnek verilerle başlayabilirsin**" bağlantısına tıklayın veya ilk gerçek öğrenciyi ekleyin.
4. Öğrenci kartında otomatik üretilen **veli erişim kodunu** görün; **Rapor** sekmesinden kopyalayıp veliye gönderin.
5. Veli testi: **gizli pencerede** siteye girin → **Veli** sekmesi → kodu yazın →
   yalnızca o öğrencinin verileri, salt-okunur görünmelidir ✅
6. Terminal doğrulaması (isteğe bağlı):

```bash
# bundle içinde supabase geçmeli (0'dan büyük):
curl -s https://veli.corluders.com/ | grep -oE 'assets/[^"]+\.js'
curl -s https://veli.corluders.com/assets/ABOVE_JS_FILE | grep -c supabase
```

---

## Sık karşılaşılan hatalar

| Belirti | Sebep / Çözüm |
|---|---|
| Giriş ekranında "Sunucuya ulaşılamadı" | Env değişkenleri girilmemiş **veya** yeniden deploy edilmemiş |
| "E-posta veya şifre hatalı" | Supabase Auth'da kullanıcı oluşturulmamış (Adım 1.3) |
| Veli kodu çalışmıyor | `schema.sql` çalıştırılmamış (Adım 1.2) veya kod yanlış yazılmış |
| Build hatası: "vite not found" | Repoda eski `package.json` kalmış — eski dosyalar tamamen silinmeli |
| Veriler kaydedilmiyor | Tarayıcı konsolunda hata var mı bakın; Supabase URL'si yanlış olabilir |

---

## Günlük kullanım akışı

- **Öğretmen (siz):** siteye öğretmen girişi → öğrenci ekle/düzenle → veli kodunu paylaş → Rapor sekmesinden veliye WhatsApp ile özet gönder.
- **Veli:** siteye gir → Veli sekmesi → erişim kodu → çocuğunun konu/ödev/sınav durumunu takip et (salt-okunur).
