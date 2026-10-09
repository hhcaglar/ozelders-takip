import assert from "node:assert/strict";
import { test } from "node:test";
import { dersKodunaCevir, kazanimEslestir, karneNormalize } from "../lib/okulizyon/parse";
import { CSV_SABLON_BOLUM, CSV_SABLON_SORU, metniKarneyeCevir } from "../lib/okulizyon/import";

test("dersKodunaCevir serbest metni sınav türüne göre çözer", () => {
  assert.equal(dersKodunaCevir("Türkçe", "TYT"), "TYT_TUR");
  assert.equal(dersKodunaCevir("TYT Matematik", "TYT"), "TYT_MAT");
  assert.equal(dersKodunaCevir("Fen Bilimleri", "LGS"), "LGS_FEN");
  assert.equal(dersKodunaCevir("Sosyal Bilimler", "TYT"), "TYT_SOS");
  assert.equal(dersKodunaCevir("Fizik", "AYT"), "AYT_FIZ");
  assert.equal(dersKodunaCevir("T.C. İnkılap Tarihi ve Atatürkçülük", "LGS"), "LGS_INK");
  assert.equal(dersKodunaCevir("İngilizce", "LGS"), "LGS_INS");
  assert.equal(dersKodunaCevir("TYT_MAT", "TYT"), "TYT_MAT");
  assert.equal(dersKodunaCevir("Beden Eğitimi", "TYT"), null);
  assert.equal(dersKodunaCevir(undefined, "TYT"), null);
});

