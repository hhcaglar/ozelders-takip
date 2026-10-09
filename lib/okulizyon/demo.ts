import { derslerOf } from "../data/dersler";
import { kazanimlarOf } from "../data/kazanimlar";
import type { Kazanim, SinavTuru, AytAlani } from "../types";
import type { HamBolum, HamKarne, HamSoru } from "./parse";
import type { OkulizyonAdapter, SenkronBaglami } from "./adapter";

/** Deterministik PRNG — aynı öğrenci her seferinde aynı demo verisini alır. */
function mulberry32(tohum: number) {
  let a = tohum >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashTohum(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

/**
 * Okulizyon biçiminde örnek karne üretir.
 *
 * Amaç sahte rapor göstermek değil, bağlantı kurulmadan önce panelin tamamının
 * (karne normalizasyonu → kazanım eşleştirme → analiz → yorum → program) gerçek
 * kod yolundan geçtiğini doğrulamaktır.
 */
export function demoKarnelerUret(
  sinavTuru: SinavTuru,
  ogrenciKimligi: string,
  sinavSayisi = 4,
  aytAlani?: AytAlani,
): HamKarne[] {
  const rnd = mulberry32(hashTohum(ogrenciKimligi || "demo"));
  // AYT'de ders kümesi alana bağlıdır; alan verilmezse Sayısal varsayılır.
  const dersler = derslerOf(sinavTuru, aytAlani);
  const bugun = new Date();

  // Ders bazlı taban yeterlik (0-1).
  const taban = new Map<string, number>();
  for (const d of dersler) taban.set(d.kod, 0.4 + rnd() * 0.3);

  // Kazanım bazlı sapma: bazı kazanımlar kalıcı olarak zayıf.
  const sapma = new Map<string, number>();
  for (const d of dersler) {
    for (const k of kazanimlarOf(d.kod)) {
      sapma.set(k.id, (rnd() - 0.45) * 0.5);
    }
  }

  const karneler: HamKarne[] = [];
  const adet = Math.max(1, Math.min(12, sinavSayisi));

  for (let s = 0; s < adet; s++) {
    const gelisme = (s / Math.max(1, adet - 1)) * 0.14; // zamanla iyileşme
    const tarih = new Date(bugun);
    tarih.setDate(tarih.getDate() - (adet - 1 - s) * 14);

    const sorular: HamSoru[] = [];
    const bolumler: HamBolum[] = [];

    for (const d of dersler) {
      const kList: Kazanim[] = kazanimlarOf(d.kod);
      let dogru = 0;
      let yanlis = 0;
      let bos = 0;

      for (let q = 0; q < d.soruSayisi; q++) {
        const k = kList[Math.floor(rnd() * kList.length)];
        const yetenek = clamp(taban.get(d.kod)! + gelisme + (sapma.get(k.id) ?? 0), 0.05, 0.95);
        const bosOlasiligi = clamp((1 - yetenek) * 0.3, 0, 0.35);
        const r = rnd();
        let durum: "D" | "Y" | "B";
        if (r < bosOlasiligi) {
          durum = "B";
          bos += 1;
        } else if (r < bosOlasiligi + yetenek * (1 - bosOlasiligi)) {
          durum = "D";
          dogru += 1;
        } else {
          durum = "Y";
          yanlis += 1;
        }

        // Kazanım metni bazen tam, bazen sadece ünite, bazen hiç yok (gerçek veri gibi).
        const r2 = rnd();
        const kazanım =
          r2 < 0.12 ? undefined : r2 < 0.35 ? k.unite : `${k.unite} / ${k.ad}`;

        sorular.push({
          no: sorular.length + 1,
          ders: d.ad,
          kazanım,
          durum,
        });
      }
      bolumler.push({ ders: d.ad, dogru, yanlis, bos });
    }

    const toplamDogru = bolumler.reduce((t, b) => t + (b.dogru ?? 0), 0);
    const toplamSoru = bolumler.reduce((t, b) => t + (b.dogru ?? 0) + (b.yanlis ?? 0) + (b.bos ?? 0), 0);

    karneler.push({
      sinavAdi: `${sinavTuru} Deneme Sınavı ${s + 1}`,
      tarih: tarih.toISOString().slice(0, 10),
      yayinevi: ["Damla Yayınları", "Çalışkan Yayıncılık", "Karekök", "Bilfen"][s % 4],
      puan: Math.round(100 + 400 * (toplamDogru / Math.max(1, toplamSoru))),
      siralama: Math.max(50, Math.round(120000 - toplamDogru * 900 + rnd() * 3000)),
      sinifOrtalama: Math.round((toplamDogru * 0.9 + rnd() * 4) * 100) / 100,
      kurumOrtalama: Math.round((toplamDogru * 0.95 + rnd() * 3) * 100) / 100,
      bolumler,
      sorular,
    });
  }
  return karneler;
}

export const demoAdapter: OkulizyonAdapter = {
  ad: "demo",
  async senkron(baglam: SenkronBaglami) {
    const karneler = demoKarnelerUret(
      baglam.sinavTuru,
      baglam.ogrenciId,
      baglam.sinavSayisi ?? 4,
      baglam.ogrenci.aytAlani,
    );
    return {
      karneler,
      mesaj: `Demo modunda ${karneler.length} örnek karne üretildi. Gerçek Okulizyon verisi için bağlantı ayarlarından modu "Gerçek istek (HTTP)" olarak değiştir.`,
    };
  },
};
