import Link from "next/link";
import { notFound } from "next/navigation";
import { ogrenciBul, programOku, sinavlar } from "@/lib/db";
import { rehberlikRaporuUret, type RaporBolumu } from "@/lib/rapor";
import { Bos, Rozet } from "@/components/ui";
import RaporAraclari from "@/components/RaporAraclari";

export const dynamic = "force-dynamic";

type Baglam = { params: Promise<{ id: string }> };

const VURGU: Record<string, "olumlu" | "uyari" | "kritik" | "notr"> = {
  olumlu: "olumlu",
  uyari: "uyari",
  kritik: "kritik",
};

export default async function RaporSayfasi({ params }: Baglam) {
  const { id } = await params;
  const ogrenci = ogrenciBul(id);
  if (!ogrenci) notFound();

  const ogrenciSinavlari = sinavlar(id);
  const rapor = rehberlikRaporuUret(ogrenci, ogrenciSinavlari, programOku(id));

  return (
    <div className="space-y-5">
      <div className="yazdirma-gizle flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/ogrenci/${id}`}
          className="rounded-lg border border-cizgi px-3 py-1.5 text-sm text-solgun transition hover:bg-zemin"
        >
          ← Panele dön
        </Link>
        {rapor && <RaporAraclari duzMetin={rapor.duzMetin} dosyaAdi={`${ogrenci.ad}-rehberlik-raporu`} />}
      </div>

      {!rapor ? (
        <Bos mesaj="Rapor üretmek için en az bir sınav kaydı gerekli. Panelin 'Netler' sekmesinden senkron çalıştır veya karne içe aktar." />
      ) : (
        <article className="mx-auto max-w-[860px] rounded-xl border border-cizgi bg-yuzey p-8 shadow-sm print:border-0 print:p-0 print:shadow-none">
          <header className="border-b-2 border-murekkep pb-4">
            <h1 className="text-lg font-semibold leading-snug">{rapor.baslik}</h1>
            <p className="mt-1 text-xs text-solgun">Kapsanan dönem: {rapor.donem}</p>
          </header>

          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-4">
            {rapor.kunye.map((k) => (
              <div key={k.etiket}>
                <dt className="text-[11px] text-solgun uppercase">{k.etiket}</dt>
                <dd className="font-medium">{k.deger}</dd>
              </div>
            ))}
          </dl>

          {rapor.bolumler.map((b) => (
            <Bolum key={b.baslik} bolum={b} />
          ))}

          <footer className="mt-8 grid grid-cols-2 gap-8 border-t border-cizgi pt-6 text-xs text-solgun">
            <div>
              <p className="mb-8 font-medium text-murekkep">Rehber Öğretmen</p>
              <p className="border-t border-murekkep pt-1">İmza / Tarih</p>
            </div>
            <div>
              <p className="mb-8 font-medium text-murekkep">Veli</p>
              <p className="border-t border-murekkep pt-1">İmza / Tarih</p>
            </div>
          </footer>

          <p className="mt-6 border-t border-cizgi pt-3 text-[11px] leading-relaxed text-solgun">
            Ölçüm tabanı: {rapor.kaynak.sinavSayisi} sınav, {rapor.kaynak.olculenKazanim}/
            {rapor.kaynak.toplamKazanim} kazanım ölçüldü, son net {rapor.kaynak.sonNet.toFixed(2)}
            {rapor.kaynak.hedefNet ? `, hedef net ~${rapor.kaynak.hedefNet.toFixed(0)}` : ""}. Puan ve sıralama
            değerleri yaklaşıktır; ÖSYM/MEB resmî hesaplamasında standart puan (T-puan) dönüşümü kullanılır.
          </p>
        </article>
      )}
    </div>
  );
}

function Bolum({ bolum }: { bolum: RaporBolumu }) {
  return (
    <section className="mt-6">
      <h2 className="text-sm font-semibold text-murekkep">{bolum.baslik}</h2>
      {bolum.ozet && <p className="mt-0.5 text-xs text-solgun">{bolum.ozet}</p>}

      {bolum.paragraflar.map((p, i) => (
        <p key={i} className="mt-2 text-[13px] leading-relaxed text-murekkep/90">
          {p}
        </p>
      ))}

      {bolum.tablo && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="bg-zemin">
                {bolum.tablo.basliklar.map((b) => (
                  <th key={b} className="border border-cizgi px-2 py-1.5 text-left font-medium text-solgun">
                    {b}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bolum.tablo.satirlar.map((s, i) => (
                <tr key={i}>
                  {s.map((hucre, j) => (
                    <td key={j} className="border border-cizgi px-2 py-1.5 align-top leading-snug">
                      {hucre}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {bolum.liste && bolum.liste.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {bolum.liste.map((l, i) => (
            <li key={i} className="flex items-start gap-2 text-[13px] leading-relaxed">
              <Rozet ton={VURGU[l.vurgu ?? "notr"] ?? "notr"}>•</Rozet>
              <span>{l.madde}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
