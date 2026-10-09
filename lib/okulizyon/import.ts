import type { SinavTuru } from "../types";
import { karneNormalize, type HamBolum, type HamKarne, type HamSoru } from "./parse";

export interface IceAktarma {
  karneler: HamKarne[];
  /** Kaydedilmedi ama kullanıcının bilmesi iyi olan durumlar. */
  uyari: string[];
}

/**
 * Manuel içe aktarma.
 *
 * Kabul edilen biçimler:
 *  1. Okulizyon karne dizisi (HamKarne[]) — sarmalayıcı ad fark etmez.
 *  2. Soru düzeyinde CSV: baslik;tarih;ders;soru_no;kazanim;durum   (durum: D/Y/B)
 *  3. Bölüm düzeyinde CSV: baslik;tarih;ders;dogru;yanlis;bos
 */
export function metniKarneyeCevir(
  icerik: string,
  sinavTuru: SinavTuru,
  ogrenciId: string,
): IceAktarma {
  const kirpilmis = icerik.trim();
  if (!kirpilmis) return { karneler: [], uyari: [] };
  if (kirpilmis.startsWith("{") || kirpilmis.startsWith("[")) {
    return { karneler: jsonKarneCevir(kirpilmis), uyari: [] };
  }
  return csvKarneCevir(kirpilmis, sinavTuru, ogrenciId);
}

/**
 * Ayıraç duyarlı satır bölücü. Çift tırnak içindeki ayıraçlar alanı bölmez:
 * `a;"b; c";d` → ["a", "b; c", "d"].
 */
function csvSatirBol(satir: string, ayirac: string): string[] {
  const alanlar: string[] = [];
  let simdiki = "";
  let tirnakta = false;
  for (let i = 0; i < satir.length; i++) {
    const k = satir[i];
    if (k === '"') {
      if (tirnakta && satir[i + 1] === '"') {
        simdiki += '"';
        i++;
      } else {
        tirnakta = !tirnakta;
      }
      continue;
    }
    if (k === ayirac && !tirnakta) {
      alanlar.push(simdiki);
      simdiki = "";
      continue;
    }
    simdiki += k;
  }
  alanlar.push(simdiki);
  return alanlar;
}

function jsonKarneCevir(metin: string): HamKarne[] {
  const ham = JSON.parse(metin) as unknown;
  const adaylar = Array.isArray(ham)
    ? ham
    : ((ham as Record<string, unknown>).karneler ??
        (ham as Record<string, unknown>).sonuclar ??
        (ham as Record<string, unknown>).sinavlar ??
        (ham as Record<string, unknown>).data ??
        [ham]) as unknown[];
  return (adaylar as HamKarne[]).filter(Boolean);
}

function alanAyirici(baslikSatiri: string): string {
  if (baslikSatiri.includes(";")) return ";";
  if (baslikSatiri.includes("\t")) return "\t";
  if (baslikSatiri.includes(",")) return ",";
  return ";";
}

function csvKarneCevir(metin: string, sinavTuru: SinavTuru, ogrenciId: string): IceAktarma {
  const uyari: string[] = [];
  const satirlar = metin
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (satirlar.length < 2) return { karneler: [], uyari: ["CSV'de başlık dışında satır yok."] };

  const ayirac = alanAyirici(satirlar[0]);
  const basliklar = satirlar[0].split(ayirac).map((b) => normalizeBaslik(b));
  const satirlarVeri = satirlar.slice(1).map((s) => csvSatirBol(s, ayirac));

  const kaymis = satirlarVeri.filter((p) => p.length !== basliklar.length).length;
  if (kaymis) {
    uyari.push(
      `${kaymis} satırda alan sayısı başlıkla uyuşmuyor. Metin içinde "${ayirac}" geçiyorsa alanı çift tırnağa al: "Katı; sıvı ve gaz basıncı".`,
    );
  }

  const soruDuzeyi = basliklar.some((b) => ["soru", "soru_no", "soruno", "no", "durum"].includes(b));
  const karneler = new Map<string, HamKarne>();

  for (const parcalar of satirlarVeri) {
    const satir: Record<string, string> = {};
    basliklar.forEach((b, i) => (satir[b] = (parcalar[i] ?? "").trim()));
    const baslik = satir.baslik || satir.sinav || satir.sinav_adi || "İçe aktarılan sınav";
    const tarih = satir.tarih || satir.date || "";
    let karne = karneler.get(baslik);
    if (!karne) {
      karne = { sinavAdi: baslik, tarih, bolumler: [], sorular: [] };
      karneler.set(baslik, karne);
    }
    if (soruDuzeyi) {
      (karne.sorular as HamSoru[]).push({
        no: Number(satir.soru || satir.soru_no || satir.no) || (karne.sorular!.length + 1),
        ders: satir.ders || satir.test,
        kazanım: satir.kazanim || satir.konu || satir.kazanım,
        durum: (satir.durum || satir.cevap || satir.sonuc || "B").toUpperCase().slice(0, 1),
      });
    } else {
      (karne.bolumler as HamBolum[]).push({
        ders: satir.ders || satir.test,
        dogru: Number(satir.dogru) || 0,
        yanlis: Number(satir.yanlis) || 0,
        bos: Number(satir.bos) || 0,
      });
    }
  }

  void sinavTuru;
  void ogrenciId;
  return { karneler: [...karneler.values()], uyari };
}

function normalizeBaslik(b: string): string {
  return b
    .toLowerCase()
    .replaceAll("ı", "i")
    .replaceAll("İ", "i")
    .replaceAll("ş", "s")
    .replaceAll("ğ", "g")
    .replaceAll("ü", "u")
    .replaceAll("ö", "o")
    .replaceAll("ç", "c")
    .replace(/[^a-z0-9_]/g, "")
    .trim();
}

/** Ham karneleri Sinav kaydına çevirir (normalize + kimliklendirme). */
export function karneListesiHazirla(
  karneler: HamKarne[],
  sinavTuru: SinavTuru,
  ogrenciId: string,
  kaynakRef?: string,
) {
  return karneler.map((k, i) =>
    karneNormalize(k, { ogrenciId, sinavTuru, kaynakRef: kaynakRef ?? `satir-${i}` }),
  );
}

/** CSV içe aktarma şablonları — arayüzde indirilebilir örnek olarak kullanılır. */
export const CSV_SABLON_SORU =
  "baslik;tarih;ders;soru;kazanim;durum\n" +
  "TYT Deneme 1;2026-09-20;Türkçe;1;Paragrafta Anlam / Paragrafın ana düşüncesini belirler;D\n" +
  "TYT Deneme 1;2026-09-20;Türkçe;2;Paragrafta Anlam / Paragrafın ana düşüncesini belirler;Y\n" +
  "TYT Deneme 1;2026-09-20;Matematik;1;Problemler / Hareket (hız-zaman-yol) problemlerini çözer;B\n";

export const CSV_SABLON_BOLUM =
  "baslik;tarih;ders;dogru;yanlis;bos\n" +
  "TYT Deneme 1;2026-09-20;Türkçe;32;5;3\n" +
  "TYT Deneme 1;2026-09-20;Matematik;21;11;8\n" +
  "TYT Deneme 1;2026-09-20;Fen Bilimleri;9;6;5\n" +
  "TYT Deneme 1;2026-09-20;Sosyal Bilimler;14;4;2\n";
