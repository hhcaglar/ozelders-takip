import { NextResponse } from "next/server";
import { z } from "zod";
import { ogrenciBul, programKaydet, programOku, sinavlar } from "@/lib/db";
import { topluKazanimDurumu } from "@/lib/analysis";
import { calismaProgramiUret } from "@/lib/plan";
import { bugunIso } from "@/lib/tarih";

export const dynamic = "force-dynamic";

const sema = z.object({
  ogrenciId: z.string().min(1),
  baslangicTarihi: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih YYYY-AA-GG biçiminde olmalı")
    .optional(),
  haftaSayisi: z.number().int().min(1).max(24).optional(),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ogrenciId = searchParams.get("ogrenciId");
  if (!ogrenciId) return NextResponse.json({ hata: "ogrenciId zorunlu" }, { status: 400 });
  return NextResponse.json({ program: programOku(ogrenciId) });
}

export async function POST(req: Request) {
  const govde = await req.json().catch(() => null);
  const ayristirilan = sema.safeParse(govde);
  if (!ayristirilan.success) {
    return NextResponse.json({ hata: "Geçersiz istek", detay: ayristirilan.error.flatten() }, { status: 400 });
  }
  const { ogrenciId } = ayristirilan.data;
  const ogrenci = ogrenciBul(ogrenciId);
  if (!ogrenci) return NextResponse.json({ hata: "Öğrenci bulunamadı" }, { status: 404 });

  const ogrenciSinavlari = sinavlar(ogrenciId);
  const toplu = ogrenciSinavlari.length ? topluKazanimDurumu(ogrenciSinavlari) : [];
  const program = calismaProgramiUret(
    ogrenci,
    toplu,
    ogrenci.sinavTuru,
    {
      baslangicTarihi: ayristirilan.data.baslangicTarihi ?? bugunIso(),
      haftaSayisi: ayristirilan.data.haftaSayisi ?? 4,
    },
  );
  programKaydet(program);
  return NextResponse.json({ program });
}
