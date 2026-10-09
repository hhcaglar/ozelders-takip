"use client";

import { useState } from "react";
import { Buton } from "./ui";

/** Raporun düz metnini panoya kopyalar, .txt indirir veya yazdırma diyaloğunu açar. */
export default function RaporAraclari({
  duzMetin,
  dosyaAdi,
}: {
  duzMetin: string;
  dosyaAdi: string;
}) {
  const [mesaj, setMesaj] = useState<string | null>(null);

  async function kopyala() {
    try {
      await navigator.clipboard.writeText(duzMetin);
      setMesaj("Rapor panoya kopyalandı — veliye mesaj/e-posta olarak yapıştırabilirsin.");
    } catch {
      setMesaj("Pano erişimi reddedildi. .txt olarak indirebilirsin.");
    }
  }

  function indir() {
    const blob = new Blob([duzMetin], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${dosyaAdi.replaceAll(/\s+/g, "-").toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Buton variant="ikincil" onClick={kopyala}>
        Metni kopyala
      </Buton>
      <Buton variant="ikincil" onClick={indir}>
        .txt indir
      </Buton>
      <Buton onClick={() => window.print()}>Yazdır / PDF</Buton>
      {mesaj && <span className="text-xs text-solgun">{mesaj}</span>}
    </div>
  );
}
