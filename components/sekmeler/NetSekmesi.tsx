"use client";

import { dersYorumu } from "@/lib/yorum";
import { uzunTarih } from "@/lib/tarih";
import type { Sinav, SinavAnalizi } from "@/lib/types";
import { Buton, Ilerleme, Kart, Rozet, Bos } from "@/components/ui";
import { DersNetGrafigi } from "@/components/Grafikler";
import SenkronPanel from "@/components/SenkronPanel";
import IceAktarmaPanel from "@/components/IceAktarmaPanel";

export default function NetSekmesi({
  ogrenciId,
  analiz,
  dersTrend,
  dersRenkleri,
  sinavlar,
}: {
  ogrenciId: string;
  analiz: SinavAnalizi | null;
  dersTrend: Record<string, number | string>[];
  dersRenkleri: { ad: string; renk: string }[];
  sinavlar: Sinav[];
}) {
  async function sinavSil(id: string) {
    if (!confirm("Bu sınav kaydını silmek istiyor musun?")) return;
    await fetch(`/api/exams?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    location.reload();
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <Kart
            baslik="Ders bazlı netler"
            altBaslik={
              analiz
                ? `${analiz.sinav.baslik} · ${uzunTarih(analiz.sinav.tarih)}${analiz.sinav.yayinevi ? ` · ${analiz.sinav.yayinevi}` : ""}`
                : "Sınav verisi yok"
            }
          >
            {analiz ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-cizgi text-left text-[11px] text-solgun uppercase">
                      <th className="pb-2 font-medium">Ders</th>
                      <th className="pb-2 text-right font-medium">D</th>
                      <th className="pb-2 text-right font-medium">Y</th>
                      <th className="pb-2 text-right font-medium">B</th>
                      <th className="pb-2 text-right font-medium">Net</th>
                      <th className="pb-2 text-right font-medium">Değişim</th>
                      <th className="w-28 pb-2 font-medium">Verim</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analiz.dersler.map((d) => (
                      <tr key={d.ders.kod} className="border-b border-cizgi/60 last:border-0">
                        <td className="py-2.5">
                          <div className="flex items-center gap-2">
                            <span
                              className="size-2.5 shrink-0 rounded-sm"
                              style={{ background: d.ders.renk }}
                            />
                            <div>
                              <p className="font-medium">{d.ders.kisaAd}</p>
                              <p className="text-[11px] text-solgun">{dersYorumu(d)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="text-right tabular-nums text-emerald-700">{d.dogru}</td>
                        <td className="text-right tabular-nums text-rose-600">{d.yanlis}</td>
                        <td className="text-right tabular-nums text-solgun">{d.bos}</td>
                        <td className="text-right font-semibold tabular-nums">{d.net.toFixed(2)}</td>
                        <td className="text-right tabular-nums">
                          {d.netDegisim === null ? (
                            <span className="text-solgun">—</span>
                          ) : (
                            <span className={d.netDegisim > 0 ? "text-emerald-600" : d.netDegisim < 0 ? "text-rose-600" : "text-solgun"}>
                              {d.netDegisim > 0 ? "+" : ""}
                              {d.netDegisim.toFixed(2)}
                            </span>
                          )}
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <Ilerleme deger={d.verim} renk={d.ders.renk} />
                            <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-solgun">
                              %{Math.round(d.verim * 100)}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t border-cizgi font-semibold">
                      <td className="pt-2.5">Toplam</td>
                      <td className="pt-2.5 text-right tabular-nums">{analiz.toplamDogru}</td>
                      <td className="pt-2.5 text-right tabular-nums">{analiz.toplamYanlis}</td>
                      <td className="pt-2.5 text-right tabular-nums">{analiz.toplamBos}</td>
                      <td className="pt-2.5 text-right tabular-nums">{analiz.toplamNet.toFixed(2)}</td>
                      <td colSpan={2} className="pt-2.5 text-right text-[11px] font-normal text-solgun">
                        tavan oranı %{Math.round(tavanYuzde(analiz))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <Bos mesaj="Sınav kaydı yok." />
            )}
          </Kart>

          <Kart baslik="Ders netlerinin sınavlar arası seyri" altBaslik="Her çubuk o sınavdaki ders neti.">
            {dersTrend.length ? (
              <DersNetGrafigi veri={dersTrend} dersler={dersRenkleri} />
            ) : (
              <Bos mesaj="Grafik için en az bir sınav gerekli." />
            )}
          </Kart>

          <Kart baslik={`Sınav kayıtları (${sinavlar.length})`} altBaslik="En yeni üstte.">
            {sinavlar.length ? (
              <ul className="divide-y divide-cizgi/60">
                {sinavlar.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium">{s.baslik}</p>
                      <p className="text-[11px] text-solgun">
                        {uzunTarih(s.tarih)}
                        {s.yayinevi ? ` · ${s.yayinevi}` : ""} · {s.sorular.length} soru kaydı
                        {s.genelSiralama ? ` · sıralama ${s.genelSiralama.toLocaleString("tr-TR")}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Rozet ton={s.kaynak === "okulizyon" ? "bilgi" : s.kaynak === "demo" ? "notr" : "uyari"}>
                        {s.kaynak}
                      </Rozet>
                      <Buton variant="tehlike" onClick={() => sinavSil(s.id)}>
                        Sil
                      </Buton>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Bos mesaj="Henüz sınav yok." />
            )}
          </Kart>
        </div>

        <div className="space-y-5">
          <SenkronPanel ogrenciId={ogrenciId} />
          <IceAktarmaPanel ogrenciId={ogrenciId} />
        </div>
      </div>
    </div>
  );
}

function tavanYuzde(a: SinavAnalizi): number {
  return Math.round(a.netTavanOrani * 100);
}
