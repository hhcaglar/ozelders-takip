import assert from "node:assert/strict";
import { test } from "node:test";
import { rehberlikRaporuUret } from "../lib/rapor";
import { sinavYorumu } from "../lib/yorum";
import { sinavAnalizi, topluKazanimDurumu } from "../lib/analysis";
import { demoKarnelerUret } from "../lib/okulizyon/demo";
import { karneListesiHazirla } from "../lib/okulizyon/import";
import {
  yuzde,
  yuzdeBelirtme,
  yuzdeBulunma,
  yuzdeEkleri,
  yuzdeIyelik,
  yuzdeIlgi,
  yuzdeYonelik,
} from "../lib/dilbilgisi";
import type { Ogrenci, Sinav } from "../lib/types";

/**
 * Elle doğrulanmış beklenen biçimler. Son rakam tek başına belirleyici değildir:
 * 0 ile biten sayılarda son kelime değişir (yirmi / otuz / kırk / elli / altmış /
 * yetmiş / seksen / doksan) ve ek onunla birlikte değişir.
 */
const BEKLENEN: Record<
  number,
  { yalin: string; iyelik: string; yonelik: string; bulunma: string; belirtme: string; ilgi: string }
> = {
  0: { yalin: "%0", iyelik: "%0'ı", yonelik: "%0'ına", bulunma: "%0'ında", belirtme: "%0'ını", ilgi: "%0'ının" },
  1: { yalin: "%51", iyelik: "%51'i", yonelik: "%51'ine", bulunma: "%51'inde", belirtme: "%51'ini", ilgi: "%51'inin" },
  2: { yalin: "%62", iyelik: "%62'si", yonelik: "%62'sine", bulunma: "%62'sinde", belirtme: "%62'sini", ilgi: "%62'sinin" },
  3: { yalin: "%43", iyelik: "%43'ü", yonelik: "%43'üne", bulunma: "%43'ünde", belirtme: "%43'ünü", ilgi: "%43'ünün" },
  4: { yalin: "%74", iyelik: "%74'ü", yonelik: "%74'üne", bulunma: "%74'ünde", belirtme: "%74'ünü", ilgi: "%74'ünün" },
  5: { yalin: "%25", iyelik: "%25'i", yonelik: "%25'ine", bulunma: "%25'inde", belirtme: "%25'ini", ilgi: "%25'inin" },
  6: { yalin: "%36", iyelik: "%36'sı", yonelik: "%36'sına", bulunma: "%36'sında", belirtme: "%36'sını", ilgi: "%36'sının" },
  7: { yalin: "%87", iyelik: "%87'si", yonelik: "%87'sine", bulunma: "%87'sinde", belirtme: "%87'sini", ilgi: "%87'sinin" },
  8: { yalin: "%18", iyelik: "%18'i", yonelik: "%18'ine", bulunma: "%18'inde", belirtme: "%18'ini", ilgi: "%18'inin" },
  9: { yalin: "%79", iyelik: "%79'u", yonelik: "%79'una", bulunma: "%79'unda", belirtme: "%79'unu", ilgi: "%79'unun" },
  // 0 ile biten sayılar: son kelime değiştiği için ekler de ayrışır.
  10: { yalin: "%10", iyelik: "%10'u", yonelik: "%10'una", bulunma: "%10'unda", belirtme: "%10'unu", ilgi: "%10'unun" },
  20: { yalin: "%20", iyelik: "%20'si", yonelik: "%20'sine", bulunma: "%20'sinde", belirtme: "%20'sini", ilgi: "%20'sinin" },
  30: { yalin: "%30", iyelik: "%30'u", yonelik: "%30'una", bulunma: "%30'unda", belirtme: "%30'unu", ilgi: "%30'unun" },
  40: { yalin: "%40", iyelik: "%40'ı", yonelik: "%40'ına", bulunma: "%40'ında", belirtme: "%40'ını", ilgi: "%40'ının" },
  50: { yalin: "%50", iyelik: "%50'si", yonelik: "%50'sine", bulunma: "%50'sinde", belirtme: "%50'sini", ilgi: "%50'sinin" },
  60: { yalin: "%60", iyelik: "%60'ı", yonelik: "%60'ına", bulunma: "%60'ında", belirtme: "%60'ını", ilgi: "%60'ının" },
  70: { yalin: "%70", iyelik: "%70'i", yonelik: "%70'ine", bulunma: "%70'inde", belirtme: "%70'ini", ilgi: "%70'inin" },
  80: { yalin: "%80", iyelik: "%80'i", yonelik: "%80'ine", bulunma: "%80'inde", belirtme: "%80'ini", ilgi: "%80'inin" },
  90: { yalin: "%90", iyelik: "%90'ı", yonelik: "%90'ına", bulunma: "%90'ında", belirtme: "%90'ını", ilgi: "%90'ının" },
  100: { yalin: "%100", iyelik: "%100'ü", yonelik: "%100'üne", bulunma: "%100'ünde", belirtme: "%100'ünü", ilgi: "%100'ünün" },
};

