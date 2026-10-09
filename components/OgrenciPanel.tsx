"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { TrendNokta } from "@/lib/analysis";
import type {
  CalismaProgrami,
  KazanimDurumu,
  Ogrenci,
  RehberlikSonucu,
  Sinav,
  SinavAnalizi,
  YorumBlogu,
} from "@/lib/types";
import { Rozet } from "./ui";
import OzetSekmesi from "./sekmeler/OzetSekmesi";
import NetSekmesi from "./sekmeler/NetSekmesi";
import KazanimSekmesi from "./sekmeler/KazanimSekmesi";
import ProgramSekmesi from "./sekmeler/ProgramSekmesi";
import OgrenciDuzenle from "./OgrenciDuzenle";

const SEKMELER = [
  { id: "ozet", ad: "Özet & Yorum" },
  { id: "netler", ad: "Netler" },
  { id: "kazanimlar", ad: "Kazanımlar" },
  { id: "program", ad: "Çalışma Programı" },
] as const;

type SekmeId = (typeof SEKMELER)[number]["id"];

export interface PanelVerisi {
  ogrenci: Ogrenci;
  sinavlar: Sinav[];
  analiz: SinavAnalizi | null;
  toplu: KazanimDurumu[];
  yorumlar: YorumBlogu[];
  rehberlik: RehberlikSonucu | null;
  trend: TrendNokta[];
  dersTrend: Record<string, number | string>[];
  dersRenkleri: { ad: string; renk: string; kod: string }[];
  hedefNet: number | null;
  ustalikVerisi: { ad: string; ustalik: number; kritik: number; toplam: number }[];
  program: CalismaProgrami | null;
}

export default function OgrenciPanel(veri: PanelVerisi) {
  const aramaParametreleri = useSearchParams();
  const istenen = aramaParametreleri.get("sekme") as SekmeId | null;
  const [sekme, setSekme] = useState<SekmeId>(
    istenen && SEKMELER.some((s) => s.id === istenen) ? istenen : "ozet",
  );
  const { ogrenci } = veri;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold">{ogrenci.ad}</h1>
            <Rozet ton="bilgi">{ogrenci.sinavTuru}</Rozet>
            <Rozet>{ogrenci.sinifSeviyesi}. sınıf</Rozet>
            {ogrenci.hedefPuan ? <Rozet ton="notr">hedef {ogrenci.hedefPuan} puan</Rozet> : null}
            {ogrenci.hedefSiralama ? (
              <Rozet ton="notr">hedef sıralama {ogrenci.hedefSiralama.toLocaleString("tr-TR")}</Rozet>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-solgun">
            {ogrenci.okul ? `${ogrenci.okul} · ` : ""}haftalık {ogrenci.haftalikSaat} saat ·{" "}
            {ogrenci.blokDakika} dk blok · {ogrenci.calismaGunleri.length} çalışma günü
            {ogrenci.okulizyonOgrenciNo ? ` · Okulizyon no ${ogrenci.okulizyonOgrenciNo}` : ""}
          </p>
        </div>
        <div className="yazdirma-gizle flex flex-wrap gap-2">
          <OgrenciDuzenle ogrenci={ogrenci} />
          <Link
            href={`/ogrenci/${ogrenci.id}/rapor`}
            className="rounded-lg bg-vurgu px-3 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-700"
          >
            Rapor yaz
          </Link>
          <Link
            href="/"
            className="rounded-lg border border-cizgi px-3 py-1.5 text-sm text-solgun transition hover:bg-zemin"
          >
            ← Öğrenciler
          </Link>
        </div>
      </div>

      <nav className="yazdirma-gizle flex flex-wrap gap-1 border-b border-cizgi">
        {SEKMELER.map((s) => (
          <button
            key={s.id}
            onClick={() => setSekme(s.id)}
            className={
              sekme === s.id
                ? "-mb-px border-b-2 border-vurgu px-3 py-2 text-sm font-semibold text-vurgu"
                : "-mb-px border-b-2 border-transparent px-3 py-2 text-sm text-solgun transition hover:text-murekkep"
            }
          >
            {s.ad}
          </button>
        ))}
      </nav>

      {sekme === "ozet" && (
        <OzetSekmesi
          ogrenci={veri.ogrenci}
          analiz={veri.analiz}
          toplu={veri.toplu}
          yorumlar={veri.yorumlar}
          rehberlik={veri.rehberlik}
          trend={veri.trend}
          hedefNet={veri.hedefNet}
          ustalikVerisi={veri.ustalikVerisi}
        />
      )}
      {sekme === "netler" && (
        <NetSekmesi
          ogrenciId={ogrenci.id}
          analiz={veri.analiz}
          dersTrend={veri.dersTrend}
          dersRenkleri={veri.dersRenkleri}
          sinavlar={veri.sinavlar}
        />
      )}
      {sekme === "kazanimlar" && <KazanimSekmesi toplu={veri.toplu} dersRenkleri={veri.dersRenkleri} />}
      {sekme === "program" && <ProgramSekmesi ogrenci={ogrenci} baslangic={veri.program} />}
    </div>
  );
}
