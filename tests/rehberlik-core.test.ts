import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { adapterSec } from "../lib/okulizyon/adapter";
import { demoAdapter } from "../lib/okulizyon/demo";
import { httpAdapter } from "../lib/okulizyon/http";
import {
  dersBazliHedefNet,
  lgsAgirlikliOran,
  nettenPuan,
  puandanNet,
  siniflandir,
  tahminiSiralama,
} from "../lib/rehberlik-core";
import { sinavAnalizi } from "../lib/analysis";
import { demoKarnelerUret } from "../lib/okulizyon/demo";
import { karneListesiHazirla } from "../lib/okulizyon/import";
import { derslerOf } from "../lib/data/dersler";
import { kazanimlarOf } from "../lib/data/kazanimlar";
import type { Ogrenci, SinavTuru } from "../lib/types";
import {
  gunEkle,
  gunIndex,
  isoTarih,
  kisaTarih,
  dakikaSaat,
  saatEkle,
  tarihtenIso,
  uzunTarih,
} from "../lib/tarih";
import { VARSAYILAN_BAGLANTI } from "../lib/db";
import type { BaglantiAyari, Sinav } from "../lib/types";

/**
 * Regresyon: SIRALAMA_EGRISI puan azalacak biçimde yazılmıştır, egridenOku ise
 * artan sıralı tablo varsayar. Normalleştirme eklenmeden önce "x <= egri[0][0]"
 * koruması 500'ün altındaki her puanı ilk satıra düşürüyor ve tahminiSiralama
 * 200-500 aralığının tamamı için 100 döndürüyordu.
 */
describe("tahminiSiralama", () => {
  test("tablo çapalarını birebir verir", () => {
    const capa: [number, number][] = [
      [500, 100], [480, 2000], [460, 12000], [440, 40000], [420, 90000],
      [400, 160000], [380, 250000], [360, 360000], [340, 500000], [320, 660000],
      [300, 830000], [280, 1000000], [240, 1400000], [200, 1700000],
    ];
    for (const [puan, sira] of capa) {
      assert.equal(tahminiSiralama(puan), sira, `puan ${puan}`);
    }
  });

  test("puan arttıkça sıralama kesin biçimde iyileşir", () => {
    let onceki: number | null = null;
    for (let puan = 200; puan <= 500; puan += 1) {
      const s = tahminiSiralama(puan);
      assert.notEqual(s, null, `puan ${puan} için null döndü`);
      assert.ok(s! > 0, `puan ${puan} için pozitif olmayan sıra: ${s}`);
      if (onceki !== null) assert.ok(s! < onceki, `puan ${puan}: ${s} >= ${onceki} (monoton değil)`);
      onceki = s;
    }
  });

  test("aralık dışındaki puanlar null döner", () => {
    assert.equal(tahminiSiralama(199), null);
    assert.equal(tahminiSiralama(501), null);
    assert.equal(tahminiSiralama(0), null);
    assert.equal(tahminiSiralama(NaN), null);
  });
});

