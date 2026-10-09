import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";

// db veri dizinini tembel okuduğu için bu atama ilk db çağrısından önce yapılmış oluyor.
const geciciDizin = mkdtempSync(path.join(tmpdir(), "panel-api-test-"));
process.env.DATA_DIR = geciciDizin;

import { ogrenciEkle, sinavKaydet, sinavlar } from "../lib/db";
import { karneListesiHazirla, CSV_SABLON_BOLUM, CSV_SABLON_SORU } from "../lib/okulizyon/import";
import { demoKarnelerUret } from "../lib/okulizyon/demo";
import { POST as importPOST } from "../app/api/import/route";
import { GET as examsGET, DELETE as examsDELETE } from "../app/api/exams/route";
import { GET as studentsGET, POST as studentsPOST } from "../app/api/students/route";
import {
  GET as studentGET,
  PATCH as studentPATCH,
} from "../app/api/students/[id]/route";
import { ogrenciBul } from "../lib/db";

after(() => rmSync(geciciDizin, { recursive: true, force: true }));

function istek(url: string, init?: RequestInit) {
  return new Request(`http://test.local${url}`, init);
}

function jsonGovde(govde: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(govde),
  };
}

async function yanit(r: Response) {
  return { durum: r.status, govde: (await r.json()) as Record<string, unknown> };
}

const ogrenci = ogrenciEkle({
  ad: "API Test Öğrenci",
  sinavTuru: "TYT",
  sinifSeviyesi: "12",
  hedefPuan: 430,
  haftalikSaat: 12,
  calismaGunleri: [1, 2, 3, 4, 5],
  blokDakika: 50,
});

/* ── POST /api/import ─────────────────────────────────────────────── */

test("import: eksik/bozuk gövde 400 döner", async () => {
  const eksik = await yanit(await importPOST(istek("/api/import", jsonGovde({ ogrenciId: "" }))));
  assert.equal(eksik.durum, 400);

  const kisa = await yanit(await importPOST(istek("/api/import", jsonGovde({ ogrenciId: ogrenci.id, icerik: "ab" }))));
  assert.equal(kisa.durum, 400);

  const jsonDegil = await yanit(
    await importPOST(istek("/api/import", { method: "POST", body: "bu json değil {{{" })),
  );
  assert.equal(jsonDegil.durum, 400);
});

test("import: olmayan öğrenci 404 döner", async () => {
  const r = await yanit(
    await importPOST(istek("/api/import", jsonGovde({ ogrenciId: "yok-boyle-id", icerik: CSV_SABLON_BOLUM }))),
  );
  assert.equal(r.durum, 404);
});

test("import: bozuk JSON 400 döner ve çözümleme hatasını taşır", async () => {
  const r = await yanit(
    await importPOST(istek("/api/import", jsonGovde({ ogrenciId: ogrenci.id, icerik: "{bozuk json" }))),
  );
  assert.equal(r.durum, 400);
  assert.match(String(r.govde.hata), /çözümlenemedi/);
});

test("import: çözümlenen ama karne üretmeyen içerik 400 döner", async () => {
  // CSV olarak okunur ama hiçbir satır karneye dönüşmez: ayrı bir 400 dalı.
  const r = await yanit(
    await importPOST(istek("/api/import", jsonGovde({ ogrenciId: ogrenci.id, icerik: ";;;bozuk;;;veri;;;" }))),
  );
  assert.equal(r.durum, 400);
  assert.match(String(r.govde.hata), /karne bulunamadı/);
});

test("import: hiçbir ders tanınmazsa 422 döner ve kayıt oluşturmaz", async () => {
  const once = sinavlar(ogrenci.id).length;
  const icerik = "Deneme;2026-09-20;KuantumFizigi;10;5;5\nDeneme;2026-09-20;Mitoloji;8;2;0\n";
  const r = await yanit(
    await importPOST(istek("/api/import", jsonGovde({ ogrenciId: ogrenci.id, icerik }))),
  );
  assert.equal(r.durum, 422);
  assert.equal(sinavlar(ogrenci.id).length, once, "422 sonrası kayıt eklenmemeli");
});

