import assert from "node:assert/strict";
import { test } from "node:test";
import { rehberlikRaporuUret, duzMetneCevir } from "../lib/rapor";
import { sinavAnalizi, topluKazanimDurumu, netTrendi } from "../lib/analysis";
import { siniflandir } from "../lib/rehberlik-core";
import { calismaProgramiUret } from "../lib/plan";
import { demoKarnelerUret } from "../lib/okulizyon/demo";
import { karneListesiHazirla } from "../lib/okulizyon/import";
import type { Ogrenci, Sinav } from "../lib/types";

function ogrenci(over: Partial<Ogrenci> = {}): Ogrenci {
  return {
    id: "rapor-1",
    ad: "Elif Yılmaz",
    sinifSeviyesi: "12",
    sinavTuru: "TYT",
    hedefPuan: 450,
    hedefSiralama: 40000,
    haftalikSaat: 14,
    blokDakika: 50,
    calismaGunleri: [1, 2, 3, 4, 5, 6],
    olusturulma: "2026-01-01T00:00:00.000Z",
    guncelleme: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

function sinavlariUret(tur: "TYT" | "AYT" | "LGS", adet = 4): Sinav[] {
  return karneListesiHazirla(demoKarnelerUret(tur, "rapor-tohum", adet), tur, "rapor-1", "rapor").map(
    (s, i) => ({ ...s, id: `r${i}` }),
  );
}

test("rapor: sınav yoksa null döner", () => {
  assert.equal(rehberlikRaporuUret(ogrenci(), [], null), null);
});

test("rapor: tüm bölümler üretildi ve ölçülen sayılar metne işlendi", () => {
  const sinavlar = sinavlariUret("TYT", 4);
  const rapor = rehberlikRaporuUret(ogrenci(), sinavlar, null);
  assert.ok(rapor);

  const basliklar = rapor!.bolumler.map((b) => b.baslik);
  for (const beklenen of [
    "1. Genel Durum",
    "2. Ders Bazlı Değerlendirme",
    "3. Kazanım Düzeyinde Eksikler",
    "4. Güçlü Alanlar",
    "6. Önerilen Çalışma Düzeni",
    "7. Rehberlik Notları",
    "8. Ölçüm ve Yöntem Notu",
  ]) {
    // 5. bölüm yalnızca hedef puan tanımlıyken üretilir; 6. yalnızca program varsa.
    if (beklenen === "6. Önerilen Çalışma Düzeni") continue;
    assert.ok(basliklar.includes(beklenen), `eksik bölüm: ${beklenen}`);
  }
  assert.ok(basliklar.includes("5. Hedef Karşılaştırması"), "hedef puan varken 5. bölüm üretilmeli");

  // Genel durum bölümü gerçek ölçüm sayılarını içermeli.
  const sirali = [...sinavlar].sort((a, b) => b.tarih.localeCompare(a.tarih));
  const analiz = sinavAnalizi(sirali[0], sirali[1]);
  const genel = rapor!.bolumler[0].paragraflar.join(" ");
  assert.ok(genel.includes(String(analiz.toplamDogru)), "doğru sayısı raporda yok");
  assert.ok(genel.includes(String(analiz.toplamYanlis)), "yanlış sayısı raporda yok");
  assert.ok(genel.includes(String(analiz.toplamBos)), "boş sayısı raporda yok");
  assert.ok(genel.includes(analiz.toplamNet.toFixed(2)), "net raporda yok");
  assert.ok(genel.includes(sirali[0].baslik), "sınav adı raporda yok");
  // Bir önceki sınavla kıyas cümlesi olmalı.
  assert.ok(genel.includes(sirali[1].baslik), "önceki sınavla kıyas yok");

  // Kaynak alanı analizle tutarlı olmalı.
  const toplu = topluKazanimDurumu(sirali);
  assert.equal(rapor!.kaynak.sonNet, analiz.toplamNet);
  assert.equal(rapor!.kaynak.sinavSayisi, 4);
  assert.equal(rapor!.kaynak.toplamKazanim, toplu.length);
  assert.equal(rapor!.kaynak.olculenKazanim, toplu.filter((k) => k.durum !== "verisiz").length);
  const hedef = siniflandir(ogrenci(), analiz, toplu);
  assert.equal(rapor!.kaynak.hedefNet, hedef!.hedefNet);

  // Ders tablosu her dersi kapsamalı.
  const dersTablo = rapor!.bolumler.find((b) => b.baslik.startsWith("2."))!.tablo!;
  assert.equal(dersTablo.satirlar.length, analiz.dersler.length);
  assert.equal(dersTablo.basliklar.length, dersTablo.satirlar[0].length);

  // Hedef tablosu ders sayısı kadar satır içermeli.
  const hedefTablo = rapor!.bolumler.find((b) => b.baslik.startsWith("5."))!.tablo!;
  assert.equal(hedefTablo.satirlar.length, analiz.dersler.length);
});

test("rapor: hiçbir hücrede undefined/NaN sızmaz", () => {
  const sinavlar = sinavlariUret("TYT", 3);
  const program = calismaProgramiUret(ogrenci(), topluKazanimDurumu(sinavlar), "TYT", {
    baslangicTarihi: "2026-10-12",
    haftaSayisi: 3,
  });
  const rapor = rehberlikRaporuUret(ogrenci(), sinavlar, program);
  assert.ok(rapor);

  const tumMetin = rapor!.bolumler
    .flatMap((b) => [
      b.baslik,
      b.ozet ?? "",
      ...b.paragraflar,
      ...(b.liste ?? []).map((l) => l.madde),
      ...(b.tablo ? b.tablo.basliklar.concat(b.tablo.satirlar.flat()) : []),
    ])
    .join(" ");

  assert.ok(!tumMetin.includes("undefined"), "raporda 'undefined' var");
  assert.ok(!tumMetin.includes("NaN"), "raporda NaN var");
  assert.ok(!tumMetin.includes("[object"), "raporda serileştirilmemiş nesne var");
  for (const b of rapor!.bolumler) {
    assert.ok(b.paragraflar.length > 0, `${b.baslik} boş`);
    for (const p of b.paragraflar) assert.ok(p.length > 40, `${b.baslik} paragrafı çok kısa`);
  }
});

test("rapor: program varsa 6. bölüm ve haftalık özet tablosu üretilir", () => {
  const sinavlar = sinavlariUret("TYT", 4);
  const toplu = topluKazanimDurumu(sinavlar);
  const program = calismaProgramiUret(ogrenci(), toplu, "TYT", {
    baslangicTarihi: "2026-10-12",
    haftaSayisi: 3,
  });
  const rapor = rehberlikRaporuUret(ogrenci(), sinavlar, program);
  const bolum = rapor!.bolumler.find((b) => b.baslik.startsWith("6."));
  assert.ok(bolum, "program verilmesine rağmen 6. bölüm yok");
  assert.equal(bolum!.tablo!.satirlar.length, 3, "3 haftalık özet bekleniyor");
  assert.ok(bolum!.paragraflar.join(" ").includes(String(program.bloklar.length)));

  // Programsız raporda 6. bölüm olmamalı.
  const programsiz = rehberlikRaporuUret(ogrenci(), sinavlar, null);
  assert.ok(!programsiz!.bolumler.some((b) => b.baslik.startsWith("6.")));
});

test("rapor: hedef puansız öğrencide 5. bölüm üretilmez, metin yine tutarlıdır", () => {
  const sinavlar = sinavlariUret("TYT", 3);
  const rapor = rehberlikRaporuUret(ogrenci({ hedefPuan: undefined, hedefSiralama: undefined }), sinavlar, null);
  assert.ok(!rapor!.bolumler.some((b) => b.baslik.startsWith("5.")));
  assert.equal(rapor!.kaynak.hedefNet, null);
  assert.ok(!rapor!.kunye.some((k) => k.etiket === "Hedef"));
  assert.ok(!rapor!.duzMetin.includes("undefined"));
});

test("düz metin, bölüm yapısını birebir yansıtır ve künye ile başlar", () => {
  const sinavlar = sinavlariUret("TYT", 4);
  const rapor = rehberlikRaporuUret(ogrenci(), sinavlar, null)!;
  const metin = rapor.duzMetin;

  assert.ok(metin.startsWith(rapor.baslik.toUpperCase()));
  for (const b of rapor.bolumler) {
    assert.ok(metin.includes(b.baslik.toUpperCase()), `düz metinde eksik bölüm: ${b.baslik}`);
    for (const p of b.paragraflar) assert.ok(metin.includes(p), "paragraf düz metne taşınmamış");
  }
  for (const k of rapor.kunye) assert.ok(metin.includes(`${k.etiket}: ${k.deger}`), `künye eksik: ${k.etiket}`);
  assert.ok(metin.includes("T-puan"), "yaklaşım uyarısı düz metinde yok");

  // Aynı rapordan iki kez üretilen metin aynı olmalı (deterministik).
  assert.equal(duzMetneCevir(rapor), metin);
});

test("LGS raporu farklı ders kümesi ve net varsayımıyla üretilir", () => {
  const sinavlar = sinavlariUret("LGS", 3);
  const rapor = rehberlikRaporuUret(
    ogrenci({ sinavTuru: "LGS", sinifSeviyesi: "8", hedefPuan: 480, hedefSiralama: undefined }),
    sinavlar,
    null,
  )!;
  const genel = rapor.bolumler[0].paragraflar.join(" ");
  assert.ok(genel.includes("90 soruluk"), `LGS soru sayısı yanlış: ${genel.slice(0, 200)}`);
  const yontem = rapor.bolumler.find((b) => b.baslik.startsWith("8."))!.paragraflar.join(" ");
  assert.ok(yontem.includes("3 yanlış 1 doğruyu götürür"), "LGS net varsayımı yanlış");
  const dersTablo = rapor.bolumler.find((b) => b.baslik.startsWith("2."))!.tablo!;
  assert.equal(dersTablo.satirlar.length, 6);
});

test("tek sınavlı öğrencide kıyas cümlesi 'ilk sınav' der, çökmez", () => {
  const sinavlar = sinavlariUret("TYT", 1);
  const rapor = rehberlikRaporuUret(ogrenci(), sinavlar, null)!;
  const genel = rapor.bolumler[0].paragraflar.join(" ");
  assert.ok(genel.includes("ilk sınavı"), "tek sınavda kıyas cümlesi yanlış");
  assert.ok(!rapor.duzMetin.includes("undefined"));
  assert.equal(netTrendi(sinavlar).length, 1);
});

/**
 * AYT puanı tek başına YKS yerleştirme puanı değildir: gerçek puan TYT ve AYT
 * puanlarının ağırlıklı toplamıdır. Rapor bu ayrımı söylemezse öğrenci AYT
 * netinden türetilen sayıyı yerleştirme puanı sanır.
 */
test("rapor: AYT'de TYT katkısının dahil olmadığı açıkça söylenir, TYT'de söylenmez", () => {
  const aytSinavlari = sinavlariUret("AYT", 3);
  const aytRapor = rehberlikRaporuUret(ogrenci({ sinavTuru: "AYT", aytAlani: "SAY" }), aytSinavlari, null);
  assert.ok(aytRapor);
  const aytMetin = duzMetneCevir(aytRapor!);
  assert.match(aytMetin, /YKS yerleştirme puanı/);
  assert.match(aytMetin, /yalnızca AYT netinden türetilmiştir/);
  assert.match(aytMetin, /TYT sonucu bu hesapta yer almaz/);

  const tytSinavlari = sinavlariUret("TYT", 3);
  const tytRapor = rehberlikRaporuUret(ogrenci({ sinavTuru: "TYT" }), tytSinavlari, null);
  assert.ok(tytRapor);
  const tytMetin = duzMetneCevir(tytRapor!);
  // TYT öğrencisi için bu uyarı anlamsız; gereksiz yere eklenmemeli.
  assert.ok(
    !tytMetin.includes("YKS yerleştirme puanı, TYT ve AYT"),
    "TYT raporunda AYT uyarısı var",
  );
});
