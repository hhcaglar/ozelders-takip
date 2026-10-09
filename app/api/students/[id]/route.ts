import { NextResponse } from "next/server";
import { ogrenciBul, ogrenciGuncelle, ogrenciSil, programSil } from "@/lib/db";
import type { Ogrenci } from "@/lib/types";

export const dynamic = "force-dynamic";

type Baglam = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Baglam) {
  const { id } = await params;
  const o = ogrenciBul(id);
  if (!o) return NextResponse.json({ hata: "Öğrenci bulunamadı" }, { status: 404 });
  return NextResponse.json({ ogrenci: o });
}

export async function PATCH(req: Request, { params }: Baglam) {
  const { id } = await params;
  const degisiklik = (await req.json().catch(() => ({}))) as Partial<Ogrenci>;
  delete degisiklik.id;
  const guncel = ogrenciGuncelle(id, degisiklik);
  if (!guncel) return NextResponse.json({ hata: "Öğrenci bulunamadı" }, { status: 404 });
  return NextResponse.json({ ogrenci: guncel });
}

export async function DELETE(_req: Request, { params }: Baglam) {
  const { id } = await params;
  programSil(id);
  const silindi = ogrenciSil(id);
  if (!silindi) return NextResponse.json({ hata: "Öğrenci bulunamadı" }, { status: 404 });
  return NextResponse.json({ silindi: true });
}
