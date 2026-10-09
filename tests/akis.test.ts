import assert from "node:assert/strict";
import { test } from "node:test";
import { derslerOf } from "../lib/data/dersler";
import { kazanimlarOf } from "../lib/data/kazanimlar";
import { kazanimDurumlari, sinavAnalizi, sinavNet, topluKazanimDurumu, netTrendi } from "../lib/analysis";
import { sinavYorumu } from "../lib/yorum";
import { rehberlikRaporu, oncelikliKazanimlar, rehberlikOzetSatiri } from "../lib/rehberlik";
import { puandanNet, nettenPuan } from "../lib/rehberlik-core";
import { calismaProgramiUret, gunlereGoreGrupla, icsUret, oncelikKuyrugu, tipAdi } from "../lib/plan";
import { demoAdapter, demoKarnelerUret } from "../lib/okulizyon/demo";
import { VARSAYILAN_BAGLANTI } from "../lib/db";
import { karneListesiHazirla } from "../lib/okulizyon/import";
import type { Ogrenci, Sinav } from "../lib/types";

function ogrenciFiksturu(over: Partial<Ogrenci> = {}): Ogrenci {
  return {
    id: "ogrenci-1",
    ad: "Test Öğrenci",
    sinifSeviyesi: "12",
    sinavTuru: "TYT",
    hedefPuan: 450,
    haftalikSaat: 14,
    calismaGunleri: [1, 2, 3, 4, 5, 6],
    blokDakika: 50,
    olusturulma: "2026-01-01T00:00:00.000Z",
    guncelleme: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

function sinavlariUret(sinavTuru: "TYT" | "AYT" | "LGS", adet = 4): Sinav[] {
  const ham = demoKarnelerUret(sinavTuru, "sabit-tohum", adet);
  return karneListesiHazirla(ham, sinavTuru, "ogrenci-1", "test").map((s, i) => ({ ...s, id: `s${i}` }));
}

test("demo üreticisi deterministiktir ve ders toplamları tutarlıdır", async () => {
  const a = demoKarnelerUret("TYT", "ayni", 3);
  const b = demoKarnelerUret("TYT", "ayni", 3);
  assert.deepEqual(a, b);
  const c = demoKarnelerUret("TYT", "farkli", 3);
  assert.notDeepEqual(a, c);

  for (const karne of a) {
    const soruSayisi = karne.sorular!.length;
    const beklenen = derslerOf("TYT").reduce((t, d) => t + d.soruSayisi, 0);
    assert.equal(soruSayisi, beklenen, "soru sayısı ders tavanına eşit olmalı");
    for (const bol of karne.bolumler!) {
      const toplam = (bol.dogru ?? 0) + (bol.yanlis ?? 0) + (bol.bos ?? 0);
      const dersBeklenen = derslerOf("TYT").find((d) => d.ad === bol.ders)!.soruSayisi;
      assert.equal(toplam, dersBeklenen, `${bol.ders} toplamı tutmuyor`);
    }
  }

  const sonuc = await demoAdapter.senkron({
    ogrenci: ogrenciFiksturu(),
    ogrenciId: "ogrenci-1",
    sinavTuru: "TYT",
    ayar: { ...VARSAYILAN_BAGLANTI, aktif: true, mod: "demo" },
  });
  assert.equal(sonuc.karneler.length, 4);
});

test("sinavAnalizi net, verim ve yanlış/boş oranlarını doğru hesaplar", () => {
  const sinavlar = sinavlariUret("TYT", 2);
  const analiz = sinavAnalizi(sinavlar[0]);

  assert.equal(analiz.toplamDogru + analiz.toplamYanlis + analiz.toplamBos, analiz.toplamSoru);
  assert.equal(analiz.toplamSoru, 120);
  assert.ok(analiz.toplamNet <= 120 && analiz.toplamNet > -30);
  assert.equal(analiz.dersler.length, 4);
  assert.equal(
    analiz.dersler.reduce((t, d) => t + d.net, 0).toFixed(1),
    analiz.toplamNet.toFixed(1),
  );
  for (const d of analiz.dersler) {
    assert.ok(d.verim >= -0.3 && d.verim <= 1, `${d.ders.kod} verim sınırları: ${d.verim}`);
    assert.equal(d.dogru + d.yanlis + d.bos, d.ders.soruSayisi);
  }
  // En güçlü iki ders gerçekten en yüksek verimli olanlar.
  assert.ok(analiz.guclu[0].verim >= analiz.dersler[analiz.dersler.length - 1].verim);
  assert.equal(sinavNet(sinavlar[0]), analiz.toplamNet);
});

test("kazanimDurumlari doğru/yanlış/boş ayrımını ve öncelik skorunu üretir", () => {
  const sinav = sinavlariUret("TYT", 1)[0];
  const durumlar = kazanimDurumlari(sinav.sorular, sinav.bolumler.map((b) => b.ders));
  assert.ok(durumlar.length > 30);

  const etiketli = durumlar.filter((k) => k.durum !== "verisiz");
  assert.ok(etiketli.length > 0, "hiç kazanım etiketlenmemiş");
  for (const k of etiketli) {
    assert.ok(k.ustalik >= 0 && k.ustalik <= 1);
    assert.ok(k.isabet >= 0 && k.isabet <= 1);
    assert.ok(k.oncelik >= 0);
    assert.ok(k.dogru + k.yanlis + k.bos > 0);
  }
  // Tamamını doğru yapan kazanımın önceliği 0 olmalı.
  const tam = etiketli.find((k) => k.yanlis === 0 && k.bos === 0 && k.dogru > 0);
  if (tam) assert.equal(tam.oncelik, 0);
});

test("topluKazanimDurumu çoklu sınavı ağırlıklandırıp önceliğe göre dizer", () => {
  const sinavlar = sinavlariUret("TYT", 4);
  const toplu = topluKazanimDurumu(sinavlar);
  assert.ok(toplu.length > 0);
  for (let i = 1; i < toplu.length; i++) {
    assert.ok(toplu[i - 1].oncelik >= toplu[i].oncelik, "öncelik azalan sırada olmalı");
  }
  const kritik = toplu.filter((k) => k.durum === "kritik");
  assert.ok(kritik.every((k) => k.ustalik < 0.75));
});

test("yorum motoru ölçülen veriye bağlı, gerekçeli bloklar üretir", () => {
  const sinavlar = sinavlariUret("TYT", 4);
  const son = sinavlar[0];
  const onceki = sinavlar[1];
  const analiz = sinavAnalizi(son, onceki);
  const oncekiAnaliz = sinavAnalizi(onceki);
  const toplu = topluKazanimDurumu(sinavlar);

  const yorumlar = sinavYorumu(ogrenciFiksturu(), analiz, onceki, oncekiAnaliz, toplu);
  assert.ok(yorumlar.length >= 4, `beklenenden az yorum: ${yorumlar.length}`);

  const basliklar = yorumlar.map((y) => y.baslik);
  assert.ok(basliklar.includes("Genel Değerlendirme"));
  assert.ok(basliklar.includes("Hedefe Uzaklık"), "hedef puan verildiği hâlde hedef yorumu yok");

  const genel = yorumlar.find((y) => y.baslik === "Genel Değerlendirme")!;
  assert.ok(genel.metin.includes(String(analiz.toplamDogru)), "genel yorumda doğru sayısı geçmeli");
  assert.ok(genel.metin.includes(analiz.toplamNet.toFixed(2)), "genel yorumda net geçmeli");
  assert.ok(genel.metin.includes(onceki.baslik), "genel yorumda önceki sınav adı geçmeli");

  for (const y of yorumlar) {
    assert.ok(y.metin.length > 40, `${y.baslik} yorumu çok kısa`);
    assert.ok(["olumlu", "uyari", "kritik", "bilgi"].includes(y.ton));
    assert.ok(!y.metin.includes("undefined"), `${y.baslik} içinde 'undefined' var`);
    assert.ok(!y.metin.includes("NaN"), `${y.baslik} içinde NaN var`);
  }

  // Yanlış oranı eşiği aşıldığında yanlış analizi bloğu çıkmalı.
  const isaretlenen = analiz.toplamDogru + analiz.toplamYanlis;
  const yanlisOrani = analiz.toplamYanlis / isaretlenen;
  if (yanlisOrani > 0.28) assert.ok(basliklar.includes("Yanlış Analizi"));

  // İlk sınavda karşılaştırma cümlesi olmamalı.
  const ilkYorum = sinavYorumu(ogrenciFiksturu(), sinavAnalizi(sinavlar[3]), undefined, undefined, toplu);
  assert.ok(ilkYorum[0].metin.includes("ilk sınavın"));
});

test("rehberlik raporu hedef netini, dağıtımı ve önerileri üretir", () => {
  const sinavlar = sinavlariUret("TYT", 4);
  const paket = rehberlikRaporu(ogrenciFiksturu({ hedefPuan: 450 }), sinavlar);
  assert.ok(paket);
  const r = paket!.rehberlik;

  assert.ok(r.hedefNet! > 0);
  assert.equal(r.mevcutNet.toFixed(2), paket!.analiz!.toplamNet.toFixed(2));
  assert.equal(r.netAcigi, Math.max(0, r.hedefNet! - r.mevcutNet));
  assert.ok(r.oneriler.length >= 3);
  assert.ok(r.oncelikSirasi.length > 0);
  assert.ok(r.tekrarListesi.length > 0);
  // Kritik kazanımlar 1-3-7 gün tekrar alır.
  const gunler = new Set(r.tekrarListesi.map((t) => t.gun));
  assert.ok(gunler.has(1) && gunler.has(3) && gunler.has(7));

  // Ders dağıtımı hedef netin toplamına eşit olmalı (yuvarlama payı ile).
  const hedefToplam = Object.values(r.dersBazliHedefNet).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(hedefToplam - r.hedefNet!) < 1, `${hedefToplam} != ${r.hedefNet}`);

  // Hedef puansız öğrencide hedef alanları boş kalır.
  const hedefsiz = rehberlikRaporu(ogrenciFiksturu({ hedefPuan: undefined }), sinavlar);
  assert.equal(hedefsiz!.rehberlik.hedefNet, null);
  assert.equal(hedefsiz!.rehberlik.netAcigi, 0);

  // Sınavsız öğrenci için rapor yok.
  assert.equal(rehberlikRaporu(ogrenciFiksturu(), []), null);
});

test("net ↔ puan dönüşümü monoton ve ters çevrilebilir", () => {
  const puanlar = [300, 350, 400, 450, 500];
  const netler = puanlar.map((p) => puandanNet("TYT", p));
  for (let i = 1; i < netler.length; i++) assert.ok(netler[i] > netler[i - 1], "net artışı monoton olmalı");
  assert.ok(netler[0] > 0 && netler[netler.length - 1] <= 120);

  for (const p of puanlar) {
    const geri = nettenPuan("TYT", puandanNet("TYT", p));
    assert.ok(Math.abs(geri - p) < 2, `${p} -> ${geri} geri dönüş sapması`);
  }
  assert.equal(nettenPuan("TYT", 0), 100);
  assert.equal(nettenPuan("TYT", 120), 500);
  assert.equal(nettenPuan("AYT", 160), 500);
});

test("program üretici çalışma günlerine uyar, tekrar vadeleri kurar ve blok sayısı tutarlıdır", () => {
  const sinavlar = sinavlariUret("TYT", 4);
  const toplu = topluKazanimDurumu(sinavlar);
  const ogrenci = ogrenciFiksturu({ haftalikSaat: 14, blokDakika: 50, calismaGunleri: [1, 3, 5, 6] });
  const program = calismaProgramiUret(ogrenci, toplu, "TYT", {
    baslangicTarihi: "2026-10-12",
    haftaSayisi: 3,
  });

  assert.equal(program.haftaSayisi, 3);
  assert.ok(program.bloklar.length > 0);
  assert.ok(program.ozet.length >= 3);

  const gunler = gunlereGoreGrupla(program);
  assert.equal(gunler.length, 12, "4 gün × 3 hafta = 12 çalışma günü");
  for (const g of gunler) {
    const haftaGunu = new Date(g.tarih).getDay();
    assert.ok([1, 3, 5, 6].includes(haftaGunu), `${g.tarih} çalışma günü değil (${haftaGunu})`);
    assert.ok(g.toplamDakika > 0);
  }

  const tipler = new Set(program.bloklar.map((b) => b.tip));
  assert.ok(tipler.has("deneme"), "haftalık deneme bloğu yok");
  assert.ok(tipler.has("tekrar"), "aralıklı tekrar bloğu yok");
  assert.ok(tipler.has("konu") && tipler.has("test"));
  assert.ok(tipler.has("yanlis-analizi"));

  for (const b of program.bloklar) {
    assert.match(b.tarih, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(b.baslangic, /^\d{2}:\d{2}$/);
    assert.ok(b.dakika > 0);
    assert.ok(b.detay.length > 10);
  }

  // Tekrar blokları, kaynak kazanımın testinden sonra gelmeli.
  const tekrarlar = program.bloklar.filter((b) => b.tip === "tekrar" && b.kazanimId);
  assert.ok(tekrarlar.length > 0);
  for (const t of tekrarlar.slice(0, 10)) {
    const testBlogu = program.bloklar.find(
      (b) => b.tip === "test" && b.kazanimId === t.kazanimId,
    );
    assert.ok(testBlogu, `${t.kazanimId} için test bloğu yok`);
    assert.ok(t.tarih >= testBlogu!.tarih, "tekrar testten önceye düşmüş");
  }
});

test("her hafta bir deneme ve bir yanlış analizi rezerve edilir, tekrar konu çalışmasını yutmaz", () => {
  const sinavlar = sinavlariUret("TYT", 4);
  const toplu = topluKazanimDurumu(sinavlar);
  const ogrenci = ogrenciFiksturu({ haftalikSaat: 14, blokDakika: 50, calismaGunleri: [1, 2, 3, 4, 5, 6] });
  const program = calismaProgramiUret(ogrenci, toplu, "TYT", {
    baslangicTarihi: "2026-10-12",
    haftaSayisi: 3,
  });

  const deneme = program.bloklar.filter((b) => b.tip === "deneme");
  const yanlis = program.bloklar.filter((b) => b.tip === "yanlis-analizi");
  const tekrar = program.bloklar.filter((b) => b.tip === "tekrar");
  assert.equal(deneme.length, 3, "haftada bir deneme olmalı");
  assert.equal(yanlis.length, 3, "haftada bir yanlış analizi olmalı");

  // Denemeler ayrı haftalara düşmeli.
  const haftalar = new Set(deneme.map((b) => b.tarih.slice(0, 10)));
  assert.equal(haftalar.size, 3);
  // Denemeler kendi haftasının son çalışma gününde olmalı.
  const haftaNo = (iso: string) =>
    Math.floor(
      (Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) -
        Date.UTC(2026, 9, 12)) /
        (7 * 86400000),
    );
  const sonGun = new Map<number, string>();
  for (const b of program.bloklar) {
    const h = haftaNo(b.tarih);
    if (!sonGun.has(h) || b.tarih > sonGun.get(h)!) sonGun.set(h, b.tarih);
  }
  for (const d of deneme) {
    assert.equal(sonGun.get(haftaNo(d.tarih)), d.tarih, "deneme haftanın son çalışma gününde değil");
  }
  // Yanlış analizi haftanın ilk çalışma gününde olmalı.
  const ilkGun = new Map<number, string>();
  for (const b of program.bloklar) {
    const h = haftaNo(b.tarih);
    if (!ilkGun.has(h) || b.tarih < ilkGun.get(h)!) ilkGun.set(h, b.tarih);
  }
  for (const y of yanlis) {
    assert.equal(ilkGun.get(haftaNo(y.tarih)), y.tarih, "yanlış analizi haftanın ilk gününde değil");
  }
  // Tekrar tavanı: toplam blokların en fazla %25'i.
  assert.ok(
    tekrar.length <= Math.max(2, Math.floor(program.bloklar.length * 0.25)),
    `tekrar payı aşmış: ${tekrar.length}/${program.bloklar.length}`,
  );
  // Konu+test tekrarın üstünde kalmalı.
  const konuTest = program.bloklar.filter((b) => b.tip === "konu" || b.tip === "test").length;
  assert.ok(konuTest > tekrar.length, `konu+test (${konuTest}) tekrardan (${tekrar.length}) az`);
});

test("program üretici veri yoksa katalog ağırlığına göre doldurur", () => {
  const program = calismaProgramiUret(ogrenciFiksturu(), [], "TYT", {
    baslangicTarihi: "2026-10-12",
    haftaSayisi: 2,
  });
  assert.ok(program.bloklar.length > 0);
  assert.ok(program.ozet.some((s) => s.includes("kazanımı kapsıyor")));
  const kuyruk = oncelikKuyrugu([], "TYT");
  assert.equal(kuyruk.length, 40);
  assert.ok(kuyruk.every((k) => k.durum === "verisiz"));
  // Ağırlığı 3 olanlar öne alınmış olmalı.
  assert.ok(kuyruk.slice(0, 5).every((k) => k.kazanim.agirlik === 3));
});

test("oncelikliKazanimlar ölçülmüş eksikleri öne alır", () => {
  const toplu = topluKazanimDurumu(sinavlariUret("TYT", 3));
  const liste = oncelikliKazanimlar(toplu, 10);
  assert.equal(liste.length, 10);
  const olculen = liste.filter((k) => k.durum !== "verisiz");
  assert.ok(olculen.length > 0);
  for (let i = 1; i < olculen.length; i++) {
    assert.ok(olculen[i - 1].oncelik >= olculen[i].oncelik);
  }
});

test("ICS çıktısı geçerli takvim yapısında", () => {
  const program = calismaProgramiUret(ogrenciFiksturu(), topluKazanimDurumu(sinavlariUret("TYT", 2)), "TYT", {
    baslangicTarihi: "2026-10-12",
    haftaSayisi: 1,
  });
  const ics = icsUret(program, "Test Öğrenci");
  assert.ok(ics.startsWith("BEGIN:VCALENDAR"));
  assert.ok(ics.trimEnd().endsWith("END:VCALENDAR"));
  assert.equal(ics.split("BEGIN:VEVENT").length - 1, program.bloklar.length);
  assert.equal(ics.split("END:VEVENT").length - 1, program.bloklar.length);
  assert.ok(ics.includes("UID:"));
  assert.ok(ics.includes("DTSTART:2026101"));
  assert.ok(!/(^|[^\r])\n/.test(ics), "ICS satır sonları CRLF olmalı (çıplak LF var)");
});

test("LGS akışı farklı ders kümesiyle uçtan uca çalışır", () => {
  const sinavlar = sinavlariUret("LGS", 3);
  const analiz = sinavAnalizi(sinavlar[0]);
  assert.equal(analiz.dersler.length, 6);
  assert.equal(analiz.toplamSoru, 90);
  const beklenenDersler = new Set(derslerOf("LGS").map((d) => d.kod));
  assert.ok(analiz.dersler.every((d) => beklenenDersler.has(d.ders.kod)));

  const paket = rehberlikRaporu(ogrenciFiksturu({ sinavTuru: "LGS", hedefPuan: 480, sinifSeviyesi: "8" }), sinavlar);
  assert.ok(paket);
  const program = calismaProgramiUret(
    ogrenciFiksturu({ sinavTuru: "LGS" }),
    topluKazanimDurumu(sinavlar),
    "LGS",
    { baslangicTarihi: "2026-10-12", haftaSayisi: 2 },
  );
  assert.ok(program.bloklar.length > 0);
  assert.ok(program.bloklar.every((b) => b.ders === "Genel" || beklenenDersler.has(
    derslerOf("LGS").find((d) => d.ad === b.ders)?.kod ?? ("" as never),
  )));
  assert.equal(netTrendi(sinavlar).length, 3);
});

test("kazanım kataloğu AYT derslerini de kapsıyor", () => {
  for (const d of derslerOf("AYT")) {
    const k = kazanimlarOf(d.kod);
    assert.ok(k.length >= 5, `${d.kod} için kazanım sayısı az: ${k.length}`);
  }
});

test("AYT akışı alan dersleriyle uçtan uca çalışır", () => {
  const sinavlar = sinavlariUret("AYT", 3);
  const ogrenci = ogrenciFiksturu({ sinavTuru: "AYT", hedefPuan: 420 });
  const alanDersleri = derslerOf("AYT", "SAY");
  const beklenenDersler = new Set(alanDersleri.map((d) => d.kod));

  const analiz = sinavAnalizi(sinavlar[0]);
  assert.equal(analiz.dersler.length, alanDersleri.length);
  assert.equal(analiz.toplamSoru, alanDersleri.reduce((t, d) => t + d.soruSayisi, 0));
  assert.ok(analiz.dersler.every((d) => beklenenDersler.has(d.ders.kod)));
  assert.ok(analiz.netTavanOrani > 0 && analiz.netTavanOrani <= 1);

  // Sayısal alan: Matematik + Fen Bilimleri (Fizik, Kimya, Biyoloji) = 80 soru.
  const kodlar = new Set(analiz.dersler.map((d) => d.ders.kod));
  assert.ok(kodlar.has("AYT_MAT") && kodlar.has("AYT_FIZ") && kodlar.has("AYT_KIM") && kodlar.has("AYT_BIY"));
  // Sayısal aday Edebiyat/Tarih/Coğrafya/Felsefe çözmez.
  assert.ok(!kodlar.has("AYT_EDB") && !kodlar.has("AYT_TAR"));

  const kazanimlar = topluKazanimDurumu(sinavlar);
  assert.ok(kazanimlar.length > 0);
  assert.ok(kazanimlar.every((k) => k.kazanim.ders.startsWith("AYT_")));

  const paket = rehberlikRaporu(ogrenci, sinavlar);
  assert.ok(paket);
  // AYT'de sıralama tahmini üretilir. 500'ün altındaki her puan için 100'e
  // yapışan eski hataya karşı: gerçek bir sıralama 100'den büyük olmalı.
  const sira = paket.rehberlik.tahminiSiralama;
  assert.notEqual(sira, null);
  assert.ok(sira! > 100, `AYT sıralama tahmini 100'e yapışmış: ${sira}`);

  const program = calismaProgramiUret(ogrenci, kazanimlar, "AYT", {
    baslangicTarihi: "2026-10-12",
    haftaSayisi: 2,
  });
  assert.ok(program.bloklar.length > 0);
  assert.ok(program.bloklar.every((b) => b.ders === "Genel" ||
    derslerOf("AYT").some((d) => d.ad === b.ders)));

  const ics = icsUret(program, ogrenci.ad);
  assert.ok(ics.includes("BEGIN:VCALENDAR") && ics.includes("END:VCALENDAR"));
  assert.equal(netTrendi(sinavlar).length, 3);
});

test("tipAdi tabloda olmayan tipte undefined sızmaz", () => {
  for (const t of ["konu", "test", "tekrar", "deneme", "yanlis-analizi"] as const) {
    assert.ok(tipAdi(t).length > 0, `${t} için boş ad`);
  }
  // lib/rapor.ts genişletilmiş anahtarla çağırabiliyor; "undefined" metne sızmamalı.
  const bilinmeyen = tipAdi("olmayan-tip" as never);
  assert.equal(bilinmeyen, "olmayan-tip");
  assert.ok(!bilinmeyen.includes("undefined"));
});

test("rehberlikOzetSatiri sınav yokken ölçülmüş sonuç gibi görünmez", () => {
  const satir = rehberlikOzetSatiri(ogrenciFiksturu(), []);
  assert.ok(satir.includes("henüz sınav verisi yok"), satir);
  assert.ok(!/0\.00 \/ \d+ net/.test(satir), `veri yokken net gösteriyor: ${satir}`);

  const sinavlar = sinavlariUret("TYT", 2);
  const dolu = rehberlikOzetSatiri(ogrenciFiksturu(), sinavlar);
  assert.match(dolu, /\d+\.\d{2} \/ \d+ net/);
  assert.ok(dolu.includes("450 puan hedefi"));
});
