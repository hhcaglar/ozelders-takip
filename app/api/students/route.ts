import { NextResponse } from "next/server";
import { z } from "zod";
import { ogrenciEkle, ogrenciler } from "@/lib/db";

export const dynamic = "force-dynamic";

const sema = z.object({
  ad: z.string().min(2, "Ad en az 2 karakter olmalı"),
  sinifSeviyesi: z.string().optional(),
  sinavTuru: z.enum(["TYT", "AYT", "LGS"]),
  /** AYT alanı. Yalnızca AYT için anlamlı; verilmezse Sayısal kabul edilir. */
  aytAlani: z.enum(["SAY", "EA", "SOZ"]).optional(),
  okul: z.string().optional(),
  okulizyonOgrenciNo: z.string().optional(),
  hedefPuan: z.number().min(0).max(600).optional(),
  hedefSiralama: z.number().int().positive().optional(),
  haftalikSaat: z.number().min(1).max(80),
  calismaGunleri: z.array(z.number().int().min(0).max(6)).min(1),
  blokDakika: z.number().int().min(20).max(120),
});

export async function GET() {
  return NextResponse.json({ ogrenciler: ogrenciler() });
}

export async function POST(req: Request) {
  const govde = await req.json().catch(() => null);
  const ayristirilan = sema.safeParse(govde);
  if (!ayristirilan.success) {
    return NextResponse.json(
      { hata: "Geçersiz öğrenci bilgisi", detay: ayristirilan.error.flatten() },
      { status: 400 },
    );
  }
  return NextResponse.json({ ogrenci: ogrenciEkle(ayristirilan.data) }, { status: 201 });
}
