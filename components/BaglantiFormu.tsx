"use client";

import { useState } from "react";
import type { BaglantiAyari } from "@/lib/types";
import { Alan, Buton, Kart, Rozet, girisSinifi } from "./ui";

export default function BaglantiFormu({ baslangic }: { baslangic: BaglantiAyari }) {
  const [ayar, setAyar] = useState<BaglantiAyari>(baslangic);
  const [mesaj, setMesaj] = useState<{ ton: "olumlu" | "kritik"; metin: string } | null>(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  function guncelle<K extends keyof BaglantiAyari>(anahtar: K, deger: BaglantiAyari[K]) {
    setAyar((once) => ({ ...once, [anahtar]: deger }));
  }

  async function kaydet() {
    setKaydediliyor(true);
    setMesaj(null);
    try {
      const cevap = await fetch("/api/baglanti", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ayar),
      });
      const veri = await cevap.json();
      if (!cevap.ok) throw new Error(veri.hata ?? "Kaydedilemedi");
      setAyar(veri.baglanti);
      setMesaj({ ton: "olumlu", metin: "Ayarlar kaydedildi." });
    } catch (h) {
      setMesaj({ ton: "kritik", metin: h instanceof Error ? h.message : "Beklenmeyen hata" });
    } finally {
      setKaydediliyor(false);
    }
  }

  const http = ayar.mod === "http";

  return (
    <Kart
      baslik="Bağlantı ayarları"
      sag={<Rozet ton={ayar.aktif ? "olumlu" : "notr"}>{ayar.aktif ? "aktif" : "pasif"}</Rozet>}
      altBaslik="Şifre bu ekranda saklanmaz; senkron sırasında öğrenci ekranından girilir."
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={ayar.aktif}
              onChange={(e) => guncelle("aktif", e.target.checked)}
              className="size-4 accent-indigo-600"
            />
            Bağlantıyı etkinleştir
          </label>
          <div className="flex gap-1.5">
            {(["demo", "http"] as const).map((m) => (
              <button
                key={m}
                onClick={() => guncelle("mod", m)}
                className={
                  ayar.mod === m
                    ? "rounded-md bg-vurgu px-2.5 py-1 text-xs font-medium text-white"
                    : "rounded-md border border-cizgi px-2.5 py-1 text-xs text-solgun hover:bg-zemin"
                }
              >
                {m === "demo" ? "Demo veri" : "Gerçek istek (HTTP)"}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Alan etiket="Taban adres (base URL)" ipucu="Doğrulanmış: https://okulizyon.com">
            <input
              className={girisSinifi}
              value={ayar.baseUrl}
              onChange={(e) => guncelle("baseUrl", e.target.value)}
              placeholder="https://okulizyon.com"
              disabled={!http}
            />
          </Alan>
          <Alan
            etiket="Giriş sayfası"
            ipucu="Bilgi amaçlı; uç nokta adresini buradaki ağ trafiğinden okuyacaksın."
          >
            <input className={girisSinifi} value={ayar.girisSayfasi} readOnly />
          </Alan>
          <Alan
            etiket="Giriş uç noktası"
            ipucu="Bilinmiyor — ağ sekmesinden okuyup yaz (aşağıdaki tarif)."
          >
            <input
              className={girisSinifi}
              value={ayar.girisEndpoint}
              onChange={(e) => guncelle("girisEndpoint", e.target.value)}
              placeholder="Örn. /app2/…  (ağ sekmesinden)"
              disabled={!http}
            />
          </Alan>
          <Alan
            etiket="Karne uç noktası"
            ipucu="Bilinmiyor — sonuç ekranındaki XHR isteğinin yolu. Sorgu parametreleri otomatik eklenir."
          >
            <input
              className={girisSinifi}
              value={ayar.karneEndpoint}
              onChange={(e) => guncelle("karneEndpoint", e.target.value)}
              placeholder="Örn. /app2/…  (ağ sekmesinden)"
              disabled={!http}
            />
          </Alan>
        </div>

        <div className="rounded-lg border border-cizgi bg-zemin/50 p-3">
          <p className="mb-2 text-xs font-medium text-solgun">
            Kimlik — Okulizyon giriş formu üç sekme sunuyor; hangisiyle giriyorsan onu seç. Sınıf bilgisi
            öğrenci profilinden alınır, ayrıca girilmez.
          </p>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {(
              [
                ["ogrenciNo", "Öğrenci No"],
                ["tcKimlikNo", "T.C. Kimlik No"],
                ["telefon", "Telefon"],
              ] as const
            ).map(([kod, ad]) => (
              <button
                key={kod}
                onClick={() => guncelle("girisTipi", kod)}
                disabled={!http}
                className={
                  ayar.girisTipi === kod
                    ? "rounded-md bg-vurgu px-2.5 py-1 text-xs font-medium text-white"
                    : "rounded-md border border-cizgi bg-yuzey px-2.5 py-1 text-xs text-solgun hover:bg-zemin"
                }
              >
                {ad}
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Alan etiket="Öğrenci no">
              <input
                className={girisSinifi}
                value={ayar.ogrenciNo}
                onChange={(e) => guncelle("ogrenciNo", e.target.value)}
                disabled={!http || ayar.girisTipi !== "ogrenciNo"}
              />
            </Alan>
            <Alan etiket="T.C. kimlik no">
              <input
                className={girisSinifi}
                value={ayar.tcKimlikNo}
                onChange={(e) => guncelle("tcKimlikNo", e.target.value)}
                inputMode="numeric"
                disabled={!http || ayar.girisTipi !== "tcKimlikNo"}
              />
            </Alan>
            <Alan etiket="Telefon" ipucu="10 hane, başında 0 olmadan">
              <input
                className={girisSinifi}
                value={ayar.telefon}
                onChange={(e) => guncelle("telefon", e.target.value)}
                inputMode="numeric"
                disabled={!http || ayar.girisTipi !== "telefon"}
              />
            </Alan>
            <Alan etiket="Kurum kodu (kk)" ipucu="Giriş adresindeki ?kk=… parametresi">
              <input
                className={girisSinifi}
                value={ayar.kurumKodu}
                onChange={(e) => guncelle("kurumKodu", e.target.value)}
                disabled={!http}
              />
            </Alan>
            <Alan etiket="Kurum">
              <input className={girisSinifi} value={ayar.kurum} onChange={(e) => guncelle("kurum", e.target.value)} />
            </Alan>
            <Alan etiket="İl">
              <input className={girisSinifi} value={ayar.il} onChange={(e) => guncelle("il", e.target.value)} />
            </Alan>
            <Alan etiket="İlçe">
              <input className={girisSinifi} value={ayar.ilce} onChange={(e) => guncelle("ilce", e.target.value)} />
            </Alan>
          </div>
        </div>

        {http && (
          <div className="rounded-lg bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900">
            <p className="font-semibold">Uç noktaları nasıl bulursun?</p>
            <ol className="mt-1 list-decimal space-y-1 pl-4">
              <li>
                Tarayıcıda{" "}
                <a className="underline" href={`${ayar.baseUrl}${ayar.girisSayfasi}`} target="_blank" rel="noreferrer">
                  {ayar.baseUrl}
                  {ayar.girisSayfasi}
                </a>{" "}
                adresini aç.
              </li>
              <li>Geliştirici araçlarını aç (F12) → <strong>Ağ / Network</strong> sekmesi → filtre: <strong>Fetch/XHR</strong>.</li>
              <li>Öğrenci bilgilerinle giriş yap; listede beliren POST isteğinin yolu <strong>giriş uç noktası</strong>dır.</li>
              <li>
                Sonuç/karne ekranını aç; orada beliren isteğin yolu <strong>karne uç noktası</strong>dır. Cevabın
                JSON biçimini de buradan kopyalayıp sağdaki örnek şemayla karşılaştır.
              </li>
            </ol>
            <p className="mt-1.5">
              Bu iki adresi ben senin adına doğrulayamam: Okulizyon'un belgelenmiş bir API'si yok ve adresler
              yalnızca oturum açmış bir tarayıcının ağ trafiğinden okunabiliyor. Uydurma bir yol yazmak yerine
              alanları boş bıraktım; boşken istek atılmaz ve hata mesajı bu tarifi gösterir.
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Buton onClick={kaydet} disabled={kaydediliyor}>
            {kaydediliyor ? "Kaydediliyor…" : "Ayarları kaydet"}
          </Buton>
          {ayar.sonSenkron && (
            <span className="text-[11px] text-solgun">
              Son senkron {new Date(ayar.sonSenkron).toLocaleString("tr-TR")} ·{" "}
              <Rozet ton={ayar.sonSenkronDurum === "basarili" ? "olumlu" : "kritik"}>
                {ayar.sonSenkronDurum}
              </Rozet>
              {ayar.sonSenkronMesaj ? ` · ${ayar.sonSenkronMesaj}` : ""}
            </span>
          )}
        </div>

        {mesaj && (
          <p
            className={
              mesaj.ton === "olumlu"
                ? "rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800"
                : "rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800"
            }
          >
            {mesaj.metin}
          </p>
        )}
      </div>
    </Kart>
  );
}
