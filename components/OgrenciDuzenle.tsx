"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alan, Buton, girisSinifi } from "./ui";
import type { Ogrenci } from "@/lib/types";

const GUN_ETIKET = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];

/**
 * Öğrenci bilgilerini günceller (PATCH /api/students/[id]).
 *
 * AYT alanı net tavanını, hedef neti, puan eğrisini ve çalışma programını
 * doğrudan etkilediği için sonradan düzeltilebilmesi gerekir; yalnızca oluşturma
 * formunda sunmak yanlış seçimi geri döndürülemez bırakırdı.
 */
export default function OgrenciDuzenle({ ogrenci }: { ogrenci: Ogrenci }) {
  const router = useRouter();
  const [acik, setAcik] = useState(false);
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [gunler, setGunler] = useState<number[]>(ogrenci.calismaGunleri);

  async function gonder(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setHata(null);
    if (!gunler.length) return setHata("En az bir çalışma günü seç.");

    const f = new FormData(e.currentTarget);
    const govde = {
      ad: String(f.get("ad") ?? "").trim(),
      sinifSeviyesi: String(f.get("sinifSeviyesi") ?? "").trim(),
      sinavTuru: String(f.get("sinavTuru") ?? ogrenci.sinavTuru) as "TYT" | "AYT" | "LGS",
      aytAlani: String(f.get("aytAlani") ?? "SAY") as "SAY" | "EA" | "SOZ",
      okul: String(f.get("okul") ?? "").trim() || undefined,
      okulizyonOgrenciNo: String(f.get("okulizyonOgrenciNo") ?? "").trim() || undefined,
      hedefPuan: f.get("hedefPuan") ? Number(f.get("hedefPuan")) : undefined,
      hedefSiralama: f.get("hedefSiralama") ? Number(f.get("hedefSiralama")) : undefined,
      haftalikSaat: Number(f.get("haftalikSaat") ?? ogrenci.haftalikSaat),
      blokDakika: Number(f.get("blokDakika") ?? ogrenci.blokDakika),
      calismaGunleri: gunler,
    };

    setGonderiliyor(true);
    try {
      const cevap = await fetch(`/api/students/${ogrenci.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(govde),
      });
      const veri = await cevap.json();
      if (!cevap.ok) throw new Error(veri.hata ?? "Kayıt güncellenemedi");
      setAcik(false);
      router.refresh();
    } catch (h) {
      setHata(h instanceof Error ? h.message : "Beklenmeyen hata");
    } finally {
      setGonderiliyor(false);
    }
  }

  function gunDegistir(gun: number) {
    setGunler((once) => (once.includes(gun) ? once.filter((g) => g !== gun) : [...once, gun].sort()));
  }

  return (
    <div className="yazdirma-gizle">
      {!acik ? (
        <Buton variant="ikincil" onClick={() => setAcik(true)}>
          Bilgileri düzenle
        </Buton>
      ) : (
        <form onSubmit={gonder} className="space-y-3 rounded-xl border border-cizgi bg-yuzey p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Alan etiket="Öğrenci adı">
              <input name="ad" className={girisSinifi} defaultValue={ogrenci.ad} required minLength={2} />
            </Alan>
            <Alan etiket="Sınıf">
              <input name="sinifSeviyesi" className={girisSinifi} defaultValue={ogrenci.sinifSeviyesi} />
            </Alan>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Alan etiket="Sınav">
              <select name="sinavTuru" className={girisSinifi} defaultValue={ogrenci.sinavTuru}>
                <option value="TYT">TYT (YKS 1. oturum)</option>
                <option value="AYT">AYT (YKS 2. oturum)</option>
                <option value="LGS">LGS (8. sınıf)</option>
              </select>
            </Alan>
            <Alan
              etiket="AYT alanı"
              ipucu="Net tavanını, hedef neti ve programı doğrudan etkiler; her alan 80 soru."
            >
              <select name="aytAlani" className={girisSinifi} defaultValue={ogrenci.aytAlani ?? "SAY"}>
                <option value="SAY">Sayısal — Mat 40 + Fen 40</option>
                <option value="EA">Eşit ağırlık — Mat 40 + Edebiyat-Sosyal-1 40</option>
                <option value="SOZ">Sözel — Edebiyat-Sosyal-1 40 + Sosyal-2 40</option>
              </select>
            </Alan>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Alan etiket="Hedef puan" ipucu="Net açığı bundan hesaplanır">
              <input
                name="hedefPuan"
                type="number"
                className={girisSinifi}
                defaultValue={ogrenci.hedefPuan ?? ""}
                min={0}
                max={600}
              />
            </Alan>
            <Alan etiket="Hedef sıralama">
              <input
                name="hedefSiralama"
                type="number"
                className={girisSinifi}
                defaultValue={ogrenci.hedefSiralama ?? ""}
              />
            </Alan>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Alan etiket="Haftalık saat">
              <input
                name="haftalikSaat"
                type="number"
                className={girisSinifi}
                defaultValue={ogrenci.haftalikSaat}
                min={1}
                max={80}
              />
            </Alan>
            <Alan etiket="Blok dakikası">
              <input
                name="blokDakika"
                type="number"
                className={girisSinifi}
                defaultValue={ogrenci.blokDakika}
                min={20}
                max={120}
              />
            </Alan>
            <Alan etiket="Okul / kurum">
              <input name="okul" className={girisSinifi} defaultValue={ogrenci.okul ?? ""} />
            </Alan>
          </div>

          <Alan etiket="Okulizyon öğrenci no">
            <input
              name="okulizyonOgrenciNo"
              className={girisSinifi}
              defaultValue={ogrenci.okulizyonOgrenciNo ?? ""}
            />
          </Alan>

          <Alan etiket="Çalışma günleri">
            <div className="flex flex-wrap gap-1.5">
              {GUN_ETIKET.map((etiket, gun) => (
                <button
                  key={gun}
                  type="button"
                  onClick={() => gunDegistir(gun)}
                  aria-pressed={gunler.includes(gun)}
                  className={
                    gunler.includes(gun)
                      ? "rounded-lg bg-vurgu px-2.5 py-1 text-xs font-medium text-white"
                      : "rounded-lg border border-cizgi px-2.5 py-1 text-xs text-solgun hover:bg-zemin"
                  }
                >
                  {etiket}
                </button>
              ))}
            </div>
          </Alan>

          {hata && <p className="text-sm text-rose-600">{hata}</p>}

          <div className="flex gap-2">
            <Buton type="submit" disabled={gonderiliyor}>
              {gonderiliyor ? "Kaydediliyor…" : "Kaydet"}
            </Buton>
            <Buton variant="ikincil" onClick={() => setAcik(false)} disabled={gonderiliyor}>
              Vazgeç
            </Buton>
          </div>
        </form>
      )}
    </div>
  );
}