describe("net ↔ puan eğrileri", () => {
  test("TYT ve AYT gidiş-dönüşü kendi içinde tutarlı", () => {
    for (const [tur, tavan] of [["TYT", 120], ["AYT", 80]] as const) {
      for (let net = 0; net <= tavan; net += 5) {
        const puan = nettenPuan(tur, net);
        const geri = puandanNet(tur, puan);
        assert.ok(
          Math.abs(geri - net) <= 0.6,
          `${tur} net ${net} -> puan ${puan} -> ${geri.toFixed(2)}`,
        );
      }
    }
  });

  test("eğriler monoton artan", () => {
    for (const [tur, tavan] of [["TYT", 120], ["AYT", 80]] as const) {
      let onceki = -1;
      for (let net = 0; net <= tavan; net += 1) {
        const p = nettenPuan(tur, net);
        assert.ok(p >= onceki, `${tur} net ${net}: ${p} < ${onceki}`);
        onceki = p;
      }
    }
  });

  test("sınır değerleri uçlarda sabitlenir", () => {
    assert.equal(nettenPuan("TYT", -5), 100);
    assert.equal(nettenPuan("TYT", 500), 500);
    assert.equal(nettenPuan("AYT", -1), 180);
    // AYT'de bir aday en fazla 80 soru çözer; eğri orada 500 puana ulaşır.
    assert.equal(nettenPuan("AYT", 80), 500);
    assert.equal(nettenPuan("AYT", 400), 500);
    assert.equal(puandanNet("AYT", 500), 80);
  });

  test("LGS sayısal dersleri 4 katsayıyla ağırlıklanır", () => {
    const sinav = {
      sinavTuru: "LGS",
      bolumler: [
        { ders: "LGS_TUR", dogru: 10, yanlis: 0, bos: 10 },
        { ders: "LGS_MAT", dogru: 0, yanlis: 0, bos: 20 },
        { ders: "LGS_INK", dogru: 10, yanlis: 0, bos: 0 },
      ],
    } as unknown as Sinav;

    // pay = 4*10 + 4*0 + 1*10 = 50 ; payda = 4*20 + 4*20 + 1*10 = 170
    assert.ok(Math.abs(lgsAgirlikliOran(sinav) - 50 / 170) < 1e-9);
    assert.equal(nettenPuan("LGS", 0, sinav), Math.round(100 + 400 * (50 / 170)));
  });

  test("LGS sınav verilmezse net/90 yaklaşımına düşer", () => {
    assert.equal(nettenPuan("LGS", 45), 300);
    assert.equal(nettenPuan("LGS", 90), 500);
    assert.equal(nettenPuan("LGS", 0), 100);
  });
});

describe("tarih yardımcıları", () => {
  test("isoTarih yerel bileşenleri sıfır dolgular", () => {
    assert.equal(isoTarih(new Date(2026, 0, 5)), "2026-01-05");
    assert.equal(isoTarih(new Date(2026, 11, 31)), "2026-12-31");
  });

  test("tarihtenIso ↔ isoTarih gidiş-dönüşü", () => {
    for (const iso of ["2026-01-01", "2026-02-28", "2026-03-01", "2026-12-31"]) {
      assert.equal(isoTarih(tarihtenIso(iso)), iso);
    }
  });

  test("gunEkle ay ve yıl sınırını doğru geçer", () => {
    assert.equal(gunEkle("2026-01-31", 1), "2026-02-01");
    assert.equal(gunEkle("2026-02-28", 1), "2026-03-01"); // 2026 artık yıl değil
    assert.equal(gunEkle("2024-02-28", 1), "2024-02-29"); // 2024 artık yıl
    assert.equal(gunEkle("2026-12-31", 1), "2027-01-01");
    assert.equal(gunEkle("2026-03-01", -1), "2026-02-28");
  });

  test("gunIndex hafta içi/sonu ayrımını verir", () => {
    assert.equal(gunIndex("2026-10-12"), 1); // Pazartesi
    assert.equal(gunIndex("2026-10-17"), 6); // Cumartesi
    assert.equal(gunIndex("2026-10-18"), 0); // Pazar
  });

  test("TR tarih biçimleri", () => {
    assert.equal(kisaTarih("2026-10-12"), "12 Eki");
    assert.equal(uzunTarih("2026-10-12"), "12 Ekim 2026 Pazartesi");
  });

  test("dakikaSaat saat ve dakikayı ayırır", () => {
    assert.equal(dakikaSaat(45), "45 dk");
    assert.equal(dakikaSaat(60), "1 sa 0 dk");
    assert.equal(dakikaSaat(150), "2 sa 30 dk");
  });

  test("saatEkle dakikayı taşırır ve günü sarar", () => {
    assert.equal(saatEkle("17:00", 50), "17:50");
    assert.equal(saatEkle("17:30", 40), "18:10");
    assert.equal(saatEkle("23:40", 40), "00:20");
    assert.equal(saatEkle("09:00", 0), "09:00");
  });
});

