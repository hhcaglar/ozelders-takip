import { NextResponse } from "next/server";
import { z } from "zod";
import { baglantiAyari, baglantiKaydet, VARSAYILAN_BAGLANTI } from "@/lib/db";

export const dynamic = "force-dynamic";

const sema = z.object({
  aktif: z.boolean().optional(),
  baseUrl: z.string().optional(),
  girisSayfasi: z.string().optional(),
  girisEndpoint: z.string().optional(),
  karneEndpoint: z.string().optional(),
  girisTipi: z.enum(["ogrenciNo", "tcKimlikNo", "telefon"]).optional(),
  ogrenciNo: z.string().optional(),
  tcKimlikNo: z.string().optional(),
  telefon: z.string().optional(),
  kurumKodu: z.string().optional(),
  il: z.string().optional(),
  ilce: z.string().optional(),
  kurum: z.string().optional(),
  mod: z.enum(["demo", "http"]).optional(),
  sonSenkron: z.string().optional(),
  sonSenkronDurum: z.enum(["basarili", "hata"]).optional(),
  sonSenkronMesaj: z.string().optional(),
});

export async function GET() {
  // Şifre bu modelde hiç saklanmaz, dolayısıyla GET güvenle dönülebilir.
  return NextResponse.json({ baglanti: baglantiAyari() });
}

export async function PUT(req: Request) {
  const govde = await req.json().catch(() => null);
  const ayristirilan = sema.safeParse(govde);
  if (!ayristirilan.success) {
    return NextResponse.json({ hata: "Geçersiz ayar", detay: ayristirilan.error.flatten() }, { status: 400 });
  }
  return NextResponse.json({ baglanti: baglantiKaydet(ayristirilan.data) });
}

export async function DELETE() {
  return NextResponse.json({ baglanti: baglantiKaydet({ ...VARSAYILAN_BAGLANTI }) });
}
