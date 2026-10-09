import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { adapterSec } from "../lib/okulizyon/adapter";
import { demoAdapter } from "../lib/okulizyon/demo";
import { httpAdapter } from "../lib/okulizyon/http";
import {
  lgsAgirlikliOran,
  nettenPuan,
  puandanNet,
  tahminiSiralama,
} from "../lib/rehberlik-core";
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
    for (const [tur, tavan] of [["TYT", 120], ["AYT", 160]] as const) {
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
    for (const [tur, tavan] of [["TYT", 120], ["AYT", 160]] as const) {
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
    assert.equal(nettenPuan("AYT", 400), 500);
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