describe("adapterSec", () => {
  test("varsayılan mod demo adaptörüdür", () => {
    assert.equal(adapterSec(VARSAYILAN_BAGLANTI).ad, demoAdapter.ad);
  });

  test("http modu http adaptörünü seçer", () => {
    const ayar: BaglantiAyari = { ...VARSAYILAN_BAGLANTI, mod: "http" };
    assert.equal(adapterSec(ayar).ad, httpAdapter.ad);
  });

  test("mod alanı bozulursa demo adaptörüne düşer", () => {
    const ayar = { ...VARSAYILAN_BAGLANTI, mod: "bilinmeyen" } as unknown as BaglantiAyari;
    assert.equal(adapterSec(ayar).ad, demoAdapter.ad);
  });
});

describe("hedef net dağıtımı", () => {
  function ogrenci(tur: SinavTuru, hedefPuan: number): Ogrenci {
    return {
      id: "o1", ad: "Hedef Test", sinifSeviyesi: "12", sinavTuru: tur, hedefPuan,
      haftalikSaat: 14, calismaGunleri: [1, 2, 3, 4, 5, 6], blokDakika: 50,
      olusturulma: "2026-01-01T00:00:00.000Z", guncelleme: "2026-01-01T00:00:00.000Z",
    } as Ogrenci;
  }

  function analiz(tur: SinavTuru) {
    const sinavlar = karneListesiHazirla(demoKarnelerUret(tur, "hedef-tohum", 1), tur, "o1", "t")
      .map((s, i) => ({ ...s, id: `s${i}` }));
    return sinavAnalizi(sinavlar[0]);
  }

  /**
   * Eğri tablosu uygulamanın ders kartı toplamından yüksek bitebiliyor
   * (AYT eğrisi 160 net'te 500 puana ulaşır, AYT ders kartları 154 sorudur).
   * Kırpma olmazsa öğrenciye ulaşılamaz bir hedef gösterilir.
   */
  test("hedef net hiçbir zaman sınavın net tavanını aşmaz", () => {
    for (const tur of ["TYT", "AYT"] as const) {
      const a = analiz(tur);
      const tavan = derslerOf(tur).reduce((t, d) => t + d.soruSayisi, 0);
      for (const puan of [300, 400, 450, 500]) {
        const kiyas = siniflandir(ogrenci(tur, puan), a);
        assert.ok(kiyas, `${tur}/${puan} için kiyas null`);
        assert.ok(
          kiyas!.hedefNet <= tavan + 1e-9,
          `${tur} ${puan} puan: hedefNet ${kiyas!.hedefNet} > tavan ${tavan}`,
        );
        assert.ok(kiyas!.netAcigi >= 0);
        assert.ok(Number.isFinite(kiyas!.hedefNet));
      }
    }
  });

  test("ders bazlı hedef toplamı hedef neti verir ve ders tavanını aşmaz", () => {
    for (const tur of ["TYT", "AYT"] as const) {
      const a = analiz(tur);
      const tavan = derslerOf(tur).reduce((t, d) => t + d.soruSayisi, 0);
      for (const puan of [300, 450, 500]) {
        const o = ogrenci(tur, puan);
        const { hedef, ortakVerim } = dersBazliHedefNet(o, a);
        const toplam = Object.values(hedef).reduce((x, y) => x + y, 0);
        const beklenen = Math.min(tavan, puandanNet(tur, puan, a.sinav));
        // Ders başına yuvarlamadan gelen küçük sapma kabul edilir.
        assert.ok(Math.abs(toplam - beklenen) < 0.05, `${tur}/${puan}: Σ=${toplam} beklenen=${beklenen}`);
        assert.ok(ortakVerim <= 1, `ortakVerim ${ortakVerim} > 1`);
        for (const d of a.dersler) {
          assert.ok(
            hedef[d.ders.kisaAd] <= d.ders.soruSayisi + 1e-9,
            `${tur}/${puan}: ${d.ders.kisaAd} hedefi ${hedef[d.ders.kisaAd]} > ${d.ders.soruSayisi}`,
          );
        }
        assert.ok(Object.values(hedef).every((v) => Number.isFinite(v)));
      }
    }
  });
});

