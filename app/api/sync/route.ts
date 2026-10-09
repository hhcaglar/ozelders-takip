import { NextResponse } from "next/server";
import { z } from "zod";
import { baglantiAyari, baglantiKaydet, ogrenciBul, sinavKaydet } from "@/lib/db";
import { adapterSec } from "@/lib/okulizyon/adapter";
import { karneListesiHazirla } from "@/lib/okulizyon/import";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const sema = z.object({
  ogrenciId: z.string().min(1),
  /** Şifre yalnızca bu istek süresince bellekte kalır, diske yazılmaz. */
  sifre: z.string().optional(),
  sinavSayisi: z.number().int().min(1).max(12).optional(),
});

export async function POST(req: Request) {
  const govde = await req.json().catch(() => null);
  const ayristirilan = sema.safeParse(govde);
  if (!ayristirilan.success) {
    return NextResponse.json({ hata: "Geçersiz istek", detay: ayristirilan.error.flatten() }, { status: 400 });
  }
  const { ogrenciId, sifre, sinavSayisi } = ayristirilan.data;

  const ogrenci = ogrenciBul(ogrenciId);
  if (!ogrenci) return NextResponse.json({ hata: "Öğrenci bulunamadı" }, { status: 404 });

  const ayar = baglantiAyari();
  const adapter = adapterSec(ayar);
  const simdi = new Date().toISOString();

  try {
    const { karneler, mesaj } = await adapter.senkron({
      ogrenci,
      ogrenciId,
      sinavTuru: ogrenci.sinavTuru,
      ayar,
      sifre,
      sinavSayisi,
    });

    const sinavlar = karneListesiHazirla(karneler, ogrenci.sinavTuru, ogrenciId, `${adapter.ad}:${simdi}`);
    const sonuc = sinavKaydet(sinavlar);
    baglantiKaydet({ sonSenkron: simdi, sonSenkronDurum: "basarili", sonSenkronMesaj: mesaj });

    return NextResponse.json({
      mesaj,
      eklenen: sonuc.eklenen,
      guncellenen: sonuc.guncellenen,
      toplamKarne: karneler.length,
      sinavlar,
    });
  } catch (hata) {
    const mesaj = hata instanceof Error ? hata.message : "Bilinmeyen senkron hatası";
    baglantiKaydet({ sonSenkron: simdi, sonSenkronDurum: "hata", sonSenkronMesaj: mesaj });
    return NextResponse.json({ hata: mesaj, mod: adapter.ad }, { status: 502 });
  }
}
