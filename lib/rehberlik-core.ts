import { DERSLER, netHesapla } from "./data/dersler";
import { kazanimDurumlari, sinavNet } from "./analysis";
import type { DersKodu, KazanimDurumu, Ogrenci, Sinav, SinavAnalizi } from "./types";

/**
 * Net ↔ puan dönüşümü.
 *
 * ÖSYM ve MEB gerçek hesaplamada ham puanı önce standart puana (T-puan) çevirir; bu
 * dönüşüm sınav popülasyonunun ortalamasına ve standart sapmasına bağlıdır ve sınavdan
 * önce bilinemez. Buradaki eğriler geçmiş yılların tipik dağılımlarına oturtulmuş,
 * monoton ve doğrusal-parçalı YAKLAŞIK eğrilerdir. Amaç mutlak puan vermek değil,
 * "hedefim için kaç net gerekir" sorusuna yön gösterici bir eşik vermektir.
 */
type Egriler = [net: number, puan: number][];

const TYT_EGRISI: Egriler = [
  [0, 100], [10, 225], [20, 268], [30, 298], [40, 325], [50, 350], [60, 372],
  [70, 392], [80, 410], [90, 428], [100, 448], [110, 470], [120, 500],
];

const AYT_EGRISI: Egriler = [
  [0, 180], [20, 245], [40, 290], [60, 330], [80, 368], [100, 405],
  [120, 440], [140, 472], [160, 500],
];

/** LGS'de MEB katsayıları: sayısal üç ders 4, diğerleri 1 ağırlıklıdır. */
const LGS_KATSAYI: Partial<Record<DersKodu, number>> = {
  LGS_TUR: 4,
  LGS_MAT: 4,
  LGS_FEN: 4,
  LGS_INK: 1,
  LGS_DIN: 1,
  LGS_INS: 1,
};

const SIRALAMA_EGRISI: Egriler = [
  [500, 100], [480, 2000], [460, 12000], [440, 40000], [420, 90000], [400, 160000],
  [380, 250000], [360, 360000], [340, 500000], [320, 660000], [300, 830000], [280, 1000000],
  [240, 1400000], [200, 1700000],
];

/**
 * Eğriler x eksenine göre ARTAN sıralı okunur. SIRALAMA_EGRISI okunabilirlik için
 * puan azalacak biçimde (500 → 200) yazılmıştır; bu yüzden okumadan önce yön
 * normalleştirilir. Normalleştirme olmazsa "x <= egri[0][0]" koruması 500'ün
 * altındaki her puanı ilk satıra düşürür ve sıralama hep 100 döner.
 */
function artan(egri: Egriler): Egriler {
  return egri[0][0] <= egri[egri.length - 1][0] ? egri : [...egri].reverse();
}

function egridenOku(egri: Egriler, x: number): number {
  // Sonlu olmayan girdide uç değer uydurulmaz: NaN net "500 puan" gibi
  // yanıltıcı bir sonuca dönüşmesin diye NaN olarak ilerler.
  if (!Number.isFinite(x)) return NaN;
  const e = artan(egri);
  if (x <= e[0][0]) return e[0][1];
  const son = e[e.length - 1];
  if (x >= son[0]) return son[1];
  for (let i = 1; i < e.length; i++) {
    const [x0, y0] = e[i - 1];
    const [x1, y1] = e[i];
    if (x <= x1) return y0 + ((x - x0) * (y1 - y0)) / (x1 - x0);
  }
  return son[1];
}

function egriyiTersCevir(egri: Egriler, y: number): number {
  if (!Number.isFinite(y)) return NaN;
  const e = artan(egri);
  if (y <= e[0][1]) return e[0][0];
  const son = e[e.length - 1];
  if (y >= son[1]) return son[0];
  for (let i = 1; i < e.length; i++) {
    const [x0, y0] = e[i - 1];
    const [x1, y1] = e[i];
    if (y <= y1) return x0 + ((y - y0) * (x1 - x0)) / (y1 - y0);
  }
  return son[0];
}

/** LGS ağırlıklı doğru oranı (0-1). */
export function lgsAgirlikliOran(sinav: Sinav): number {
  let pay = 0;
  let payda = 0;
  for (const b of sinav.bolumler) {
    const k = LGS_KATSAYI[b.ders] ?? 1;
    pay += k * b.dogru;
    payda += k * (DERSLER[b.ders]?.soruSayisi ?? b.dogru + b.yanlis + b.bos);
  }
  return payda ? pay / payda : 0;
}

/** Netten yaklaşık puana. */
export function nettenPuan(sinavTuru: Sinav["sinavTuru"], net: number, sinav?: Sinav): number {
  if (sinavTuru === "TYT") return Math.round(egridenOku(TYT_EGRISI, net));
  if (sinavTuru === "AYT") return Math.round(egridenOku(AYT_EGRISI, net));
  if (sinav) return Math.round(100 + 400 * lgsAgirlikliOran(sinav));
  return Math.round(100 + 400 * (net / 90));
}

/** Hedef puandan gereken yaklaşık nete. */
export function puandanNet(sinavTuru: Sinav["sinavTuru"], puan: number, sinav?: Sinav): number {
  if (sinavTuru === "TYT") return egriyiTersCevir(TYT_EGRISI, puan);
  if (sinavTuru === "AYT") return egriyiTersCevir(AYT_EGRISI, puan);
  const oran = Math.min(1, Math.max(0, (puan - 100) / 400));
  const tavan = sinav ? sinavNet(sinav) : 90;
  return oran * (tavan || 90);
}