test("import: geçerli CSV 200 döner ve sınavları kaydeder", async () => {
  const r = await yanit(
    await importPOST(istek("/api/import", jsonGovde({ ogrenciId: ogrenci.id, icerik: CSV_SABLON_BOLUM }))),
  );
  assert.equal(r.durum, 200);
  assert.ok(Number(r.govde.eklenen) >= 1, `eklenen: ${JSON.stringify(r.govde)}`);
  assert.ok(sinavlar(ogrenci.id).length >= 1);
});

test("import: soru bazlı CSV şablonu da çalışır", async () => {
  const r = await yanit(
    await importPOST(istek("/api/import", jsonGovde({ ogrenciId: ogrenci.id, icerik: CSV_SABLON_SORU }))),
  );
  assert.equal(r.durum, 200);
});

/* ── GET/DELETE /api/exams ────────────────────────────────────────── */

test("exams GET: ogrenciId zorunlu", async () => {
  const eksik = await yanit(await examsGET(istek("/api/exams")));
  assert.equal(eksik.durum, 400);

  const dolu = await yanit(await examsGET(istek(`/api/exams?ogrenciId=${ogrenci.id}`)));
  assert.equal(dolu.durum, 200);
  assert.ok(Array.isArray(dolu.govde.sinavlar));
  // Liste tarihe göre azalan sıralı olmalı.
  const tarihler = (dolu.govde.sinavlar as { tarih: string }[]).map((s) => s.tarih);
  const sirali = [...tarihler].sort().reverse();
  assert.deepEqual(tarihler, sirali);
});

test("exams DELETE: id zorunlu ve gerçek kaydı siler", async () => {
  const eksik = await yanit(await examsDELETE(istek("/api/exams", { method: "DELETE" })));
  assert.equal(eksik.durum, 400);

  const eklenen = sinavKaydet(
    karneListesiHazirla(demoKarnelerUret("TYT", "sil-tohum", 1), "TYT", ogrenci.id, "test"),
  );
  assert.equal(eklenen.eklenen, 1);
  const hedef = sinavlar(ogrenci.id)[0];
  const once = sinavlar(ogrenci.id).length;

  const r = await yanit(await examsDELETE(istek(`/api/exams?id=${hedef.id}`, { method: "DELETE" })));
  assert.equal(r.durum, 200);
  assert.equal(r.govde.silindi, true);
  assert.equal(sinavlar(ogrenci.id).length, once - 1);

  // Aynı id tekrar silinemez.
  const tekrar = await yanit(await examsDELETE(istek(`/api/exams?id=${hedef.id}`, { method: "DELETE" })));
  assert.equal(tekrar.govde.silindi, false);
});

/* ── /api/students ────────────────────────────────────────────────── */

test("students: liste döner ve yeni öğrenci eklenir", async () => {
  const liste = await yanit(await studentsGET());
  assert.equal(liste.durum, 200);
  assert.ok(Array.isArray(liste.govde.ogrenciler));

  const ekle = await yanit(
    await studentsPOST(
      istek(
        "/api/students",
        jsonGovde({
          ad: "API Yeni",
          sinavTuru: "LGS",
          sinifSeviyesi: "8",
          haftalikSaat: 10,
          calismaGunleri: [1, 2, 3, 4, 5],
          blokDakika: 40,
        }),
      ),
    ),
  );
  assert.equal(ekle.durum, 201);
  const sonra = await yanit(await studentsGET());
  const adlar = (sonra.govde.ogrenciler as { ad: string }[]).map((o) => o.ad);
  assert.ok(adlar.includes("API Yeni"));
});

