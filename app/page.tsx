import Link from "next/link";
import { ogrenciler, sinavlar, baglantiAyari } from "@/lib/db";
import { sinavNet, sinavAnalizi } from "@/lib/analysis";
import { puandanNet } from "@/lib/rehberlik-core";
import { uzunTarih } from "@/lib/tarih";
import { Bos, Ilerleme, Kart, Rozet } from "@/components/ui";
import YeniOgrenci from "@/components/YeniOgrenci";
import { katalogBoyutu } from "@/lib/data/kazanimlar";

export const dynamic = "force-dynamic";

export default function AnaSayfa() {
  const liste = ogrenciler();
  const baglanti = baglantiAyari();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Öğrenciler</h1>
          <p className="mt-1 text-sm text-solgun">
            Okulizyon'dan çekilen netleri yorumla, kazanımlarla kıyasla ve haftalık çalışma programı üret.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Rozet ton={baglanti.aktif ? "olumlu" : "notr"}>
            Bağlantı: {baglanti.aktif ? "aktif" : "pasif"} · mod {baglanti.mod === "http" ? "gerçek istek" : "demo"}
          </Rozet>
          <Rozet ton="bilgi">Kazanım kataloğu: {katalogBoyutu()} kazanım</Rozet>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          {liste.length === 0 && (
            <Bos mesaj="Henüz öğrenci yok. Sağdaki formdan ilk öğrenciyi ekle, ardından Okulizyon bağlantısından veya içe aktarmadan netleri getir." />
          )}
          {liste.map((o) => {
            const ogrenciSinavlari = sinavlar(o.id).sort((a, b) => a.tarih.localeCompare(b.tarih));
            const son = ogrenciSinavlari[ogrenciSinavlari.length - 1];
            const analiz = son ? sinavAnalizi(son) : null;
            const hedefNet = o.hedefPuan ? puandanNet(o.sinavTuru, o.hedefPuan, son) : null;
            const net = son ? sinavNet(son) : 0;
            const oran = hedefNet ? Math.min(1, net / hedefNet) : 0;

            return (
              <Link
                key={o.id}
                href={`/ogrenci/${o.id}`}
                className="block rounded-xl border border-cizgi bg-yuzey p-4 shadow-sm transition hover:border-vurgu hover:shadow-md"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{o.ad}</h3>
                      <Rozet ton="bilgi">{o.sinavTuru}</Rozet>
                      <Rozet>{o.sinifSeviyesi}. sınıf</Rozet>
                      {o.hedefPuan ? <Rozet ton="notr">hedef {o.hedefPuan} puan</Rozet> : null}
                    </div>
                    <p className="mt-1 text-xs text-solgun">
                      {ogrenciSinavlari.length} sınav kayıtlı
                      {son ? ` · son sınav ${uzunTarih(son.tarih)} (${son.baslik})` : " · henüz sınav yok"}
                      {o.okul ? ` · ${o.okul}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-semibold tabular-nums">{net.toFixed(2)}</p>
                    <p className="text-[11px] text-solgun">
                      {hedefNet ? `hedef ${hedefNet.toFixed(0)} net` : "hedef tanımsız"}
                    </p>
                  </div>
                </div>
                {hedefNet ? (
                  <div className="mt-3">
                    <Ilerleme deger={oran} renk={oran >= 1 ? "#10b981" : oran >= 0.8 ? "#f59e0b" : "#ef4444"} />
                    <p className="mt-1 text-[11px] text-solgun">
                      Hedefin %{Math.round(oran * 100)}'inde
                      {analiz ? ` · ustalık ortalaması %${Math.round(analiz.ustalikOrtalama * 100)}` : ""}
                    </p>
                  </div>
                ) : null}
              </Link>
            );
          })}
        </div>

        <div className="space-y-4">
          <Kart baslik="Yeni öğrenci" altBaslik="Hedef puan girildiğinde net açığı otomatik hesaplanır.">
            <YeniOgrenci />
          </Kart>
          <Kart baslik="Nasıl çalışır?" altBaslik="Veri akışı dört adımda işler.">
            <ol className="space-y-2.5 text-sm text-solgun">
              {[
                "Okulizyon bağlantısı (veya CSV/JSON içe aktarma) öğrencinin karne ve optik sonuçlarını getirir.",
                "Sorular kazanım kataloğuyla eşleştirilir; ders bazlı net ve kazanım bazlı ustalık hesaplanır.",
                "Kural tabanlı yorum motoru güçlü/zayıf alanları, yanlış-boş davranışını ve hedef açığını yazar.",
                "Program üretici eksik kazanımları öncelik skoruna göre haftalık bloklara dağıtır (1-3-7 gün tekrar).",
              ].map((s, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-indigo-50 text-[11px] font-semibold text-vurgu">
                    {i + 1}
                  </span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          </Kart>
        </div>
      </div>
    </div>
  );
}
