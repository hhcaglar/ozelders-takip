import { notFound } from "next/navigation";
import { ogrenciBul, programOku, sinavlar } from "@/lib/db";
import { derslerOf } from "@/lib/data/dersler";
import { kazanimlarOf } from "@/lib/data/kazanimlar";
import { dersTrendi, netTrendi, sinavAnalizi, topluKazanimDurumu } from "@/lib/analysis";
import { siniflandir } from "@/lib/rehberlik-core";
import { rehberlikRaporu } from "@/lib/rehberlik";
import { sinavYorumu } from "@/lib/yorum";
import type { YorumBlogu } from "@/lib/types";
import OgrenciPanel from "@/components/OgrenciPanel";

export const dynamic = "force-dynamic";

type Baglam = { params: Promise<{ id: string }> };

export default async function OgrenciSayfasi({ params }: Baglam) {
  const { id } = await params;
  const ogrenci = ogrenciBul(id);
  if (!ogrenci) notFound();

  const ogrenciSinavlari = sinavlar(id).sort((a, b) => b.tarih.localeCompare(a.tarih));
  const son = ogrenciSinavlari[0];
  const onceki = ogrenciSinavlari[1];
  const analiz = son ? sinavAnalizi(son, onceki) : null;
  const oncekiAnaliz = onceki ? sinavAnalizi(onceki) : null;

  const toplu = ogrenciSinavlari.length ? topluKazanimDurumu(ogrenciSinavlari) : [];
  const rehberlikPaketi = ogrenciSinavlari.length ? rehberlikRaporu(ogrenci, ogrenciSinavlari) : null;
  const hedef = analiz ? siniflandir(ogrenci, analiz, toplu) : null;

  const yorumlar: YorumBlogu[] = analiz ? sinavYorumu(ogrenci, analiz, onceki, oncekiAnaliz, toplu) : [];

  const kazanimSayisi = derslerOf(ogrenci.sinavTuru).reduce((t, d) => t + kazanimlarOf(d.kod).length, 0);

  const dersRenkleri = derslerOf(ogrenci.sinavTuru).map((d) => ({
    ad: d.kisaAd,
    renk: d.renk,
    kod: d.kod,
  }));

  // Ders bazlı ustalık özeti (grafik için).
  const ustalikVerisi = derslerOf(ogrenci.sinavTuru).map((d) => {
    const k = toplu.filter((x) => x.kazanim.ders === d.kod);
    const olculen = k.filter((x) => x.durum !== "verisiz");
    const toplamSoru = olculen.reduce((t, x) => t + x.toplam, 0);
    const ustalik = toplamSoru ? olculen.reduce((t, x) => t + x.ustalik * x.toplam, 0) / toplamSoru : 0;
    return {
      ad: d.kisaAd,
      ustalik: Math.round(ustalik * 1000) / 1000,
      kritik: k.filter((x) => x.durum === "kritik").length,
      toplam: olculen.length,
    };
  });

  return (
    <>
      {!ogrenciSinavlari.length && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Bu öğrenci için kayıtlı sınav yok. “Netler” sekmesinden Okulizyon senkronunu çalıştır veya karne içe
          aktar; analiz, yorum, kazanım kıyaslaması ve çalışma programı verisi geldikten sonra otomatik dolar.
        </p>
      )}
      <OgrenciPanel
        ogrenci={ogrenci}
        sinavlar={ogrenciSinavlari}
        analiz={analiz}
        toplu={toplu}
        yorumlar={yorumlar}
        rehberlik={rehberlikPaketi?.rehberlik ?? null}
        trend={netTrendi(ogrenciSinavlari)}
        dersTrend={dersTrendi(ogrenciSinavlari)}
        dersRenkleri={dersRenkleri}
        hedefNet={hedef?.hedefNet ?? null}
        ustalikVerisi={ustalikVerisi}
        program={programOku(id)}
      />
      <p className="mt-6 text-[11px] leading-relaxed text-solgun">
        Kazanım etiketleri Okulizyon'daki soru-kazanım eşleşmesinden türetilir; katalogla eşleşmeyen metinler
        yanlış etiketlenmek yerine boş bırakılır. Hiç ölçülmemiş kazanımlar “ölçülmedi” olarak kalır ve çalışma
        programında kör nokta riski olarak raporlanır. Bu panel {ogrenci.sinavTuru} için{" "}
        {derslerOf(ogrenci.sinavTuru).length} derste {kazanimSayisi} kazanımı izler.
      </p>
    </>
  );
}