/** Puandan kaba sıralama tahmini. */
export function tahminiSiralama(puan: number): number | null {
  // NaN için "puan < 200" ve "puan > 500" ikisi de false döner; koruma
  // eklenmezse NaN tablonun son satırına düşüp 100 (en iyi derece) üretir.
  if (!Number.isFinite(puan) || puan < 200 || puan > 500) return null;
  return Math.round(egridenOku(SIRALAMA_EGRISI, puan));
}

export interface HedefKiyasi {
  hedefNet: number;
  mevcutNet: number;
  netAcigi: number;
  /** mevcutNet / hedefNet (0-1) */
  hedefeYuzde: number;
  tahminiPuan: number;
  tahminiSiralama: number | null;
  /** Net açığının en rahat kapatılabileceği ders. */
  potansiyelDers: { ad: string; mevcutNet: number; tavan: number; acik: number } | null;
  /** Odaklı çalışmayla hedefe tahmini hafta sayısı. */
  tahminiHafta: number;
  /** Ölçülmüş kazanımlar içinde en düşük ustalık oranı. */
  enDusukUstalik: number;
}

export function siniflandir(
  ogrenci: Ogrenci,
  analiz: SinavAnalizi,
  toplu?: KazanimDurumu[],
): HedefKiyasi | null {
  if (!ogrenci.hedefPuan) return null;
  // Eğri tablosu, uygulamanın kendi ders kartı toplamından yüksek bir nete
  // çıkabiliyor (AYT eğrisi 160'da biter, ders kartları 154 soru). Kırpma
  // olmazsa öğrenciye ulaşılamaz bir hedef gösterilir.
  const tavan = analiz.dersler.reduce((t, d) => t + d.ders.soruSayisi, 0);
  const hamHedef = puandanNet(ogrenci.sinavTuru, ogrenci.hedefPuan, analiz.sinav);
  const hedefNet = tavan > 0 ? Math.min(hamHedef, tavan) : hamHedef;
  const mevcutNet = analiz.toplamNet;
  const netAcigi = Math.max(0, hedefNet - mevcutNet);

  // En büyük "boşluk" olan ders: tavan - mevcut net.
  const potansiyel = analiz.dersler
    .map((d) => ({
      ad: d.ders.ad,
      mevcutNet: d.net,
      tavan: d.ders.soruSayisi,
      acik: d.ders.soruSayisi - d.net,
    }))
    .sort((a, b) => b.acik - a.acik)[0] ?? null;

  // Haftalık net kazanım hızı: düşük seviyede hızlı, yüksek seviyede yavaş.
  const seviyeFaktoru = 0.25 + 0.15 * (1 - analiz.netTavanOrani);
  const haftalikNetKazanimi = Math.min(4, Math.max(0.6, ogrenci.haftalikSaat * seviyeFaktoru));
  const tahminiHafta = Math.min(52, Math.max(1, Math.ceil(netAcigi / haftalikNetKazanimi)));

  const olculen = (toplu ?? kazanimDurumlari(analiz.sinav.sorular, analiz.sinav.bolumler.map((b) => b.ders)))
    .filter((k) => k.toplam > 0);
  const enDusukUstalik = olculen.length ? Math.min(...olculen.map((k) => k.ustalik)) : 0;

  return {
    hedefNet,
    mevcutNet,
    netAcigi,
    hedefeYuzde: hedefNet ? mevcutNet / hedefNet : 0,
    tahminiPuan: nettenPuan(ogrenci.sinavTuru, mevcutNet, analiz.sinav),
    tahminiSiralama: ogrenci.sinavTuru === "LGS" ? null : tahminiSiralama(nettenPuan(ogrenci.sinavTuru, mevcutNet)),
    potansiyelDers: potansiyel,
    tahminiHafta,
    enDusukUstalik,
  };
}

/**
 * Hedef netin derslere dağıtımı.
 * Model: hedefe ulaşmak için gereken toplam net, derslerin soru sayısıyla orantılı
 * dağıtılır — yani her dersten aynı "verim yüzdesi" beklenir. Bu, zayıf derste
 * gerçekçi olmayan bir hedef koymayı önler.
 */
export function dersBazliHedefNet(
  ogrenci: Ogrenci,
  analiz: SinavAnalizi,
): { hedef: Record<string, number>; acik: Record<string, number>; ortakVerim: number } {
  const hedefNet = ogrenci.hedefPuan
    ? puandanNet(ogrenci.sinavTuru, ogrenci.hedefPuan, analiz.sinav)
    : analiz.toplamNet;
  const tavan = analiz.dersler.reduce((t, d) => t + d.ders.soruSayisi, 0) || 1;
  const ortakVerim = Math.min(1, hedefNet / tavan);

  const hedef: Record<string, number> = {};
  const acik: Record<string, number> = {};
  for (const d of analiz.dersler) {
    const h = d.ders.soruSayisi * ortakVerim;
    hedef[d.ders.kisaAd] = Math.round(h * 100) / 100;
    acik[d.ders.kisaAd] = Math.round((h - d.net) * 100) / 100;
  }
  return { hedef, acik, ortakVerim };
}

/** Net hesabı yardımcıları — dışa açılan küçük sarmalayıcılar. */
export function hamNet(sinav: Sinav, ders: DersKodu): number | null {
  const b = sinav.bolumler.find((x) => x.ders === ders);
  return b ? netHesapla(b.dogru, b.yanlis, sinav.sinavTuru) : null;
}
