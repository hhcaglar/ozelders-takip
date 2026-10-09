import { DERSLER, derslerOf, netHesapla } from "./data/dersler";
import { kazanimlarOf } from "./data/kazanimlar";
import type {
  BolumSonucu,
  DersAnalizi,
  DersKodu,
  Kazanim,
  KazanimDurumu,
  Sinav,
  SinavAnalizi, AytAlani } from "./types";

const yuvarla = (x: number, b = 2) => Math.round(x * 10 ** b) / 10 ** b;

export function bolumTopla(sinav: Sinav): { dogru: number; yanlis: number; bos: number } {
  return sinav.bolumler.reduce(
    (t, b) => ({ dogru: t.dogru + b.dogru, yanlis: t.yanlis + b.yanlis, bos: t.bos + b.bos }),
    { dogru: 0, yanlis: 0, bos: 0 },
  );
}

export function sinavNet(sinav: Sinav): number {
  return yuvarla(
    sinav.bolumler.reduce((t, b) => t + netHesapla(b.dogru, b.yanlis, sinav.sinavTuru), 0),
  );
}

/** Sınavdaki derslerin standart soru sayısı toplamı (net tavanı). */
export function sinavNetTavani(sinav: Sinav): number {
  return sinav.bolumler.reduce((t, b) => t + (DERSLER[b.ders]?.soruSayisi ?? 0), 0);
}

function dersAnalizi(sinav: Sinav, bolum: BolumSonucu, onceki?: Sinav): DersAnalizi {
  const ders = DERSLER[bolum.ders];
  const soruSayisi = bolum.dogru + bolum.yanlis + bolum.bos || ders?.soruSayisi || 1;
  const net = netHesapla(bolum.dogru, bolum.yanlis, sinav.sinavTuru);
  const oncekiBolum = onceki?.bolumler.find((b) => b.ders === bolum.ders);
  const netDegisim = oncekiBolum
    ? yuvarla(net - netHesapla(oncekiBolum.dogru, oncekiBolum.yanlis, sinav.sinavTuru))
    : null;
  return {
    ders,
    dogru: bolum.dogru,
    yanlis: bolum.yanlis,
    bos: bolum.bos,
    net,
    verim: yuvarla(net / soruSayisi, 3),
    yanlisOrani: yuvarla(bolum.yanlis / soruSayisi, 3),
    bosOrani: yuvarla(bolum.bos / soruSayisi, 3),
    netDegisim,
  };
}

/** Tek bir soru listesinden kazanım bazlı ustalık çıkarır. */
export function kazanimDurumlari(
  sorular: Sinav["sorular"],
  kapsam: DersKodu[],
): KazanimDurumu[] {
  const kova = new Map<string, { d: number; y: number; b: number }>();
  for (const s of sorular) {
    if (!s.kazanimId) continue;
    const g = kova.get(s.kazanimId) ?? { d: 0, y: 0, b: 0 };
    if (s.dogru) g.d += 1;
    else if (s.isaretlendi) g.y += 1;
    else g.b += 1;
    kova.set(s.kazanimId, g);
  }

  const kapsamKazanimlar: Kazanim[] = kapsam.flatMap(kazanimlarOf);
  const sonuc: KazanimDurumu[] = [];

  for (const k of kapsamKazanimlar) {
    const g = kova.get(k.id);
    if (!g || g.d + g.y + g.b === 0) {
      sonuc.push({
        kazanim: k,
        dogru: 0,
        yanlis: 0,
        bos: 0,
        toplam: 0,
        ustalik: 0,
        isabet: 0,
        oncelik: 0,
        durum: "verisiz",
      });
      continue;
    }
    const toplam = g.d + g.y + g.b;
    const ustalik = g.d / toplam;
    const isabet = g.d + g.y > 0 ? g.d / (g.d + g.y) : 0;
    const oncelik = yuvarla(k.agirlik * (1 - ustalik) * Math.log1p(toplam), 3);
    sonuc.push({
      kazanim: k,
      dogru: g.d,
      yanlis: g.y,
      bos: g.b,
      toplam,
      ustalik: yuvarla(ustalik, 3),
      isabet: yuvarla(isabet, 3),
      oncelik,
      durum: durumEtiketi(ustalik, g.y / toplam, g.b / toplam),
    });
  }
  return sonuc;
}

function durumEtiketi(ustalik: number, yanlisOrani: number, bosOrani: number): KazanimDurumu["durum"] {
  if (ustalik >= 0.75 && bosOrani < 0.25) return "kazanildi";
  if (ustalik < 0.4 || (yanlisOrani > 0.4 && ustalik < 0.6)) return "kritik";
  return "gelistirilmeli";
}