/** Sayı -> geçerli ek listesi (metin taraması testinde kullanılır). */
function gecerliEkler(n: number): string[] {
  const b = BEKLENEN[n];
  if (b) return [b.iyelik, b.yonelik, b.bulunma, b.belirtme, b.ilgi].map((f) => f.slice(b.yalin.length + 1));
  return Object.values(yuzdeEkleri(n));
}

test("yüzde ekleri her son rakam için doğru Türkçe biçimi üretir", () => {
  for (const b of Object.values(BEKLENEN)) {
    const deger = Number(b.yalin.slice(1)) / 100; // oran olarak veriyoruz
    assert.equal(yuzde(deger), b.yalin, `yalın: ${b.yalin}`);
    assert.equal(yuzdeIyelik(deger), b.iyelik, `iyelik: ${b.iyelik}`);
    assert.equal(yuzdeYonelik(deger), b.yonelik, `yönelik: ${b.yonelik}`);
    assert.equal(yuzdeBulunma(deger), b.bulunma, `bulunma: ${b.bulunma}`);
    assert.equal(yuzdeBelirtme(deger), b.belirtme, `belirtme: ${b.belirtme}`);
    assert.equal(yuzdeIlgi(deger), b.ilgi, `ilgi: ${b.ilgi}`);
  }
  // 0-9 son rakamının her biri ve tüm onluklar kapsanmış olmalı.
  const sayilar = Object.values(BEKLENEN).map((b) => Number(b.yalin.slice(1)));
  for (let r = 0; r <= 9; r++) assert.ok(sayilar.some((x) => x % 10 === r), `${r} ile biten sayı kapsanmadı`);
  for (const on of [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]) {
    assert.ok(sayilar.includes(on), `${on} kapsanmadı`);
  }
});

test("yüzde ekleri oran yerine doğrudan yüzde değeri de kabul eder", () => {
  assert.equal(yuzdeYonelik(62, false), "%62'sine");
  assert.equal(yuzdeIyelik(28, false), "%28'i");
  assert.equal(yuzdeBulunma(6, false), "%6'sında");
});

test("yüzde ekleri yuvarlar", () => {
  assert.equal(yuzdeYonelik(0.6249), "%62'sine");
  assert.equal(yuzdeIyelik(0.2751), "%28'i");
});

function ogrenci(): Ogrenci {
  return {
    id: "dil-1",
    ad: "Deneme Öğrenci",
    sinifSeviyesi: "12",
    sinavTuru: "TYT",
    hedefPuan: 450,
    haftalikSaat: 14,
    blokDakika: 50,
    calismaGunleri: [1, 2, 3, 4, 5, 6],
    olusturulma: "2026-01-01T00:00:00.000Z",
    guncelleme: "2026-01-01T00:00:00.000Z",
  };
}

test("üretilen metinlerde bozuk yüzde eki kalmaz", () => {
  const sinavlar: Sinav[] = karneListesiHazirla(demoKarnelerUret("TYT", "dil-tohum", 4), "TYT", "dil-1", "dil").map(
    (s, i) => ({ ...s, id: `d${i}` }),
  );
  const sirali = [...sinavlar].sort((a, b) => b.tarih.localeCompare(a.tarih));
  const analiz = sinavAnalizi(sirali[0], sirali[1]);
  const oncekiAnaliz = sinavAnalizi(sirali[1]);
  const toplu = topluKazanimDurumu(sirali);

  const yorumMetni = sinavYorumu(ogrenci(), analiz, sirali[1], oncekiAnaliz, toplu)
    .map((y) => y.metin)
    .join(" ");
  const rapor = rehberlikRaporuUret(ogrenci(), sinavlar, null)!;
  const raporMetni = rapor.duzMetin;

  for (const [ad, metin] of [
    ["yorum", yorumMetni],
    ["rapor", raporMetni],
  ] as const) {
    const eslesmeler = [...metin.matchAll(/%(\d+)'([a-zçğıöşü]+)/g)];
    assert.ok(eslesmeler.length > 0, `${ad}: hiç ekli yüzde yok, test geçersiz`);
    for (const [, sayi, ek] of eslesmeler) {
      const gecerli = gecerliEkler(Number(sayi));
      assert.ok(
        gecerli.includes(ek),
        `${ad}: %${sayi}'${ek} geçersiz — beklenen eklerden biri: ${gecerli.join(" / ")}`,
      );
    }
  }
});
