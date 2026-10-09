import { DERSLER } from "../data/dersler";
import { kazanimlarOf } from "../data/kazanimlar";
import type { BolumSonucu, DersKodu, Sinav, SinavTuru, SoruSonucu } from "../types";

/* ─────────────────────────── Ders adı eşleştirme ─────────────────────────── */

const TR_MAP: Record<string, string> = {
  ç: "c", Ç: "c", ğ: "g", Ğ: "g", ı: "i", I: "i", İ: "i", ö: "o", Ö: "o",
  ş: "s", Ş: "s", ü: "u", Ü: "u", â: "a", î: "i", û: "u",
};

const DERS_ESLESMESI: { anahtar: RegExp; kod: Partial<Record<SinavTuru, DersKodu>> }[] = [
  { anahtar: /ingilizce|english|\bins\b/, kod: { TYT: "TYT_TUR", AYT: "AYT_EDB", LGS: "LGS_INS" } },
  { anahtar: /inkilap|ataturk/, kod: { TYT: "TYT_SOS", AYT: "AYT_TAR", LGS: "LGS_INK" } },
  { anahtar: /din kulturu|\bdin\b/, kod: { TYT: "TYT_SOS", AYT: "AYT_FEL", LGS: "LGS_DIN" } },
  { anahtar: /felsefe|psikoloji|sosyoloji|\bmantik\b/, kod: { TYT: "TYT_SOS", AYT: "AYT_FEL", LGS: "LGS_DIN" } },
  { anahtar: /turkce|edebiyat|\btdb\b|dil ve anlat/, kod: { TYT: "TYT_TUR", AYT: "AYT_EDB", LGS: "LGS_TUR" } },
  { anahtar: /matematik|geometri|\bmat\b/, kod: { TYT: "TYT_MAT", AYT: "AYT_MAT", LGS: "LGS_MAT" } },
  { anahtar: /fizik/, kod: { TYT: "TYT_FEN", AYT: "AYT_FIZ", LGS: "LGS_FEN" } },
  { anahtar: /kimya/, kod: { TYT: "TYT_FEN", AYT: "AYT_KIM", LGS: "LGS_FEN" } },
  { anahtar: /biyoloji/, kod: { TYT: "TYT_FEN", AYT: "AYT_BIY", LGS: "LGS_FEN" } },
  { anahtar: /fen bilgisi|fen bilimleri|\bfen\b/, kod: { TYT: "TYT_FEN", AYT: "AYT_BIY", LGS: "LGS_FEN" } },
  { anahtar: /cografya/, kod: { TYT: "TYT_SOS", AYT: "AYT_COG", LGS: "LGS_INK" } },
  { anahtar: /tarih/, kod: { TYT: "TYT_SOS", AYT: "AYT_TAR", LGS: "LGS_INK" } },
  { anahtar: /sosyal bilgiler|sosyal bilimler|\bsos\b/, kod: { TYT: "TYT_SOS", AYT: "AYT_TAR", LGS: "LGS_INK" } },
];

/**
 * Ders adını karşılaştırılabilir ASCII biçime indirger.
 * "İngilizce".toLowerCase() birleşik nokta (U+0307) ürettiği için ham karşılaştırma
 * sessizce ıskalar; bu yüzden önce Türkçe harfler ASCII biçime indirgenir.
 */
function dersMetniNorm(metin: string): string {
  return metin
    .split("")
    .map((c) => TR_MAP[c] ?? c)
    .join("")
    .normalize("NFD")
    .replace(/[\u0300-\u036f\u0307]/g, "")
    .toLowerCase();
}

/** Serbest metin ders adını öğrencinin sınav türüne göre standart koda çevirir. */
export function dersKodunaCevir(metin: string | undefined | null, sinav: SinavTuru): DersKodu | null {
  if (!metin) return null;
  const ham = String(metin).trim();
  if (!ham) return null;
  // Tam kod olarak verilmiş olabilir (TYT_MAT gibi).
  const ust = ham.toUpperCase().replace(/\s+/g, "_");
  if (DERSLER[ust as DersKodu]) return ust as DersKodu;
  const temiz = dersMetniNorm(ham);
  for (const k of DERS_ESLESMESI) {
    if (k.anahtar.test(temiz)) return k.kod[sinav] ?? k.kod.TYT ?? null;
  }
  return null;
}

/* ─────────────────────────── Kazanım eşleştirme ──────────────────────────── */

