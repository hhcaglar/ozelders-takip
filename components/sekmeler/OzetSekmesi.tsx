"use client";

import type { TrendNokta } from "@/lib/analysis";
import type { KazanimDurumu, Ogrenci, RehberlikSonucu, SinavAnalizi, YorumBlogu } from "@/lib/types";
import { Istatislik, Kart, Rozet, Ilerleme, Bos } from "@/components/ui";
import { NetTrendGrafigi, UstalikGrafigi } from "@/components/Grafikler";

const TON: Record<YorumBlogu["ton"], "olumlu" | "uyari" | "kritik" | "bilgi"> = {
  olumlu: "olumlu",
  uyari: "uyari",
  kritik: "kritik",
  bilgi: "bilgi",
};

export default function OzetSekmesi({
  ogrenci,
  analiz,
  toplu,
  yorumlar,
  rehberlik,
  trend,
  hedefNet,
  ustalikVerisi,
}: {
  ogrenci: Ogrenci;
  analiz: SinavAnalizi | null;
  toplu: KazanimDurumu[];
  yorumlar: YorumBlogu[];
  rehberlik: RehberlikSonucu | null;
  trend: TrendNokta[];
  hedefNet: number | null;
  ustalikVerisi: { ad: string; ustalik: number; kritik: number; toplam: number }[];
}) {
  if (!analiz) {
    return (
      <Bos mesaj="Bu öğrenci için henüz sınav verisi yok. 'Netler' sekmesinden Okulizyon senkronu çalıştır veya karne içe aktar." />
    );
  }

  const kritikSayi = toplu.filter((k) => k.durum === "kritik").length;
  const kazanildi = toplu.filter((k) => k.durum === "kazanildi").length;
  const olculen = toplu.filter((k) => k.durum !== "verisiz").length;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Istatislik
          etiket="Son sınav neti"
          deger={analiz.toplamNet.toFixed(2)}
          alt={`${analiz.toplamDogru} doğru · ${analiz.toplamYanlis} yanlış · ${analiz.toplamBos} boş`}
          ton="bilgi"
        />
        <Istatislik
          etiket="Kazanım ustalığı"
          deger={`%${Math.round(analiz.ustalikOrtalama * 100)}`}
          alt={`${olculen} kazanım ölçüldü`}
          ton={analiz.ustalikOrtalama >= 0.7 ? "olumlu" : analiz.ustalikOrtalama >= 0.5 ? "uyari" : "kritik"}
        />
        <Istatislik
          etiket="Kritik kazanım"
          deger={String(kritikSayi)}
          alt={`${kazanildi} kazanım kazanılmış`}
          ton={kritikSayi === 0 ? "olumlu" : kritikSayi > 8 ? "kritik" : "uyari"}
        />
        <Istatislik
          etiket={rehberlik?.hedefNet ? "Hedef net açığı" : "Hedef"}
          deger={rehberlik ? rehberlik.netAcigi.toFixed(2) : "—"}
          alt={rehberlik?.hedefNet ? `${rehberlik.hedefNet.toFixed(0)} net / ${ogrenci.hedefPuan} puan` : "hedef tanımsız"}
          ton={!rehberlik ? "notr" : rehberlik.netAcigi <= 0.5 ? "olumlu" : rehberlik.netAcigi > 20 ? "kritik" : "uyari"}
        />
      </div>

      <Kart
        baslik="Net trendi"
        altBaslik={`${trend.length} sınav üzerinden. Kesikli çizgi hedef net eşiği.`}
      >
        <NetTrendGrafigi veri={trend} hedefNet={hedefNet} />
      </Kart>

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <Kart
          baslik="Otomatik yorum"
          altBaslik="Her cümle ölçülebilir bir eşikten türetilir; gerekçesi sayısal olarak izlenebilir."
        >
          <div className="space-y-3">
            {yorumlar.map((y, i) => (
              <article key={i} className="rounded-lg border border-cizgi bg-zemin/60 p-3">
                <div className="mb-1.5 flex items-center gap-2">
                  <Rozet ton={TON[y.ton]}>{y.baslik}</Rozet>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-line text-murekkep/90">{y.metin}</p>
              </article>
            ))}
          </div>
        </Kart>

        <div className="space-y-5">
          <Kart baslik="Ders bazlı ustalık" altBaslik="Tüm sınavların ağırlıklı ortalaması (yakın sınavlar daha ağır).">
            {ustalikVerisi.length ? <UstalikGrafigi veri={ustalikVerisi} /> : <Bos mesaj="Ölçülmüş ders yok." />}
          </Kart>

          {rehberlik ? (
            <Kart
              baslik="Rehberlik"
              altBaslik={
                rehberlik.hedefNet
                  ? `Hedefin %${Math.round(rehberlik.hedefeYuzde)}'inde`
                  : "Hedef puan tanımlanmadı"
              }
            >
              {rehberlik.hedefNet ? (
                <div className="mb-3">
                  <Ilerleme
                    deger={rehberlik.hedefeYuzde / 100}
                    renk={rehberlik.netAcigi <= 0.5 ? "#10b981" : "#f59e0b"}
                  />
                  <p className="mt-1.5 text-xs text-solgun">
                    {rehberlik.mevcutNet.toFixed(2)} / {rehberlik.hedefNet.toFixed(0)} net
                    {rehberlik.tahminiSiralama
                      ? ` · tahmini sıralama ~${rehberlik.tahminiSiralama.toLocaleString("tr-TR")}`
                      : ""}
                  </p>
                </div>
              ) : null}

              <div className="space-y-4">
                <div>
                  <h4 className="mb-1.5 text-xs font-semibold text-solgun uppercase">Öneriler</h4>
                  <ul className="space-y-1.5">
                    {rehberlik.oneriler.map((o, i) => (
                      <li key={i} className="flex gap-2 text-sm leading-relaxed">
                        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-emerald-500" />
                        <span>{o}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                {rehberlik.riskler.length ? (
                  <div>
                    <h4 className="mb-1.5 text-xs font-semibold text-solgun uppercase">Riskler</h4>
                    <ul className="space-y-1.5">
                      {rehberlik.riskler.map((o, i) => (
                        <li key={i} className="flex gap-2 text-sm leading-relaxed">
                          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-rose-500" />
                          <span>{o}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </Kart>
          ) : null}
        </div>
      </div>

      {rehberlik?.oncelikSirasi.length ? (
        <Kart
          baslik="Çalışma öncelik sırası"
          altBaslik="Öncelik = müfredat ağırlığı × (1 − ustalık) × ölçüm sıklığı"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-cizgi text-left text-[11px] text-solgun uppercase">
                  <th className="pb-2 font-medium">#</th>
                  <th className="pb-2 font-medium">Ders</th>
                  <th className="pb-2 font-medium">Kazanım</th>
                  <th className="pb-2 text-right font-medium">Ustalık</th>
                  <th className="pb-2 text-right font-medium">Öncelik</th>
                </tr>
              </thead>
              <tbody>
                {rehberlik.oncelikSirasi.map((k, i) => (
                  <tr key={i} className="border-b border-cizgi/60 last:border-0">
                    <td className="py-2 text-solgun tabular-nums">{i + 1}</td>
                    <td className="py-2 whitespace-nowrap">{k.ders}</td>
                    <td className="py-2">{k.kazanimAdi}</td>
                    <td className="py-2 text-right tabular-nums">
                      <span
                        className={
                          k.ustalik < 0.4 ? "text-rose-600" : k.ustalik < 0.75 ? "text-amber-600" : "text-emerald-600"
                        }
                      >
                        %{Math.round(k.ustalik * 100)}
                      </span>
                    </td>
                    <td className="py-2 text-right tabular-nums text-solgun">{k.oncelik.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Kart>
      ) : null}
    </div>
  );
}