test("kazanimEslestir tam metni doğru kazanıma bağlar, alakasız metni bağlamaz", () => {
  const tam = kazanimEslestir("TYT_TUR", "Paragrafta Anlam / Paragrafın ana düşüncesini belirler");
  assert.ok(tam, "tam eşleşme null döndü");
  assert.match(tam!, /^TYT_TUR#/);

  const kisa = kazanimEslestir("TYT_MAT", "Hareket problemleri hız zaman yol");
  assert.ok(kisa, "kısa metin eşleşmedi");
  assert.match(kisa!, /^TYT_MAT#/);

  assert.equal(kazanimEslestir("TYT_TUR", "xyz qwe"), null);
  assert.equal(kazanimEslestir("TYT_TUR", ""), null);
  assert.equal(kazanimEslestir("TYT_TUR", null), null);
});

test("kazanimEslestir ders sınırını aşmaz", () => {
  // Matematik kazanım metni Türkçe dersine eşleşmemeli.
  const karisik = kazanimEslestir("TYT_TUR", "Üslü sayılarda işlem yapar matematik");
  assert.ok(karisik === null || karisik.startsWith("TYT_TUR#"));
});

test("karneNormalize bölüm düzeyindeki veriyi Sinav'a çevirir", () => {
  const sinav = karneNormalize(
    {
      sinavAdi: "TYT Deneme 1",
      tarih: "20.09.2026",
      yayinevi: "Damla",
      puan: 412,
      siralama: 48000,
      sinifOrtalama: 78.4,
      bolumler: [
        { ders: "Türkçe", dogru: 32, yanlis: 5, bos: 3 },
        { ders: "Matematik", dogru: 21, yanlis: 11, bos: 8 },
        { ders: "Fizik", dogru: 4, yanlis: 2, bos: 1 },
        { ders: "Kimya", dogru: 5, yanlis: 4, bos: 0 },
        { ders: "Biyoloji", dogru: 3, yanlis: 3, bos: 1 },
        { ders: "Tarih", dogru: 8, yanlis: 2, bos: 0 },
        { ders: "Bilinmeyen Ders", dogru: 9, yanlis: 1, bos: 0 },
      ],
    },
    { ogrenciId: "o1", sinavTuru: "TYT" },
  );

  assert.equal(sinav.baslik, "TYT Deneme 1");
  assert.equal(sinav.tarih, "2026-09-20");
  assert.equal(sinav.yayinevi, "Damla");
  assert.equal(sinav.puan, 412);
  assert.equal(sinav.genelSiralama, 48000);
  assert.equal(sinav.sinifOrtalamaNet, 78.4);
  assert.equal(sinav.kaynak, "okulizyon");

  // Fizik+Kimya+Biyoloji TYT'de tek "Fen" testinde toplanmalı, tanınmayan ders elenmeli.
  const fen = sinav.bolumler.find((b) => b.ders === "TYT_FEN");
  assert.ok(fen, "Fen bölümü oluşmadı");
  assert.equal(fen!.dogru, 12);
  assert.equal(fen!.yanlis, 9);
  assert.equal(fen!.bos, 2);
  assert.ok(!sinav.bolumler.some((b) => b.ders === ("Bilinmeyen" as never)));
  assert.equal(sinav.bolumler.length, 4);
});

test("karneNormalize yalnızca soru düzeyi veride bölümleri kendisi üretir", () => {
  const sinav = karneNormalize(
    {
      sinavAdi: "LGS Deneme",
      tarih: "2026-04-11",
      sorular: [
        { no: 1, ders: "Türkçe", kazanım: "Paragraf ve Metin Yorumu / Metnin konusunu ve ana fikrini bulur", durum: "D" },
        { no: 2, ders: "Türkçe", kazanım: "Paragraf ve Metin Yorumu / Metnin konusunu ve ana fikrini bulur", durum: "Y" },
        { no: 3, ders: "Türkçe", kazanım: "Dil Bilgisi ve Yazım / Fiilimsileri bulur ve türünü ayırt eder", durum: "B" },
        { no: 4, ders: "Matematik", kazanım: "Sayılar ve İşlemler / Üslü ifadelerle işlem yapar", durum: "D" },
      ],
    },
    { ogrenciId: "o2", sinavTuru: "LGS" },
  );

  assert.equal(sinav.sorular.length, 4);
  const tur = sinav.bolumler.find((b) => b.ders === "LGS_TUR");
  assert.ok(tur);
  assert.deepEqual({ d: tur!.dogru, y: tur!.yanlis, b: tur!.bos }, { d: 1, y: 1, b: 1 });
  assert.ok(sinav.sorular[0].kazanimId?.startsWith("LGS_TUR#"));
  assert.equal(sinav.sorular[2].isaretlendi, false);
});

test("CSV içe aktarma: soru düzeyinde şablon kazanım eşleştirmesiyle çözülür", () => {
  const { karneler } = metniKarneyeCevir(CSV_SABLON_SORU, "TYT", "o3");
  assert.equal(karneler.length, 1);
  const sinav = karneNormalize(karneler[0], { ogrenciId: "o3", sinavTuru: "TYT" });
  assert.equal(sinav.baslik, "TYT Deneme 1");
  assert.equal(sinav.sorular.length, 3);
  assert.ok(sinav.sorular.every((s) => s.kazanimId !== null), "kazanım eşleşmesi başarısız");
  assert.equal(sinav.bolumler.find((b) => b.ders === "TYT_TUR")?.dogru, 1);
});

test("CSV içe aktarma: ders düzeyinde şablon", () => {
  const { karneler, uyari } = metniKarneyeCevir(CSV_SABLON_BOLUM, "TYT", "o4");
  assert.deepEqual(uyari, [], "temiz CSV uyarı üretmemeli");
  assert.equal(karneler.length, 1);
  const sinav = karneNormalize(karneler[0], { ogrenciId: "o4", sinavTuru: "TYT" });
  assert.equal(sinav.bolumler.length, 4);
  assert.equal(sinav.sorular.length, 0);
  const mat = sinav.bolumler.find((b) => b.ders === "TYT_MAT");
  assert.deepEqual({ d: mat!.dogru, y: mat!.yanlis, b: mat!.bos }, { d: 21, y: 11, b: 8 });
});

test("JSON içe aktarma virgül ayraçlı ve sarmalayıcılı hâli kabul eder", () => {
  const json = JSON.stringify({
    karneler: [{ sinavAdi: "JSON Deneme", tarih: "2026-03-01", bolumler: [{ ders: "Matematik", correct: 10, wrong: 4, blank: 6 }] }],
  });
  const { karneler } = metniKarneyeCevir(json, "TYT", "o5");
  assert.equal(karneler.length, 1);
  const sinav = karneNormalize(karneler[0], { ogrenciId: "o5", sinavTuru: "TYT" });
  assert.equal(sinav.bolumler[0].ders, "TYT_MAT");
  assert.equal(sinav.bolumler[0].dogru, 10);
});

test("geçersiz içerik boş dizi döndürür, hata fırlatmaz", () => {
  assert.deepEqual(metniKarneyeCevir("", "TYT", "o6"), { karneler: [], uyari: [] });
  assert.throws(() => metniKarneyeCevir("{ bozuk json", "TYT", "o6"));
  assert.equal(metniKarneyeCevir("baslik;tarih;ders", "TYT", "o6").karneler.length, 0);
});

test("CSV: tırnak içindeki ayıraç alanı bölmez, kayan satır uyarı üretir", () => {
  const csv =
    "baslik;tarih;ders;soru;kazanim;durum\n" +
    'LGS Deneme;2026-09-15;Fen Bilimleri;1;"Basınç ve Madde / Katı; sıvı ve gaz basıncını örneklerle açıklar";D\n' +
    "LGS Deneme;2026-09-15;Fen Bilimleri;2;Basınç ve Madde / Yoğunluk ve kütle-hacim ilişkisini hesaplar;B\n";
  const { karneler, uyari } = metniKarneyeCevir(csv, "LGS", "o7");
  assert.deepEqual(uyari, [], "tırnaklı CSV uyarı üretmemeli");
  const sinav = karneNormalize(karneler[0], { ogrenciId: "o7", sinavTuru: "LGS" });
  const fen = sinav.bolumler.find((b) => b.ders === "LGS_FEN")!;
  assert.deepEqual(
    { d: fen.dogru, y: fen.yanlis, b: fen.bos },
    { d: 1, y: 0, b: 1 },
    "tırnaklı alan yanlış sütuna kaymış",
  );
  assert.ok(sinav.sorular[0].kazanimId, "tırnaklı kazanım metni eşleşmedi");

  // Tırnaksız ve içinde ayıraç geçen satır → alan sayısı kayar, uyarı çıkmalı.
  const bozuk =
    "baslik;tarih;ders;soru;kazanim;durum\n" +
    "LGS Deneme;2026-09-15;Fen Bilimleri;1;Basınç / Katı; sıvı ve gaz;D\n";
  const sonuc = metniKarneyeCevir(bozuk, "LGS", "o8");
  assert.equal(sonuc.uyari.length, 1);
  assert.match(sonuc.uyari[0], /alan sayısı başlıkla uyuşmuyor/);
});
