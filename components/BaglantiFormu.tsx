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
          <Alan etiket="Taban adres (base URL)" ipucu="Örn. https://okulizyon.com">
            <input
              className={girisSinifi}
              value={ayar.baseUrl}
              onChange={(e) => guncelle("baseUrl", e.target.value)}
              placeholder="https://…"
              disabled={!http}
            />
          </Alan>
          <Alan etiket="Giriş uç noktası">
            <input
              className={girisSinifi}
              value={ayar.girisEndpoint}
              onChange={(e) => guncelle("girisEndpoint", e.target.value)}
              placeholder="/api/giris"
              disabled={!http}
            />
          </Alan>
          <Alan etiket="Karne uç noktası" ipucu="Sorgu parametreleri otomatik eklenir.">
            <input
              className={girisSinifi}
              value={ayar.karneEndpoint}
              onChange={(e) => guncelle("karneEndpoint", e.target.value)}
              placeholder="/api/karne"
              disabled={!http}
            />
          </Alan>
          <Alan etiket="Öğrenci no">
            <input
              className={girisSinifi}
              value={ayar.ogrenciNo}
              onChange={(e) => guncelle("ogrenciNo", e.target.value)}
            />
          </Alan>
          <Alan etiket="T.C. kimlik no">
            <input
              className={girisSinifi}
              value={ayar.tcKimlikNo}
              onChange={(e) => guncelle("tcKimlikNo", e.target.value)}
              inputMode="numeric"
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

        {http && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
            Gerçek istek modunda sunucu bu uç noktalara doğrudan çağrı yapar. Okulizyon'un resmî API'si
            olmadığı için adres ve alan adlarını kendi kurum panelinden/uygulama trafiğinden doğrulaman gerekir.
            Çağrı başarısız olursa dönen hata mesajı senkron günlüğüne yazılır.
          </p>
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
