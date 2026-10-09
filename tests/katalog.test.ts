import assert from "node:assert/strict";
import { test } from "node:test";
import { DERSLER, derslerOf, netHesapla } from "../lib/data/dersler";
import { kazanimBul, kazanimlarOf, katalogBoyutu, tumKazanimlar } from "../lib/data/kazanimlar";
import type { DersKodu } from "../lib/types";

test("her sınav türü için ders kartları tanımlı ve soru sayısı makul", () => {
  for (const sinav of ["TYT", "AYT", "LGS"] as const) {
    const dersler = derslerOf(sinav);
    assert.ok(dersler.length >= 4, `${sinav} için en az 4 ders bekleniyor, ${dersler.length} bulundu`);
    for (const d of dersler) {
      assert.ok(d.soruSayisi > 0, `${d.kod} soru sayısı 0 olamaz`);
      assert.equal(d.sinav, sinav);
      assert.match(d.renk, /^#[0-9a-f]{6}$/i);
    }
  }
  assert.equal(derslerOf("TYT").find((d) => d.kod === "TYT_TUR")?.soruSayisi, 40);
  assert.equal(derslerOf("LGS").find((d) => d.kod === "LGS_INS")?.soruSayisi, 10);
});

test("kazanım kataloğu: id'ler benzersiz, her kazanım geçerli derse bağlı", () => {
  const tumDersler = Object.keys(DERSLER) as DersKodu[];
  const gorulen = new Set<string>();
  let toplam = 0;
  for (const ders of tumDersler) {
    for (const k of kazanimlarOf(ders)) {
      assert.equal(k.ders, ders, `${k.id} yanlış derse bağlı`);
      assert.ok(!gorulen.has(k.id), `yinelenen kazanım id: ${k.id}`);
      gorulen.add(k.id);
      assert.ok(k.agirlik >= 1 && k.agirlik <= 3, `${k.id} ağırlık sınırları`);
      assert.ok(["kolay", "orta", "zor"].includes(k.zorluk));
      assert.ok(k.ad.length > 10, `${k.id} kazanım ifadesi çok kısa`);
      assert.ok(k.unite.length > 2, `${k.id} ünite adı boş`);
      toplam += 1;
    }
  }
  assert.equal(toplam, katalogBoyutu());
  assert.ok(toplam >= 200, `katalog beklenenden küçük: ${toplam}`);
});

test("kazanım id'si ders kodunu taşır ve geri çözülebilir", () => {
  const ilk = kazanimlarOf("TYT_MAT")[0];
  assert.ok(ilk.id.startsWith("TYT_MAT#"), ilk.id);
  assert.equal(kazanimBul(ilk.id)?.id, ilk.id);
  assert.equal(kazanimBul("TYT_MAT#99.99"), undefined);
  assert.equal(kazanimBul(null), undefined);
});

test("LGS İnkılap ve İngilizce karışmamış", () => {
  const ink = kazanimlarOf("LGS_INK").map((k) => k.ad).join(" ");
  const ins = kazanimlarOf("LGS_INS").map((k) => k.ad).join(" ");
  assert.match(ink, /Millî Mücadele|inkılap|Atatürk/i);
  assert.match(ins, /sözcük|Zaman yapıları|metin/i);
  assert.doesNotMatch(ins, /Kongreleri/);
});

test("netHesapla: YKS 4 yanlış 1 doğruyu götürür, LGS 3 yanlış", () => {
  assert.equal(netHesapla(40, 8, "TYT"), 38);
  assert.equal(netHesapla(30, 12, "AYT"), 27);
  assert.equal(netHesapla(18, 6, "LGS"), 16);
  assert.equal(netHesapla(0, 10, "TYT"), -2.5);
  assert.equal(netHesapla(10, 0, "TYT", 0), 10);
});

test("tumKazanimlar yalnızca istenen dersleri döndürür", () => {
  const liste = tumKazanimlar(["TYT_TUR", "TYT_MAT"]);
  assert.ok(liste.length > 20);
  assert.ok(liste.every((k) => k.ders === "TYT_TUR" || k.ders === "TYT_MAT"));
});
