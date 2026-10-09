"use client";

import { Fragment, useMemo, useState } from "react";
import { DERSLER } from "@/lib/data/dersler";
import { kazanimYorumu } from "@/lib/yorum";
import type { KazanimDurumu } from "@/lib/types";
import { Bos, Ilerleme, Kart, Rozet } from "@/components/ui";

type DurumFiltre = "hepsi" | KazanimDurumu["durum"];

const DURUM_ETIKET: Record<KazanimDurumu["durum"], { ad: string; ton: "olumlu" | "uyari" | "kritik" | "notr" }> = {
  kazanildi: { ad: "Kazanıldı", ton: "olumlu" },
  gelistirilmeli: { ad: "Geliştirilmeli", ton: "uyari" },
  kritik: { ad: "Kritik", ton: "kritik" },
  verisiz: { ad: "Ölçülmedi", ton: "notr" },
};

export default function KazanimSekmesi({
  toplu,
  dersRenkleri,
}: {
  toplu: KazanimDurumu[];
  dersRenkleri: { ad: string; renk: string; kod: string }[];
}) {
  const [ders, setDers] = useState<string>("hepsi");
  const [durum, setDurum] = useState<DurumFiltre>("hepsi");
  const [siralama, setSiralama] = useState<"oncelik" | "ustalik" | "ders">("oncelik");
  const [acikSatir, setAcikSatir] = useState<string | null>(null);

  const liste = useMemo(() => {
    let l = [...toplu];
    if (ders !== "hepsi") l = l.filter((k) => k.kazanim.ders === ders);
    if (durum !== "hepsi") l = l.filter((k) => k.durum === durum);
    l.sort((a, b) => {
      if (siralama === "ustalik") return a.ustalik - b.ustalik;
      if (siralama === "ders") return a.kazanim.ders.localeCompare(b.kazanim.ders) || b.oncelik - a.oncelik;
      return b.oncelik - a.oncelik;
    });
    return l;
  }, [toplu, ders, durum, siralama]);

  const sayac = {
    toplam: toplu.length,
    olculen: toplu.filter((k) => k.durum !== "verisiz").length,
    kritik: toplu.filter((k) => k.durum === "kritik").length,
    gelistirilmeli: toplu.filter((k) => k.durum === "gelistirilmeli").length,
    kazanildi: toplu.filter((k) => k.durum === "kazanildi").length,
  };

  if (!toplu.length) return <Bos mesaj="Kazanım analizi için en az bir sınav kaydı gerekli." />;

  return (
    <div className="space-y-4">
      <Kart
        baslik="Kazanım kıyaslaması"
        altBaslik="Okulizyon'daki her soru MEB kazanım kataloğuyla eşleştirilir; ustalık tüm sınavların ağırlıklı ortalamasıdır."
      >
        <div className="grid gap-3 sm:grid-cols-5">
          {[
            { ad: "Katalog kazanımı", deger: sayac.toplam, ton: "notr" as const },
            { ad: "Ölçülen", deger: sayac.olculen, ton: "bilgi" as const },
            { ad: "Kazanılmış", deger: sayac.kazanildi, ton: "olumlu" as const },
            { ad: "Geliştirilmeli", deger: sayac.gelistirilmeli, ton: "uyari" as const },
            { ad: "Kritik", deger: sayac.kritik, ton: "kritik" as const },
          ].map((s) => (
            <div key={s.ad} className="rounded-lg border border-cizgi bg-zemin/50 p-3">
              <p className="text-[11px] text-solgun">{s.ad}</p>
              <p className="mt-1 flex items-center gap-2">
                <span className="text-xl font-semibold tabular-nums">{s.deger}</span>
                <Rozet ton={s.ton}>{sayac.toplam ? `%${Math.round((s.deger / sayac.toplam) * 100)}` : "—"}</Rozet>
              </p>
            </div>
          ))}
        </div>
      </Kart>

      <Kart
        baslik={`Kazanım listesi (${liste.length})`}
        sag={
          <div className="flex flex-wrap gap-1.5">
            <select
              value={ders}
              onChange={(e) => setDers(e.target.value)}
              className="rounded-md border border-cizgi bg-yuzey px-2 py-1 text-xs"
            >
              <option value="hepsi">Tüm dersler</option>
              {dersRenkleri.map((d) => (
                <option key={d.kod} value={d.kod}>
                  {d.ad}
                </option>
              ))}
            </select>
            <select
              value={durum}
              onChange={(e) => setDurum(e.target.value as DurumFiltre)}
              className="rounded-md border border-cizgi bg-yuzey px-2 py-1 text-xs"
            >
              <option value="hepsi">Tüm durumlar</option>
              <option value="kritik">Kritik</option>
              <option value="gelistirilmeli">Geliştirilmeli</option>
              <option value="kazanildi">Kazanılmış</option>
              <option value="verisiz">Ölçülmemiş</option>
            </select>
            <select
              value={siralama}
              onChange={(e) => setSiralama(e.target.value as typeof siralama)}
              className="rounded-md border border-cizgi bg-yuzey px-2 py-1 text-xs"
            >
              <option value="oncelik">Önceliğe göre</option>
              <option value="ustalik">En düşük ustalık</option>
              <option value="ders">Ders adına göre</option>
            </select>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cizgi text-left text-[11px] text-solgun uppercase">
                <th className="pb-2 font-medium">Ders / Ünite</th>
                <th className="pb-2 font-medium">Kazanım</th>
                <th className="pb-2 text-right font-medium">D / Y / B</th>
                <th className="w-32 pb-2 font-medium">Ustalık</th>
                <th className="pb-2 text-right font-medium">Durum</th>
              </tr>
            </thead>
            <tbody>
              {liste.map((k) => {
                const d = DERSLER[k.kazanim.ders];
                const e = DURUM_ETIKET[k.durum];
                const acik = acikSatir === k.kazanim.id;
                return (
                  <Fragment key={k.kazanim.id}>
                    <tr
                      onClick={() => setAcikSatir(acik ? null : k.kazanim.id)}
                      className="cursor-pointer border-b border-cizgi/60 transition hover:bg-zemin/60"
                    >
                      <td className="py-2.5 align-top">
                        <div className="flex items-center gap-1.5">
                          <span className="size-2 shrink-0 rounded-sm" style={{ background: d.renk }} />
                          <div>
                            <p className="text-xs font-medium">{d.kisaAd}</p>
                            <p className="text-[11px] text-solgun">{k.kazanim.unite}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 align-top">
                        <p className="leading-snug">{k.kazanim.ad}</p>
                        <p className="mt-0.5 text-[11px] text-solgun">
                          {k.kazanim.kod} · ağırlık {k.kazanim.agirlik}/3 · {k.kazanim.zorluk}
                        </p>
                      </td>
                      <td className="py-2.5 text-right align-top text-xs tabular-nums text-solgun">
                        {k.toplam ? `${k.dogru} / ${k.yanlis} / ${k.bos}` : "—"}
                      </td>
                      <td className="py-2.5 align-top">
                        <div className="flex items-center gap-2">
                          <Ilerleme deger={k.ustalik} renk={d.renk} />
                          <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-solgun">
                            {k.toplam ? `%${Math.round(k.ustalik * 100)}` : "—"}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 text-right align-top">
                        <Rozet ton={e.ton}>{e.ad}</Rozet>
                      </td>
                    </tr>
                    {acik && (
                      <tr className="border-b border-cizgi/60 bg-zemin/40">
                        <td colSpan={5} className="px-3 py-2.5">
                          <p className="text-xs leading-relaxed text-solgun">{kazanimYorumu(k)}</p>
                          <p className="mt-1 text-[11px] text-solgun">
                            Öncelik skoru {k.oncelik.toFixed(2)} · işaretlenenlerde isabet %{Math.round(k.isabet * 100)}
                          </p>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        {!liste.length && <Bos mesaj="Bu filtreye uyan kazanım yok." />}
      </Kart>
    </div>
  );
}
