"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alan, Buton, Kart, Rozet, girisSinifi } from "./ui";

interface Baglanti {
  aktif: boolean;
  baseUrl: string;
  mod: "demo" | "http";
  ogrenciNo: string;
  sonSenkron?: string;
  sonSenkronDurum?: "basarili" | "hata";
  sonSenkronMesaj?: string;
}

export default function SenkronPanel({ ogrenciId }: { ogrenciId: string }) {
  const [baglanti, setBaglanti] = useState<Baglanti | null>(null);
  const [sifre, setSifre] = useState("");
  const [adet, setAdet] = useState(4);
  const [mesaj, setMesaj] = useState<{ ton: "olumlu" | "kritik"; metin: string } | null>(null);
  const [calisiyor, setCalisiyor] = useState(false);

  useEffect(() => {
    fetch("/api/baglanti")
      .then((r) => r.json())
      .then((v) => setBaglanti(v.baglanti))
      .catch(() => setBaglanti(null));
  }, []);

  async function senkronla() {
    setCalisiyor(true);
    setMesaj(null);
    try {
      const cevap = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ogrenciId, sifre: sifre || undefined, sinavSayisi: adet }),
      });
      const veri = await cevap.json();
      if (!cevap.ok) {
        setMesaj({ ton: "kritik", metin: veri.hata ?? "Senkron başarısız" });
      } else {
        setMesaj({
          ton: "olumlu",
          metin: `${veri.mesaj} ${veri.eklenen} yeni sınav eklendi, ${veri.guncellenen} kayıt güncellendi.`,
        });
        setTimeout(() => location.reload(), 900);
      }
    } catch (h) {
      setMesaj({ ton: "kritik", metin: h instanceof Error ? h.message : "Bağlantı hatası" });
    } finally {
      setCalisiyor(false);
    }
  }

  return (
    <Kart
      baslik="Okulizyon'dan netleri çek"
      altBaslik={
        baglanti
          ? `Mod: ${baglanti.mod === "http" ? "gerçek istek" : "demo veri"}${baglanti.baseUrl ? ` · ${baglanti.baseUrl}` : ""}`
          : "Bağlantı yükleniyor…"
      }
    >
      <div className="space-y-3">
        {baglanti?.mod === "http" ? (
          <Alan etiket="Okulizyon şifresi" ipucu="Yalnızca bu istek süresince bellekte tutulur, diske yazılmaz.">
            <input
              type="password"
              className={girisSinifi}
              value={sifre}
              onChange={(e) => setSifre(e.target.value)}
              autoComplete="off"
            />
          </Alan>
        ) : (
          <p className="rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
            Bağlantı şu an <strong>demo modunda</strong>: Okulizyon biçiminde örnek karne üretir ve panelin tüm
            analiz-yorum-program akışını gerçek kod yolundan geçirir. Gerçek veri için{" "}
            <Link href="/baglanti" className="underline">
              bağlantı ayarlarından
            </Link>{" "}
            modu “Gerçek istek (HTTP)” yap ve uç noktaları gir.
          </p>
        )}

        {baglanti?.mod === "demo" ? (
          <Alan etiket="Üretilecek sınav sayısı">
            <input
              type="number"
              className={girisSinifi}
              min={1}
              max={12}
              value={adet}
              onChange={(e) => setAdet(Number(e.target.value))}
            />
          </Alan>
        ) : null}

        <Buton onClick={senkronla} disabled={calisiyor} className="w-full justify-center">
          {calisiyor ? "Çekiliyor…" : "Senkronize et"}
        </Buton>

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

        {baglanti?.sonSenkron && (
          <p className="flex items-center gap-1.5 text-[11px] text-solgun">
            <Rozet ton={baglanti.sonSenkronDurum === "basarili" ? "olumlu" : "kritik"}>
              {baglanti.sonSenkronDurum}
            </Rozet>
            {new Date(baglanti.sonSenkron).toLocaleString("tr-TR")}
          </p>
        )}
      </div>
    </Kart>
  );
}
