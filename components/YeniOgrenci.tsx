"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alan, Buton, girisSinifi } from "./ui";

const GUNLER = [
  { no: 1, ad: "Pzt" },
  { no: 2, ad: "Sal" },
  { no: 3, ad: "Çar" },
  { no: 4, ad: "Per" },
  { no: 5, ad: "Cum" },
  { no: 6, ad: "Cmt" },
  { no: 0, ad: "Paz" },
];

export default function YeniOgrenci() {
  const router = useRouter();
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [gunler, setGunler] = useState<number[]>([1, 2, 3, 4, 5, 6]);

  async function gonder(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setHata(null);
    const f = new FormData(e.currentTarget);
    const govde = {
      ad: String(f.get("ad") ?? "").trim(),
      sinifSeviyesi: String(f.get("sinifSeviyesi") ?? "12"),
      sinavTuru: String(f.get("sinavTuru") ?? "TYT") as "TYT" | "AYT" | "LGS",
      okul: String(f.get("okul") ?? "").trim() || undefined,
      okulizyonOgrenciNo: String(f.get("okulizyonOgrenciNo") ?? "").trim() || undefined,
      hedefPuan: f.get("hedefPuan") ? Number(f.get("hedefPuan")) : undefined,
      hedefSiralama: f.get("hedefSiralama") ? Number(f.get("hedefSiralama")) : undefined,
      haftalikSaat: Number(f.get("haftalikSaat") ?? 12),
      blokDakika: Number(f.get("blokDakika") ?? 50),
      calismaGunleri: gunler,
    };
    if (!govde.ad) return setHata("Öğrenci adı zorunlu.");
    if (!govde.calismaGunleri.length) return setHata("En az bir çalışma günü seç.");

    setGonderiliyor(true);
    try {
      const cevap = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(govde),
      });
      const veri = await cevap.json();
      if (!cevap.ok) throw new Error(veri.hata ?? "Öğrenci eklenemedi");
      router.push(`/ogrenci/${veri.ogrenci.id}`);
      router.refresh();
    } catch (h) {
      setHata(h instanceof Error ? h.message : "Beklenmeyen hata");
    } finally {
      setGonderiliyor(false);
    }
  }

  return (
    <form onSubmit={gonder} className="space-y-3">
      <Alan etiket="Öğrenci adı">
        <input name="ad" className={girisSinifi} placeholder="Örn. Elif Yılmaz" required minLength={2} />
      </Alan>
      <div className="grid grid-cols-2 gap-3">
        <Alan etiket="Sınav">
          <select name="sinavTuru" className={girisSinifi} defaultValue="TYT">
            <option value="TYT">TYT (YKS 1. oturum)</option>
            <option value="AYT">AYT (YKS 2. oturum)</option>
            <option value="LGS">LGS (8. sınıf)</option>
          </select>
        </Alan>
        <Alan etiket="Sınıf">
          <input name="sinifSeviyesi" className={girisSinifi} defaultValue="12" />
        </Alan>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Alan etiket="Hedef puan" ipucu="Net açığı bundan hesaplanır">
          <input name="hedefPuan" type="number" className={girisSinifi} placeholder="450" min={0} max={600} />
        </Alan>
        <Alan etiket="Hedef sıralama">
          <input name="hedefSiralama" type="number" className={girisSinifi} placeholder="40000" />
        </Alan>
      </div>
      <Alan etiket="Okul / kurum">
        <input name="okul" className={girisSinifi} placeholder="Opsiyonel" />
      </Alan>
      <Alan etiket="Okulizyon öğrenci no" ipucu="Senkron sırasında öğrenci kimliği olarak kullanılır">
        <input name="okulizyonOgrenciNo" className={girisSinifi} placeholder="Opsiyonel" />
      </Alan>
      <div className="grid grid-cols-2 gap-3">
        <Alan etiket="Haftalık saat">
          <input name="haftalikSaat" type="number" className={girisSinifi} defaultValue={12} min={1} max={80} />
        </Alan>
        <Alan etiket="Blok süresi (dk)">
          <input name="blokDakika" type="number" className={girisSinifi} defaultValue={50} min={20} max={120} />
        </Alan>
      </div>
      <Alan etiket="Çalışma günleri">
        <div className="flex flex-wrap gap-1.5">
          {GUNLER.map((g) => {
            const secili = gunler.includes(g.no);
            return (
              <button
                type="button"
                key={g.no}
                onClick={() =>
                  setGunler((once) => (secili ? once.filter((x) => x !== g.no) : [...once, g.no]))
                }
                className={
                  secili
                    ? "rounded-md bg-vurgu px-2.5 py-1 text-xs font-medium text-white"
                    : "rounded-md border border-cizgi px-2.5 py-1 text-xs text-solgun hover:bg-zemin"
                }
              >
                {g.ad}
              </button>
            );
          })}
        </div>
      </Alan>
      {hata && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{hata}</p>}
      <Buton type="submit" disabled={gonderiliyor} className="w-full justify-center">
        {gonderiliyor ? "Ekleniyor…" : "Öğrenciyi ekle"}
      </Buton>
    </form>
  );
}
