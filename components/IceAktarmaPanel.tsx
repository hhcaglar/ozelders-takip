"use client";

import { useState } from "react";
import { csvSablonUret } from "@/lib/okulizyon/import";
import type { AytAlani, SinavTuru } from "@/lib/types";
import { Buton, Kart, girisSinifi } from "./ui";

export default function IceAktarmaPanel({
  ogrenciId,
  sinavTuru,
  aytAlani,
}: {
  ogrenciId: string;
  sinavTuru: SinavTuru;
  aytAlani?: AytAlani;
}) {
  const [icerik, setIcerik] = useState("");
  const [mesaj, setMesaj] = useState<{ ton: "olumlu" | "kritik" | "uyari"; metin: string } | null>(null);
  const [calisiyor, setCalisiyor] = useState(false);

  async function iceAktar() {
    if (!icerik.trim()) return setMesaj({ ton: "uyari", metin: "Önce içerik yapıştır veya dosya seç." });
    setCalisiyor(true);
    setMesaj(null);
    try {
      const cevap = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ogrenciId, icerik }),
      });
      const veri = await cevap.json();
      if (!cevap.ok) setMesaj({ ton: "kritik", metin: veri.hata ?? "İçe aktarma başarısız" });
      else {
        setMesaj({
          ton: veri.uyari ? "uyari" : "olumlu",
          metin: veri.uyari ? `${veri.mesaj} ${veri.uyari}` : veri.mesaj,
        });
        if (!veri.uyari) setTimeout(() => location.reload(), 900);
      }
    } catch (h) {
      setMesaj({ ton: "kritik", metin: h instanceof Error ? h.message : "Beklenmeyen hata" });
    } finally {
      setCalisiyor(false);
    }
  }

  function sablonIle(tip: "soru" | "bolum") {
    setIcerik(csvSablonUret(tip, sinavTuru, aytAlani));
  }

  async function dosyaSec(e: React.ChangeEvent<HTMLInputElement>) {
    const dosya = e.target.files?.[0];
    if (!dosya) return;
    setIcerik(await dosya.text());
  }

  return (
    <Kart
      baslik="Manuel içe aktarma"
      altBaslik="Okulizyon karne JSON'u veya CSV. Ders adları ve kazanım metinleri otomatik eşleştirilir."
    >
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => sablonIle("soru")}
            className="rounded-md border border-cizgi px-2 py-1 text-[11px] text-solgun hover:bg-zemin"
          >
            Örnek: soru düzeyinde CSV
          </button>
          <button
            onClick={() => sablonIle("bolum")}
            className="rounded-md border border-cizgi px-2 py-1 text-[11px] text-solgun hover:bg-zemin"
          >
            Örnek: ders düzeyinde CSV
          </button>
          <label className="cursor-pointer rounded-md border border-cizgi px-2 py-1 text-[11px] text-solgun hover:bg-zemin">
            Dosya seç
            <input type="file" accept=".csv,.json,.txt" onChange={dosyaSec} className="hidden" />
          </label>
        </div>
        <textarea
          className={`${girisSinifi} h-40 font-mono text-xs`}
          value={icerik}
          onChange={(e) => setIcerik(e.target.value)}
          placeholder={'baslik;tarih;ders;dogru;yanlis;bos\nveya\n[{"sinavAdi":"...","bolumler":[...],"sorular":[...]}]'}
        />
        <Buton onClick={iceAktar} disabled={calisiyor} className="w-full justify-center">
          {calisiyor ? "Aktarılıyor…" : "İçe aktar"}
        </Buton>
        {mesaj && (
          <p
            className={
              mesaj.ton === "olumlu"
                ? "rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800"
                : mesaj.ton === "uyari"
                  ? "rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800"
                  : "rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800"
            }
          >
            {mesaj.metin}
          </p>
        )}
        <p className="text-[11px] leading-relaxed text-solgun">
          Kabul edilen CSV başlıkları: <code>baslik, tarih, ders, soru, kazanim, durum</code> (durum: D/Y/B) veya{" "}
          <code>baslik, tarih, ders, dogru, yanlis, bos</code>. Kazanım metninde ayıraç geçiyorsa alanı çift
          tırnağa al (<code>"Katı; sıvı ve gaz basıncı"</code>); alan sayısı başlıkla uyuşmazsa uyarı döner.
          Kazanım metni katalogla eşleşmezse soru kaydı tutulur ama kazanım etiketi boş bırakılır — yanlış
          etiketlemektense boş tercih edilir. Hiçbir dersi tanınmayan karne kaydedilmez.
        </p>
      </div>
    </Kart>
  );
}