test("students: zorunlu alanlar eksikse 400 döner", async () => {
  // ad yok
  const adsiz = await studentsPOST(
    istek("/api/students", jsonGovde({ sinavTuru: "TYT", haftalikSaat: 10, calismaGunleri: [1], blokDakika: 50 })),
  );
  assert.equal(adsiz.status, 400);

  // haftalikSaat / calismaGunleri / blokDakika yok
  const eksik = await studentsPOST(istek("/api/students", jsonGovde({ ad: "Eksik Alan", sinavTuru: "TYT" })));
  assert.equal(eksik.status, 400);

  // geçersiz sınav türü
  const tur = await studentsPOST(
    istek(
      "/api/students",
      jsonGovde({ ad: "Yanlış Tür", sinavTuru: "KPSS", haftalikSaat: 10, calismaGunleri: [1], blokDakika: 50 }),
    ),
  );
  assert.equal(tur.status, 400);
});

/* ── PATCH /api/students/[id] ─────────────────────────────────────── */

async function patch(id: string, govde: unknown) {
  const r = await studentPATCH(
    istek(`/api/students/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(govde),
    }),
    { params: Promise.resolve({ id }) },
  );
  return { durum: r.status, govde: (await r.json()) as Record<string, unknown> };
}

/**
 * Regresyon: PATCH ham `Partial<Ogrenci>` kabul ediyordu. Geçersiz sinavTuru,
 * aytAlani, negatif blokDakika ve 9999 haftalikSaat doğrudan kalıcılaşıp analiz,
 * program ve rapor hesaplarını bozuyordu.
 */
test("students PATCH: geçersiz alanlar 400 döner ve kaydı bozmaz", async () => {
  const once = ogrenciBul(ogrenci.id)!;

  const gecersizAlan = await patch(ogrenci.id, { aytAlani: "XYZ" });
  assert.equal(gecersizAlan.durum, 400);

  const gecersizTur = await patch(ogrenci.id, { sinavTuru: "KPSS" });
  assert.equal(gecersizTur.durum, 400);

  const negatif = await patch(ogrenci.id, { blokDakika: -5 });
  assert.equal(negatif.durum, 400);

  const asiri = await patch(ogrenci.id, { haftalikSaat: 9999 });
  assert.equal(asiri.durum, 400);

  const bosGun = await patch(ogrenci.id, { calismaGunleri: [] });
  assert.equal(bosGun.durum, 400);

  const sonra = ogrenciBul(ogrenci.id)!;
  assert.equal(sonra.sinavTuru, once.sinavTuru);
  assert.equal(sonra.aytAlani, once.aytAlani);
  assert.equal(sonra.blokDakika, once.blokDakika);
  assert.equal(sonra.haftalikSaat, once.haftalikSaat);
});

test("students PATCH: geçerli güncelleme uygulanır ve id değiştirilemez", async () => {
  const guncel = await patch(ogrenci.id, { aytAlani: "EA", hedefPuan: 430 });
  assert.equal(guncel.durum, 200);
  assert.equal(ogrenciBul(ogrenci.id)?.aytAlani, "EA");
  assert.equal(ogrenciBul(ogrenci.id)?.hedefPuan, 430);

  // İstemci id gönderse bile kayıt başka bir öğrenciye taşınamaz.
  const tasinma = await patch(ogrenci.id, { id: "baska-bir-id", ad: "Adı Değişti" });
  assert.equal(tasinma.durum, 200);
  assert.ok(ogrenciBul(ogrenci.id), "kayıp: id değişmiş");
  assert.equal(ogrenciBul("baska-bir-id" as never), undefined);
  assert.equal(ogrenciBul(ogrenci.id)?.ad, "Adı Değişti");
});

test("students GET/[id]: olmayan öğrenci 404 döner", async () => {
  const r = await studentGET(istek("/api/students/yok"), { params: Promise.resolve({ id: "yok-boyle-id" }) });
  assert.equal(r.status, 404);
  const yok = await patch("yok-boyle-id", { ad: "Kimse" });
  assert.equal(yok.durum, 404);
});