function normalize(metin: string): string {
  return metin
    .split("")
    .map((c) => TR_MAP[c] ?? c)
    .join("")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP = new Set(
  "ve ile veya de da ki ne icin bu su o bir olarak daha en cok az hem ile birlikte yani yani"
    .split(" ")
    .filter(Boolean),
);

function tokenSet(metin: string): Set<string> {
  return new Set(
    normalize(metin)
      .split(" ")
      .map((t) => t.trim())
      .filter((t) => t.length > 2 && !STOP.has(t)),
  );
}

/**
 * Okulizyon'un "kazanım analizi" metnini yerel kataloğa eşleştirir.
 * Eşleştirme skoru = kesişim / (katalog kümesi + metin kümesi - kesişim) benzeri
 * ağırlıklı Jaccard; eşik altındaki eşleşmeler null döner (yanlış etiketlemektense boş).
 */
export function kazanimEslestir(ders: DersKodu, metin: string | undefined | null): string | null {
  if (!metin || String(metin).trim().length < 4) return null;
  const hedef = tokenSet(String(metin));
  if (!hedef.size) return null;

  let enIyi: { id: string; skor: number } | null = null;
  for (const k of kazanimlarOf(ders)) {
    const katalog = tokenSet(`${k.unite} ${k.ad}`);
    let kesisim = 0;
    for (const t of hedef) if (katalog.has(t)) kesisim += 1;
    if (!kesisim) continue;
    // Kısa katalog ifadeleri haksız avantaja girmesin.
    const skor = (kesisim / Math.sqrt(katalog.size)) * (kesisim / hedef.size);
    if (!enIyi || skor > enIyi.skor) enIyi = { id: k.id, skor };
  }
  return enIyi && enIyi.skor >= 0.12 ? enIyi.id : null;
}

/* ─────────────────────────── Ham karne normalizasyonu ────────────────────── */

/**
 * Okulizyon'un karne/sonuç çıktısı kurumdan kuruma alan adı farkı gösterebildiği için
 * burada tolere eden bir okuyucu kullanıyoruz: her alan için olası adları dener.
 */
export interface HamKarne {
  sinavAdi?: string;
  sinav_adi?: string;
  baslik?: string;
  name?: string;
  tarih?: string;
  date?: string;
  sinavTarihi?: string;
  yayinevi?: string;
  yayin?: string;
  publisher?: string;
  puan?: number;
  point?: number;
  siralama?: number;
  genelSiralama?: number;
  sinifOrtalama?: number;
  kurumOrtalama?: number;
  bolumler?: HamBolum[];
  dersler?: HamBolum[];
  tests?: HamBolum[];
  sorular?: HamSoru[];
  questions?: HamSoru[];
  optik?: HamSoru[];
}

export interface HamBolum {
  ders?: string;
  dersAdi?: string;
  test?: string;
  testName?: string;
  dogru?: number;
  correct?: number;
  yanlis?: number;
  wrong?: number;
  bos?: number;
  empty?: number;
  blank?: number;
  net?: number;
}

export interface HamSoru {
  no?: number;
  soruNo?: number;
  questionNo?: number;
  ders?: string;
  dersAdi?: string;
  test?: string;
  kazanım?: string;
  kazanim?: string;
  kazanımKodu?: string;
  konu?: string;
  topic?: string;
  outcome?: string;
  durum?: string;
  cevap?: string;
  answer?: string;
  sonuc?: string;
  dogru?: boolean | number | string;
}

function sayi(v: unknown, varsayilan = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(",", ".").trim());
    return Number.isFinite(n) ? n : varsayilan;
  }
  return varsayilan;
}

function metin(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function tarihNormalize(v: unknown): string {
  const s = metin(v);
  if (!s) return new Date().toISOString().slice(0, 10);
  // DD.MM.YYYY veya DD/MM/YYYY
  const tr = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (tr) return `${tr[3]}-${tr[2].padStart(2, "0")}-${tr[1].padStart(2, "0")}`;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10);
}

/** Ham soru cevabından doğru/yanlış/boş çıkarır. */
function soruDuru(s: HamSoru): { dogru: boolean; isaretlendi: boolean } {
  const durum = (metin(s.durum) ?? metin(s.cevap) ?? metin(s.answer) ?? metin(s.sonuc) ?? "").toLowerCase();
  if (s.dogru !== undefined) {
    const d = s.dogru;
    if (typeof d === "boolean") return { dogru: d, isaretlendi: true };
    if (typeof d === "number") return { dogru: d > 0, isaretlendi: d !== 0 };
    const t = String(d).toLowerCase();
    if (["bos", "boş", "empty", "b", "-", ""].includes(t)) return { dogru: false, isaretlendi: false };
    if (["yanlis", "yanlış", "wrong", "y", "0"].includes(t)) return { dogru: false, isaretlendi: true };
    return { dogru: ["dogru", "doğru", "correct", "d", "1", "true"].includes(t), isaretlendi: true };
  }
  if (["bos", "boş", "empty", "blank", "b", "-"].includes(durum)) return { dogru: false, isaretlendi: false };
  if (["yanlis", "yanlış", "wrong", "y", "f", "false"].includes(durum)) return { dogru: false, isaretlendi: true };
  if (["dogru", "doğru", "correct", "d", "t", "true"].includes(durum)) return { dogru: true, isaretlendi: true };
  // Cevap anahtarı yoksa işaretlenmiş ama sonucu bilinmiyor kabul etmiyoruz.
  return { dogru: false, isaretlendi: false };
}

