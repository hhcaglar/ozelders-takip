import { NextResponse } from "next/server";
import { ogrenciBul, ogrenciGuncelle, ogrenciSil, programSil } from "@/lib/db";
import { OGRENCI_SEMASI } from "@/lib/ogrenci-sema";

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
  // POST ile aynı şema, yalnızca tüm alanlar isteğe bağlı. Doğrulama olmazsa
  // geçersiz sinavTuru/aytAlani/blokDakika doğrudan kalıcılaşıp analiz, program
  // ve rapor hesaplarını bozuyor.
  const govde = await req.json().catch(() => null);
  const ayristirilan = OGRENCI_SEMASI.partial().safeParse(govde);
  if (!ayristirilan.success) {
    return NextResponse.json(
      { hata: "Geçersiz öğrenci bilgisi", detay: ayristirilan.error.flatten() },
      { status: 400 },
    );
  }
  // Şemada `id` yok ve zod bilinmeyen anahtarları soyup atar, bu yüzden
  // istemcinin gönderdiği id kaydı başka bir öğrenciye taşıyamaz.
  const guncel = ogrenciGuncelle(id, ayristirilan.data);
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