describe("AYT alan modeli", () => {
  /**
   * AYT TYT gibi ortak değildir: her aday kendi alanının iki testini çözer ve
   * toplam 80 soru cevaplar. Panel bir ara 8 dersin tamamını (154 soru) tek
   * adayın çözdüğünü varsayıyordu; bu net tavanını, hedef neti ve puan
   * eğrisini yanlış çıkarıyordu.
   */
  test("her alanın toplam soru sayısı 80'dir", () => {
    for (const alan of ["SAY", "EA", "SOZ"] as const) {
      const toplam = derslerOf("AYT", alan).reduce((t, d) => t + d.soruSayisi, 0);
      assert.equal(toplam, 80, `${alan} toplamı ${toplam}`);
    }
  });

  test("alanların ders kümeleri birbirinden ayrışır", () => {
    const say = new Set(derslerOf("AYT", "SAY").map((d) => d.kod));
    const ea = new Set(derslerOf("AYT", "EA").map((d) => d.kod));
    const soz = new Set(derslerOf("AYT", "SOZ").map((d) => d.kod));

    // Sayısal: Matematik + Fen Bilimleri.
    assert.deepEqual([...say].sort(), ["AYT_BIY", "AYT_FIZ", "AYT_KIM", "AYT_MAT"]);
    // Sayısal aday edebiyat/tarih çözmez.
    assert.ok(!say.has("AYT_EDB") && !say.has("AYT_TAR") && !say.has("AYT_DIN"));
    // Eşit ağırlık: Matematik + Edebiyat-Sosyal-1.
    assert.deepEqual([...ea].sort(), ["AYT_COG", "AYT_EDB", "AYT_MAT", "AYT_TAR"]);
    // Sözel: Edebiyat-Sosyal-1 + Sosyal Bilimler-2 (DKAB dâhil).
    assert.ok(soz.has("AYT_DIN") && soz.has("AYT_FEL") && !soz.has("AYT_MAT"));

    // Tarih/Coğrafya soru sayısı alana göre değişir: EA yalnızca -1 testini çözer.
    const eaTarih = derslerOf("AYT", "EA").find((d) => d.kod === "AYT_TAR")!.soruSayisi;
    const sozTarih = derslerOf("AYT", "SOZ").find((d) => d.kod === "AYT_TAR")!.soruSayisi;
    assert.equal(eaTarih, 10);
    assert.equal(sozTarih, 21);
  });

  test("alan verilmezse Sayısal varsayılır ve TYT/LGS alandan etkilenmez", () => {
    assert.deepEqual(
      derslerOf("AYT").map((d) => d.kod).sort(),
      derslerOf("AYT", "SAY").map((d) => d.kod).sort(),
    );
    assert.equal(derslerOf("TYT").reduce((t, d) => t + d.soruSayisi, 0), 120);
    assert.equal(derslerOf("TYT", "SOZ").reduce((t, d) => t + d.soruSayisi, 0), 120);
    assert.equal(derslerOf("LGS", "EA").reduce((t, d) => t + d.soruSayisi, 0), 90);
  });

  test("kazanımlar alan içinde çift sayılmaz", () => {
    for (const alan of ["SAY", "EA", "SOZ"] as const) {
      const ids = derslerOf("AYT", alan).flatMap((d) => kazanimlarOf(d.kod).map((k) => k.id));
      assert.equal(ids.length, new Set(ids).size, `${alan} alanında çift kazanım var`);
      assert.ok(ids.length > 0, `${alan} alanında hiç kazanım yok`);
    }
  });

  test("AYT net tavanı 80'i aşmaz", () => {
    for (const alan of ["SAY", "EA", "SOZ"] as const) {
      const tavan = derslerOf("AYT", alan).reduce((t, d) => t + d.soruSayisi, 0);
      assert.equal(tavan, 80);
      assert.equal(puandanNet("AYT", 500), 80);
      assert.equal(nettenPuan("AYT", 80), 500);
    }
  });
});