export interface NormalizeGirdi {
  ogrenciId: string;
  sinavTuru: SinavTuru;
  kaynakRef?: string;
}

/** Ham Okulizyon karnesini panelin Sinav modeline çevirir. */
export function karneNormalize(ham: HamKarne, girdi: NormalizeGirdi): Sinav {
  const hamBolumler = (ham.bolumler ?? ham.dersler ?? ham.tests ?? []) as HamBolum[];
  const hamSorular = (ham.sorular ?? ham.questions ?? ham.optik ?? []) as HamSoru[];

  const bolumMap = new Map<DersKodu, BolumSonucu>();
  for (const hb of hamBolumler) {
    const dersAd = metin(hb.ders) ?? metin(hb.dersAdi) ?? metin(hb.test) ?? metin(hb.testName);
    const kod = dersKodunaCevir(dersAd, girdi.sinavTuru);
    if (!kod) continue;
    const dogru = sayi(hb.dogru ?? hb.correct);
    const yanlis = sayi(hb.yanlis ?? hb.wrong);
    const bos = sayi(hb.bos ?? hb.empty ?? hb.blank);
    const mevcut = bolumMap.get(kod) ?? { ders: kod, dogru: 0, yanlis: 0, bos: 0 };
    mevcut.dogru += dogru;
    mevcut.yanlis += yanlis;
    mevcut.bos += bos;
    bolumMap.set(kod, mevcut);
  }

  // Bölüm listesi tanınan en az bir ders içeriyorsa sorulardan ayrıca saymayız.
  const bolumVerisiVar = bolumMap.size > 0;

  const sorular: SoruSonucu[] = [];
  hamSorular.forEach((hs, i) => {
    const dersAd = metin(hs.ders) ?? metin(hs.dersAdi) ?? metin(hs.test);
    const kod = dersKodunaCevir(dersAd, girdi.sinavTuru);
    if (!kod) return;
    const d = soruDuru(hs);
    sorular.push({
      no: sayi(hs.no ?? hs.soruNo ?? hs.questionNo, i + 1),
      ders: kod,
      kazanimId: kazanimEslestir(kod, metin(hs.kazanım) ?? metin(hs.kazanim) ?? metin(hs.konu) ?? metin(hs.outcome)),
      dogru: d.dogru,
      isaretlendi: d.isaretlendi,
    });
    // Bölüm düzeyinde veri hiç gelmediyse sayıları sorulardan üret.
    if (!bolumVerisiVar) {
      const b = bolumMap.get(kod) ?? { ders: kod, dogru: 0, yanlis: 0, bos: 0 };
      if (d.dogru) b.dogru += 1;
      else if (d.isaretlendi) b.yanlis += 1;
      else b.bos += 1;
      bolumMap.set(kod, b);
    }
  });

  // Soru verisi var ama bölüm verisi eksikse boşları tamamla.
  for (const [kod, b] of bolumMap) {
    const soruSayisi = sorular.filter((s) => s.ders === kod).length;
    if (b.dogru + b.yanlis + b.bos === 0 && soruSayisi > 0) {
      b.dogru = sorular.filter((s) => s.ders === kod && s.dogru).length;
      b.yanlis = sorular.filter((s) => s.ders === kod && s.isaretlendi && !s.dogru).length;
      b.bos = sorular.filter((s) => s.ders === kod && !s.isaretlendi).length;
    }
  }

  const bolumler = [...bolumMap.values()].filter((b) => b.dogru + b.yanlis + b.bos > 0);
  return {
    id: "",
    ogrenciId: girdi.ogrenciId,
    baslik: metin(ham.sinavAdi) ?? metin(ham.sinav_adi) ?? metin(ham.baslik) ?? metin(ham.name) ?? "Okulizyon sınavı",
    tarih: tarihNormalize(ham.tarih ?? ham.sinavTarihi ?? ham.date),
    sinavTuru: girdi.sinavTuru,
    yayinevi: metin(ham.yayinevi) ?? metin(ham.yayin) ?? metin(ham.publisher),
    kaynak: "okulizyon",
    kaynakRef: girdi.kaynakRef,
    bolumler,
    sorular,
    puan: ham.puan !== undefined ? sayi(ham.puan) : ham.point !== undefined ? sayi(ham.point) : undefined,
    genelSiralama:
      ham.genelSiralama !== undefined ? sayi(ham.genelSiralama) : ham.siralama !== undefined ? sayi(ham.siralama) : undefined,
    sinifOrtalamaNet: ham.sinifOrtalama !== undefined ? sayi(ham.sinifOrtalama) : undefined,
    kurumOrtalamaNet: ham.kurumOrtalama !== undefined ? sayi(ham.kurumOrtalama) : undefined,
    olusturulma: new Date().toISOString(),
  };
}


