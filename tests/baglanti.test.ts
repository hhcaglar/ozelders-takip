import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import { httpAdapter } from "../lib/okulizyon/http";
import { karneListesiHazirla } from "../lib/okulizyon/import";
import type { BaglantiAyari, Ogrenci } from "../lib/types";

/**
 * httpAdapter gerçek fetch çağrısı yapar; bu yüzden sahte bir Okulizyon sunucusu
 * ayağa kaldırıp adaptörün giriş → jeton → karne → normalizasyon zincirini gerçekten
 * çalıştırıyoruz.
 */

let sunucu: Server;
let taban: string;
const gelenIstekler: { url: string; yetki?: string; govde?: string }[] = [];

function ogrenci(): Ogrenci {
  return {
    id: "o-http",
    ad: "HTTP Öğrenci",
    sinifSeviyesi: "12",
    sinavTuru: "TYT",
    okulizyonOgrenciNo: "998877",
    haftalikSaat: 12,
    calismaGunleri: [1, 2, 3, 4, 5],
    blokDakika: 50,
    olusturulma: new Date().toISOString(),
    guncelleme: new Date().toISOString(),
  };
}

function ayar(over: Partial<BaglantiAyari> = {}): BaglantiAyari {
  return {
    aktif: true,
    baseUrl: taban,
    girisEndpoint: "/api/giris",
    karneEndpoint: "/api/karne",
    ogrenciNo: "998877",
    tcKimlikNo: "12345678901",
    il: "İstanbul",
    ilce: "Kadıköy",
    kurum: "Örnek Kolej",
    mod: "http",
    ...over,
  };
}

before(async () => {
  sunucu = createServer((req, res) => {
    let govde = "";
    req.on("data", (p) => (govde += p));
    req.on("end", () => {
      const url = req.url ?? "";
      gelenIstekler.push({ url, yetki: req.headers.authorization as string | undefined, govde });

      if (url.startsWith("/api/giris")) {
        const giris = JSON.parse(govde || "{}");
        if (giris.sifre !== "dogru-sifre") {
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ hata: "yetkisiz" }));
          return;
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ data: { accessToken: "jeton-123" } }));
        return;
      }

      if (url.startsWith("/api/karne")) {
        if (req.headers.authorization !== "Bearer jeton-123") {
          res.writeHead(403, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ hata: "jeton yok" }));
          return;
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            sonuclar: [
              {
                sinavAdi: "TYT Deneme 7",
                tarih: "05.10.2026",
                yayinevi: "Örnek Yayın",
                sinifOrtalama: 74.5,
                bolumler: [
                  { ders: "Türkçe", dogru: 30, yanlis: 6, bos: 4 },
                  { ders: "Matematik", dogru: 19, yanlis: 13, bos: 8 },
                  { ders: "Fen Bilimleri", dogru: 11, yanlis: 5, bos: 4 },
                  { ders: "Sosyal Bilimler", dogru: 13, yanlis: 5, bos: 2 },
                ],
                sorular: [
                  {
                    no: 1,
                    ders: "Matematik",
                    kazanım: "Problemler / Yüzde, kâr-zarar ve faiz problemlerini çözer",
                    durum: "Y",
                  },
                  {
                    no: 2,
                    ders: "Türkçe",
                    kazanım: "Paragrafta Anlam / Paragrafın ana düşüncesini belirler",
                    durum: "D",
                  },
                ],
              },
            ],
          }),
        );
        return;
      }

      if (url.startsWith("/api/bos")) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ mesaj: "kayıt yok" }));
        return;
      }

      res.writeHead(404, { "Content-Type": "application/json" });
      res.end("{}");
    });
  });
  await new Promise<void>((bitir) => sunucu.listen(0, "127.0.0.1", bitir));
  taban = `http://127.0.0.1:${(sunucu.address() as AddressInfo).port}`;
});

after(() => sunucu.close());

test("httpAdapter giriş jetonunu alıp karneyi çeker ve normalize eder", async () => {
  const { karneler, mesaj } = await httpAdapter.senkron({
    ogrenci: ogrenci(),
    ogrenciId: "o-http",
    sinavTuru: "TYT",
    ayar: ayar(),
    sifre: "dogru-sifre",
  });

  assert.equal(karneler.length, 1);
  assert.match(mesaj, /1 karne/);

  const girisIstegi = gelenIstekler.find((i) => i.url.startsWith("/api/giris"));
  assert.ok(girisIstegi?.govde?.includes("dogru-sifre"));
  assert.ok(girisIstegi?.govde?.includes("998877"));
  const karneIstegi = gelenIstekler.find((i) => i.url.startsWith("/api/karne"));
  assert.equal(karneIstegi?.yetki, "Bearer jeton-123");
  assert.ok(karneIstegi?.url.includes("sinavTuru=TYT"));

  const sinavlar = karneListesiHazirla(karneler, "TYT", "o-http", "http-test");
  assert.equal(sinavlar.length, 1);
  const s = sinavlar[0];
  assert.equal(s.baslik, "TYT Deneme 7");
  assert.equal(s.tarih, "2026-10-05", "GG.AA.YYYY tarihi ISO'ya çevrilmeli");
  assert.equal(s.kaynak, "okulizyon");
  assert.equal(s.bolumler.length, 4);
  assert.equal(s.sorular[0].kazanimId?.startsWith("TYT_MAT#"), true);
  assert.equal(s.sorular[0].isaretlendi, true);
  assert.equal(s.sorular[0].dogru, false);
});

test("yanlış şifrede okunabilir hata döner", async () => {
  await assert.rejects(
    () =>
      httpAdapter.senkron({
        ogrenci: ogrenci(),
        ogrenciId: "o-http",
        sinavTuru: "TYT",
        ayar: ayar(),
        sifre: "yanlis",
      }),
    /Giriş isteği 401/,
  );
});

test("karne ucu boş dönerse hata mesajı alan adı farklılığına işaret eder", async () => {
  await assert.rejects(
    () =>
      httpAdapter.senkron({
        ogrenci: ogrenci(),
        ogrenciId: "o-http",
        sinavTuru: "TYT",
        ayar: ayar({ karneEndpoint: "/api/bos" }),
        sifre: "dogru-sifre",
      }),
    /karne bulunamadı/,
  );
});

test("eksik yapılandırma isteği hiç göndermeden durdurulur", async () => {
  await assert.rejects(
    () =>
      httpAdapter.senkron({
        ogrenci: ogrenci(),
        ogrenciId: "o-http",
        sinavTuru: "TYT",
        ayar: ayar({ baseUrl: "" }),
        sifre: "dogru-sifre",
      }),
    /taban adres/,
  );
  await assert.rejects(
    () =>
      httpAdapter.senkron({
        ogrenci: ogrenci(),
        ogrenciId: "o-http",
        sinavTuru: "TYT",
        ayar: ayar({ karneEndpoint: "" }),
        sifre: "dogru-sifre",
      }),
    /Karne uç noktası/,
  );
});

test("ulaşılamayan adres zaman aşımı/bağlantı hatası üretir", async () => {
  await assert.rejects(
    () =>
      httpAdapter.senkron({
        ogrenci: ogrenci(),
        ogrenciId: "o-http",
        sinavTuru: "TYT",
        ayar: ayar({ baseUrl: "http://127.0.0.1:9", girisEndpoint: "" }),
        sifre: "x",
      }),
    /fetch failed|ECONNREFUSED/,
  );
});
