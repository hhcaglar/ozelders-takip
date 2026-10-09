"use client";

import { useMemo, useState } from "react";
import { gunlereGoreGrupla, icsUret, tipAdi, TIP_RENK } from "@/lib/plan";
import { bugunIso, dakikaSaat, uzunTarih } from "@/lib/tarih";
import type { BlokTipi, CalismaProgrami, Ogrenci } from "@/lib/types";
import { Alan, Bos, Buton, Ilerleme, Kart, Rozet, girisSinifi } from "@/components/ui";

export default function ProgramSekmesi({
  ogrenci,
  baslangic,
}: {
  ogrenci: Ogrenci;
  baslangic: CalismaProgrami | null;
}) {
  const [program, setProgram] = useState<CalismaProgrami | null>(baslangic);
  const [tarih, setTarih] = useState(baslangic?.baslangicTarihi ?? bugunIso());
  const [hafta, setHafta] = useState(baslangic?.haftaSayisi ?? 4);
  const [calisiyor, setCalisiyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [tamamlananlar, setTamamlananlar] = useState<Set<string>>(
    () => new Set((baslangic?.bloklar ?? []).filter((b) => b.tamamlandi).map((b) => b.id)),
  );

  const gunler = useMemo(() => (program ? gunlereGoreGrupla(program) : []), [program]);

  async function uret() {
    setCalisiyor(true);
    setHata(null);
    try {
      const cevap = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ogrenciId: ogrenci.id, baslangicTarihi: tarih, haftaSayisi: hafta }),
      });
      const veri = await cevap.json();
      if (!cevap.ok) throw new Error(veri.hata ?? "Program üretilemedi");
      setProgram(veri.program);
      setTamamlananlar(new Set());
    } catch (h) {
      setHata(h instanceof Error ? h.message : "Beklenmeyen hata");
    } finally {
      setCalisiyor(false);
    }
  }

  function icsIndir() {
    if (!program) return;
    const blob = new Blob([icsUret(program, ogrenci.ad)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `calisma-programi-${ogrenci.ad.replaceAll(/\s+/g, "-").toLowerCase()}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function blokDegistir(id: string) {
    setTamamlananlar((once) => {
      const yeni = new Set(once);
      if (yeni.has(id)) yeni.delete(id);
      else yeni.add(id);
      return yeni;
    });
  }

  const toplamBlok = program?.bloklar.length ?? 0;
  const tamamlananSayi = tamamlananlar.size;
  const haftaGruplari = useMemo<[number, typeof gunler][]>(() => {
    const m = new Map<number, typeof gunler>();
    if (!program) return [];
    for (const g of gunler) {
      const haftaNo = Math.floor(
        (new Date(g.tarih).getTime() - new Date(program.baslangicTarihi).getTime()) / (7 * 86400000),
      );
      const l = m.get(haftaNo) ?? [];
      l.push(g);
      m.set(haftaNo, l);
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [gunler, program]);

  return (
    <div className="space-y-5">
      <Kart
        baslik="Çalışma programı üret"
        altBaslik="Eksik kazanımlar öncelik skoruna göre haftalık bloklara dağıtılır; kritik kazanımlara 1-3-7 gün aralıklı tekrar eklenir."
      >
        <div className="grid gap-3 sm:grid-cols-[1fr_140px_auto] sm:items-end">
          <Alan etiket="Başlangıç tarihi">
            <input
              type="date"
              className={girisSinifi}
              value={tarih}
              onChange={(e) => setTarih(e.target.value)}
            />
          </Alan>
          <Alan etiket="Hafta sayısı">
            <input
              type="number"
              className={girisSinifi}
              min={1}
              max={24}
              value={hafta}
              onChange={(e) => setHafta(Number(e.target.value))}
            />
          </Alan>
          <div className="flex gap-2">
            <Buton onClick={uret} disabled={calisiyor}>
              {calisiyor ? "Üretiliyor…" : program ? "Yeniden üret" : "Programı oluştur"}
            </Buton>
            {program && (
              <>
                <Buton variant="ikincil" onClick={icsIndir}>
                  Takvime aktar (.ics)
                </Buton>
                <Buton variant="ikincil" onClick={() => window.print()}>
                  Yazdır
                </Buton>
              </>
            )}
          </div>
        </div>
        {hata && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">{hata}</p>}
        <p className="mt-3 text-[11px] leading-relaxed text-solgun">
          Program öğrencinin haftalık {ogrenci.haftalikSaat} saatine ve {ogrenci.blokDakika} dakikalık blok
          tercihine göre kurulur. Hafta içi bloklar 17:00, hafta sonu 10:00 başlangıçlı planlanır.
        </p>
      </Kart>

      {!program ? (
        <Bos mesaj="Henüz program yok. Yukarıdan başlangıç tarihi ve hafta sayısını seçip 'Programı oluştur' de." />
      ) : (
        <>
          <Kart
            baslik="Program özeti"
            sag={
              toplamBlok ? (
                <Rozet ton={tamamlananSayi === toplamBlok ? "olumlu" : "bilgi"}>
                  {tamamlananSayi}/{toplamBlok} blok tamamlandı
                </Rozet>
              ) : null
            }
          >
            <ul className="space-y-1.5">
              {program.ozet.map((s, i) => (
                <li key={i} className="flex gap-2 text-sm leading-relaxed">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-vurgu" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
            {toplamBlok ? (
              <div className="mt-3">
                <Ilerleme
                  deger={tamamlananSayi / toplamBlok}
                  renk={tamamlananSayi / toplamBlok >= 0.8 ? "#10b981" : "#4f46e5"}
                />
              </div>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(Object.keys(TIP_RENK) as BlokTipi[]).map((t) => (
                <span key={t} className="flex items-center gap-1.5 text-[11px] text-solgun">
                  <span className="size-2.5 rounded-sm" style={{ background: TIP_RENK[t] }} />
                  {tipAdi(t)}
                </span>
              ))}
            </div>
          </Kart>

          {haftaGruplari.map(([haftaNo, haftaGunleri]) => (
            <Kart key={haftaNo} baslik={`${haftaNo + 1}. hafta`} altBaslik={`${haftaGunleri.length} çalışma günü`}>
              <div className="space-y-4">
                {haftaGunleri.map((g) => (
                  <div key={g.tarih}>
                    <div className="mb-1.5 flex items-baseline justify-between border-b border-cizgi pb-1">
                      <p className="text-xs font-semibold">
                        {g.gunAdi} · {uzunTarih(g.tarih)}
                      </p>
                      <p className="text-[11px] text-solgun">
                        {g.bloklar.length} blok · {dakikaSaat(g.toplamDakika)}
                      </p>
                    </div>
                    <ul className="space-y-1">
                      {g.bloklar.map((b) => {
                        const tamam = tamamlananlar.has(b.id);
                        return (
                          <li
                            key={b.id}
                            className={`flex items-start gap-2.5 rounded-lg border px-3 py-2 transition ${
                              tamam ? "border-emerald-200 bg-emerald-50/50" : "border-cizgi bg-zemin/40"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={tamam}
                              onChange={() => blokDegistir(b.id)}
                              className="mt-1 size-3.5 shrink-0 accent-indigo-600"
                            />
                            <span
                              className="mt-1 size-2.5 shrink-0 rounded-sm"
                              style={{ background: TIP_RENK[b.tip] }}
                            />
                            <div className="min-w-0 flex-1">
                              <p
                                className={`text-sm font-medium ${tamam ? "text-solgun line-through" : ""}`}
                              >
                                {b.baslik}
                              </p>
                              <p className="text-[11px] leading-relaxed text-solgun">{b.detay}</p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-xs font-medium tabular-nums">{b.baslangic}</p>
                              <p className="text-[11px] text-solgun">{dakikaSaat(b.dakika)}</p>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </Kart>
          ))}
        </>
      )}
    </div>
  );
}
