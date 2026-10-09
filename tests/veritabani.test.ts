import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import * as db from "../lib/db";
import { demoKarnelerUret } from "../lib/okulizyon/demo";
import { karneListesiHazirla } from "../lib/okulizyon/import";

// db veri dizinini tembel okuduğu için bu atama ilk db çağrısından önce yapılmış oluyor.
const geciciDizin = mkdtempSync(path.join(tmpdir(), "panel-test-"));
process.env.DATA_DIR = geciciDizin;

test("öğrenci ekle / oku / güncelle / sil döngüsü", () => {
  const o = db.ogrenciEkle({
    ad: "Deneme Öğrenci",
    sinavTuru: "TYT",
    sinifSeviyesi: "12",
    hedefPuan: 430,
    haftalikSaat: 10,
    calismaGunleri: [1, 2, 3, 4, 5],
    blokDakika: 45,
  });
  assert.ok(o.id);
  assert.equal(db.ogrenciBul(o.id)?.ad, "Deneme Öğrenci");
  assert.equal(db.ogrenciler().length, 1);

  const guncel = db.ogrenciGuncelle(o.id, { haftalikSaat: 18 });
  assert.equal(guncel?.haftalikSaat, 18);
  assert.notEqual(guncel?.guncelleme, o.guncelleme);

  assert.equal(db.ogrenciBul("yok-boyle-id"), undefined);
  assert.equal(db.ogrenciGuncelle("yok-boyle-id", { ad: "x" }), undefined);
});

test("sınav kaydı yinelenirse güncellenir, çoğalmaz", () => {
  const o = db.ogrenciler()[0];
  const ham = demoKarnelerUret("TYT", "db-tohum", 3);
  const sinavlar = karneListesiHazirla(ham, "TYT", o.id, "kaynak-1");
  assert.equal(sinavlar.length, 3);

  const ilk = db.sinavKaydet(sinavlar);
  assert.equal(ilk.eklenen, 3);
  assert.equal(ilk.guncellenen, 0);
  assert.equal(db.sinavlar(o.id).length, 3);

  const ikinci = db.sinavKaydet(karneListesiHazirla(ham, "TYT", o.id, "kaynak-1"));
  assert.equal(ikinci.eklenen, 0);
  assert.equal(ikinci.guncellenen, 3);
  assert.equal(db.sinavlar(o.id).length, 3, "yinelenen senkron kayıt şişirdi");

  const id = db.sinavlar(o.id)[0].id;
  assert.equal(db.sinavSil(id), true);
  assert.equal(db.sinavlar(o.id).length, 2);
  assert.equal(db.sinavSil(id), false);
});

test("bağlantı ayarları saklanır ama şifre modeli hiç yoktur", () => {
  const kayitli = db.baglantiKaydet({
    aktif: true,
    baseUrl: "https://ornek.example",
    mod: "http",
    ogrenciNo: "12345",
  });
  assert.equal(kayitli.aktif, true);
  assert.equal(db.baglantiAyari().baseUrl, "https://ornek.example");
  assert.equal(db.baglantiAyari().mod, "http");
  // Varsayılanlar korunur (kısmi güncelleme diğer alanları silmez).
  assert.equal(db.baglantiAyari().karneEndpoint, "/api/karne");
  assert.ok(!("sifre" in (db.baglantiAyari() as unknown as Record<string, unknown>)), "şifre kalıcı modele sızmış");

  const sifirlanmis = db.baglantiKaydet({ ...db.VARSAYILAN_BAGLANTI });
  assert.equal(sifirlanmis.aktif, false);
  assert.equal(sifirlanmis.baseUrl, "");
});

test("çalışma programı diske yazılıp geri okunur", () => {
  const o = db.ogrenciler()[0];
  const program = {
    ogrenciId: o.id,
    baslangicTarihi: "2026-10-12",
    haftaSayisi: 2,
    haftalikSaat: 10,
    olusturulma: new Date().toISOString(),
    bloklar: [
      {
        id: "b1",
        tarih: "2026-10-12",
        baslangic: "17:00",
        dakika: 50,
        tip: "konu" as const,
        ders: "TYT Matematik",
        baslik: "Test blok",
        detay: "Kalıcılık kontrolü için yazıldı.",
      },
    ],
    ozet: ["Özet satırı."],
  };
  db.programKaydet(program);
  const geri = db.programOku(o.id);
  assert.equal(geri?.bloklar.length, 1);
  assert.equal(geri?.bloklar[0].baslik, "Test blok");
  db.programSil(o.id);
  assert.equal(db.programOku(o.id), null);
  assert.equal(db.programOku("yok-boyle-ogrenci"), null);
});

test("öğrenci silinince sınavları da silinir", () => {
  const o = db.ogrenciler()[0];
  assert.ok(db.sinavlar(o.id).length > 0);
  assert.equal(db.ogrenciSil(o.id), true);
  assert.equal(db.sinavlar(o.id).length, 0);
  assert.equal(db.ogrenciSil(o.id), false);
});

test("bozuk veri dosyası paneli çökertmez", () => {
  writeFileSync(path.join(geciciDizin, "panel.json"), "{ bozuk", "utf8");
  assert.deepEqual(db.ogrenciler(), []);
  assert.deepEqual(db.sinavlar("herhangi"), []);
  assert.equal(db.baglantiAyari().mod, "demo");
});

process.on("exit", () => rmSync(geciciDizin, { recursive: true, force: true }));
