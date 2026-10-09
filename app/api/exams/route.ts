import { NextResponse } from "next/server";
import { sinavlar, sinavSil } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ogrenciId = searchParams.get("ogrenciId");
  if (!ogrenciId) return NextResponse.json({ hata: "ogrenciId zorunlu" }, { status: 400 });
  const liste = sinavlar(ogrenciId).sort((a, b) => b.tarih.localeCompare(a.tarih));
  return NextResponse.json({ sinavlar: liste });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ hata: "id zorunlu" }, { status: 400 });
  return NextResponse.json({ silindi: sinavSil(id) });
}
