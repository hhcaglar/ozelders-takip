import { NextResponse } from "next/server";
import { ogrenciEkle, ogrenciler } from "@/lib/db";
import { OGRENCI_SEMASI } from "@/lib/ogrenci-sema";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ogrenciler: ogrenciler() });
}

export async function POST(req: Request) {
  const govde = await req.json().catch(() => null);
  const ayristirilan = OGRENCI_SEMASI.safeParse(govde);
  if (!ayristirilan.success) {
    return NextResponse.json(
      { hata: "Geçersiz öğrenci bilgisi", detay: ayristirilan.error.flatten() },
      { status: 400 },
    );
  }
  return NextResponse.json({ ogrenci: ogrenciEkle(ayristirilan.data) }, { status: 201 });
}