export function sinavAnalizi(sinav: Sinav, onceki?: Sinav): SinavAnalizi {
  const kapsam = sinav.bolumler.map((b) => b.ders);
  const dersler = sinav.bolumler
    .map((b) => dersAnalizi(sinav, b, onceki))
    .sort((a, b) => b.verim - a.verim);

  const kritik = kazanimDurumlari(sinav.sorular, kapsam)
    .filter((k) => k.durum === "kritik" || k.durum === "gelistirilmeli")
    .sort((a, b) => b.oncelik - a.oncelik);

  const toplam = bolumTopla(sinav);
  const toplamSoru = toplam.dogru + toplam.yanlis + toplam.bos;
  const tavan = sinavNetTavani(sinav);
  const net = sinavNet(sinav);

  const olculen = kazanimDurumlari(sinav.sorular, kapsam).filter((k) => k.toplam > 0);
  const ustalikOrtalama = olculen.length
    ? yuvarla(
        olculen.reduce((t, k) => t + k.ustalik * k.toplam, 0) /
          olculen.reduce((t, k) => t + k.toplam, 0),
        3,
      )
    : 0;

  return {
    sinav,
    toplamDogru: toplam.dogru,
    toplamYanlis: toplam.yanlis,
    toplamBos: toplam.bos,
    toplamNet: net,
    toplamSoru,
    netTavanOrani: tavan ? yuvarla(net / tavan, 3) : 0,
    dersler,
    guclu: dersler.slice(0, 2),
    zayif: dersler.slice(-2).reverse(),
    kritikKazanimlar: kritik,
    ustalikOrtalama,
  };
}

/**
 * Öğrencinin tüm sınavları üstünden kazanım ustalığı.
 * Yakın tarihli sınavlar üstel olarak daha ağır basar (yarılanma ≈ 3 sınav).
 */
export function topluKazanimDurumu(sinavlar: Sinav[]): KazanimDurumu[] {
  const sirali = [...sinavlar].sort((a, b) => b.tarih.localeCompare(a.tarih));
  const kapsam = Array.from(new Set(sinavlar.flatMap((s) => s.bolumler.map((b) => b.ders))));
  if (!kapsam.length) return [];

  const agirlikli = new Map<string, { d: number; y: number; b: number; w: number }>();
  sirali.forEach((sinav, i) => {
    const w = 0.55 ** i;
    for (const s of sinav.sorular) {
      if (!s.kazanimId) continue;
      const g = agirlikli.get(s.kazanimId) ?? { d: 0, y: 0, b: 0, w: 0 };
      if (s.dogru) g.d += w;
      else if (s.isaretlendi) g.y += w;
      else g.b += w;
      g.w += w;
      agirlikli.set(s.kazanimId, g);
    }
  });

  const sonuc: KazanimDurumu[] = [];
  for (const k of kapsam.flatMap(kazanimlarOf)) {
    const g = agirlikli.get(k.id);
    if (!g || g.w === 0) {
      sonuc.push({
        kazanim: k,
        dogru: 0,
        yanlis: 0,
        bos: 0,
        toplam: 0,
        ustalik: 0,
        isabet: 0,
        oncelik: 0,
        durum: "verisiz",
      });
      continue;
    }
    const ustalik = g.d / g.w;
    const isabet = g.d + g.y > 0 ? g.d / (g.d + g.y) : 0;
    const bosOrani = g.b / g.w;
    const yanlisOrani = g.y / g.w;
    const oncelik = yuvarla(k.agirlik * (1 - ustalik) * (1 + bosOrani * 0.3) * Math.log1p(g.w + 1), 3);
    sonuc.push({
      kazanim: k,
      dogru: yuvarla(g.d, 2),
      yanlis: yuvarla(g.y, 2),
      bos: yuvarla(g.b, 2),
      toplam: yuvarla(g.w, 2),
      ustalik: yuvarla(ustalik, 3),
      isabet: yuvarla(isabet, 3),
      oncelik,
      durum: durumEtiketi(ustalik, yanlisOrani, bosOrani),
    });
  }
  return sonuc.sort((a, b) => b.oncelik - a.oncelik);
}

export interface TrendNokta {
  tarih: string;
  baslik: string;
  net: number;
  dogru: number;
  yanlis: number;
  bos: number;
  ustalik: number;
}

export function netTrendi(sinavlar: Sinav[]): TrendNokta[] {
  return [...sinavlar]
    .sort((a, b) => a.tarih.localeCompare(b.tarih))
    .map((s) => {
      const t = bolumTopla(s);
      return {
        tarih: s.tarih,
        baslik: s.baslik,
        net: sinavNet(s),
        dogru: t.dogru,
        yanlis: t.yanlis,
        bos: t.bos,
        ustalik: sinavAnalizi(s).ustalikOrtalama,
      };
    });
}

/** Ders bazlı net serisi — grafiklerde kullanılır. */
export function dersTrendi(
  sinavlar: Sinav[],
): { tarih: string; baslik: string; [ders: string]: number | string }[] {
  return [...sinavlar]
    .sort((a, b) => a.tarih.localeCompare(b.tarih))
    .map((s) => {
      const nokta: { tarih: string; baslik: string; [ders: string]: number | string } = {
        tarih: s.tarih,
        baslik: s.baslik,
      };
      for (const b of s.bolumler) {
        nokta[DERSLER[b.ders]?.kisaAd ?? b.ders] = netHesapla(b.dogru, b.yanlis, s.sinavTuru);
      }
      return nokta;
    });
}

/** Öğrencinin ölçülen ders kümesi (sınav türüne ve AYT alanına göre). */
export function ogrenciDersleri(sinavTuru: Sinav["sinavTuru"], aytAlani?: AytAlani): DersKodu[] {
  return derslerOf(sinavTuru, aytAlani).map((d) => d.kod);
}
