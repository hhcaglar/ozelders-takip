import { NextResponse } from "next/server";
import { z } from "zod";
import { ogrenciBul, sinavKaydet } from "@/lib/db";
import { karneListesiHazirla, metniKarneyeCevir } from "@/lib/okulizyon/import";

export const dynamic = "force-dynamic";

const sema = z.object({
  ogrenciId: z.string().min(1),
  icerik: z.string().min(5, "İçe aktarılacak içerik boş görünüyor"),
});

export async function POST(req: Request) {
  const govde = await req.json().catch(() => null);
  const ayristirilan = sema.safeParse(govde);
  if (!ayristirilan.success) {
    return NextResponse.json({ hata: "Geçersiz istek", detay: ayristirilan.error.flatten() }, { status: 400 });
  }
  const { ogrenciId, icerik } = ayristirilan.data;
  const ogrenci = ogrenciBul(ogrenciId);
  if (!ogrenci) return NextResponse.json({ hata: "Öğrenci bulunamadı" }, { status: 404 });

  let iceAktarma;
  try {
    iceAktarma = metniKarneyeCevir(icerik, ogrenci.sinavTuru, ogrenciId);
  } catch (h) {
    return NextResponse.json(
      { hata: `İçerik çözümlenemedi: ${h instanceof Error ? h.message : "geçersiz JSON/CSV"}` },
      { status: 400 },
    );
  }
  const { karneler, uyari } = iceAktarma;
  if (!karneler.length) {
    return NextResponse.json(
      { hata: "İçerikte karne bulunamadı", uyari: uyari.length ? uyari : undefined },
      { status: 400 },
    );
  }

  const tumu = karneListesiHazirla(karneler, ogrenci.sinavTuru, ogrenciId, "manuel");
  const boslar = tumu.filter((s) => !s.bolumler.length).map((s) => s.baslik);
  const gecerli = tumu.filter((s) => s.bolumler.length > 0);

  // Hiçbir dersi tanınmayan karne kaydetmeyiz: boş kayıt analizi ve programı kirletir.
  const dersUyarisi = boslar.length
    ? `Şu kayıtlarda tanınan ders bulunamadı ve içe aktarılmadı: ${boslar.join(", ")}. ` +
      `Ders adını "${ogrenci.sinavTuru === "LGS" ? "Türkçe / Matematik / Fen Bilimleri / İnkılap / Din / İngilizce" : "Türkçe / Matematik / Fen / Sosyal"}" gibi yaz.`
    : undefined;

  if (!gecerli.length) {
    return NextResponse.json(
      { hata: "Hiçbir ders tanınamadığı için kayıt oluşturulmadı", uyari: [...uyari, dersUyarisi].filter(Boolean) },
      { status: 422 },
    );
  }

  const sonuc = sinavKaydet(gecerli);
  return NextResponse.json({
    mesaj: `${gecerli.length} karne içe aktarıldı (${sonuc.eklenen} yeni, ${sonuc.guncellenen} güncellendi).`,
    eklenen: sonuc.eklenen,
    guncellenen: sonuc.guncellenen,
    sinavlar: gecerli,
    uyari: [...uyari, dersUyarisi].filter(Boolean).join(" ") || undefined,
  });
}

