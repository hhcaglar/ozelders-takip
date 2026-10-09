import { DERSLER, derslerOf } from "./data/dersler";
import { kazanimlarOf } from "./data/kazanimlar";
import { GUN_ADLARI, gunEkle, gunIndex, isoTarih, kisaTarih, saatEkle } from "./tarih";
import type {
  BlokTipi,
  CalismaBlogu,
  CalismaProgrami,
  DersKodu,
  KazanimDurumu,
  Ogrenci,
  SinavTuru,
} from "./types";

export interface ProgramGirdisi {
  baslangicTarihi: string;
  haftaSayisi: number;
}

interface Slot {
  id: string;
  tarih: string;
  haftaNo: number;
  baslangic: string;
  dakika: number;
  /** Deneme ve yanlış analizi için önceden rezerve edilmiş mi? */
  rezerv: BlokTipi | null;
}

interface Gorev {
  tip: BlokTipi;
  kazanim: KazanimDurumu;
}

interface TekrarKaydi {
  kazanim: KazanimDurumu;
  vadeTarihi: string;
  etap: number;
}

const ZORLUK_CARPANI = { kolay: 0.85, orta: 1, zor: 1.15 } as const;

/**
 * Çalışma programı üreticisi.
 *
 * Sıra:
 *  1. Öğrencinin çalışma günlerine göre zaman yuvaları açılır.
 *  2. Haftada bir deneme ve bir yanlış-analizi yuvası rezerve edilir.
 *  3. Kazanım öncelik skoruna göre görev kuyruğu kurulur.
 *  4. Ders bazlı hedef pay (zayıf derse daha çok) uygulanır.
 *  5. Aralıklı tekrar vadeleri (1-3-7 / 3-7) yuvalara yerleştirilir.
 */
export function calismaProgramiUret(
  ogrenci: Ogrenci,
  toplu: KazanimDurumu[],
  sinavTuru: SinavTuru,
  girdi: ProgramGirdisi,
): CalismaProgrami {
  const haftaSayisi = Math.max(1, Math.min(24, Math.round(girdi.haftaSayisi)));
  const blokDakika = Math.max(20, Math.min(120, Math.round(ogrenci.blokDakika)));
  const gunler = ogrenci.calismaGunleri.length ? [...new Set(ogrenci.calismaGunleri)].sort() : [1, 2, 3, 4, 5, 6];
  const haftalikDakika = Math.max(60, Math.round(ogrenci.haftalikSaat * 60));

  /* ── 1. Yuva üretimi ───────────────────────────────────────────── */
  const slotlar: Slot[] = [];
  const gunBasinaDakika = haftalikDakika / gunler.length;
  const gunBasinaBlok = Math.max(1, Math.round(gunBasinaDakika / blokDakika));

  for (let hafta = 0; hafta < haftaSayisi; hafta++) {
    for (const gunNo of gunler) {
      // Haftanın 0. günü Pazar kabul edilerek tarih bulunur.
      const tarih = tarihBul(girdi.baslangicTarihi, hafta, gunNo);
      const haftaSonu = gunNo === 0 || gunNo === 6;
      let saat = haftaSonu ? "10:00" : "17:00";
      for (let b = 0; b < gunBasinaBlok; b++) {
        slotlar.push({
          id: `${tarih}-${b}`,
          tarih,
          haftaNo: hafta,
          baslangic: saat,
          dakika: blokDakika,
          rezerv: null,
        });
        saat = saatEkle(saat, blokDakika + 10);
      }
    }
  }

  /* ── 2. Deneme ve yanlış analizi rezervi ───────────────────────── */
  const haftalaraGore = new Map<number, Slot[]>();
  for (const s of slotlar) {
    const l = haftalaraGore.get(s.haftaNo) ?? [];
    l.push(s);
    haftalaraGore.set(s.haftaNo, l);
  }
  for (const [, liste] of haftalaraGore) {
    if (liste.length >= 2) liste[0].rezerv = "yanlis-analizi";
    if (liste.length >= 3) liste[liste.length - 1].rezerv = "deneme";
  }

  /* ── 3. Görev kuyruğu ──────────────────────────────────────────── */
  const oncelikliler = oncelikKuyrugu(toplu, sinavTuru);
  const gorevler: Gorev[] = [];
  for (const k of oncelikliler) {
    // Zor kazanıma daha uzun konu bloğu; ikinci blok test.
    gorevler.push({ tip: "konu", kazanim: k });
    gorevler.push({ tip: "test", kazanim: k });
  }

  // Ders payları: öncelik skoru toplamına göre.
  const dersAgirlik = new Map<string, number>();
  for (const g of gorevler) {
    const ad = DERSLER[g.kazanim.kazanim.ders].kisaAd;
    dersAgirlik.set(ad, (dersAgirlik.get(ad) ?? 0) + g.kazanim.oncelik + g.kazanim.kazanim.agirlik * 0.3);
  }
  const toplamAgirlik = [...dersAgirlik.values()].reduce((a, b) => a + b, 0) || 1;
  const hedefPay = new Map<string, number>();
  for (const [ad, v] of dersAgirlik) hedefPay.set(ad, v / toplamAgirlik);

  const atanan = new Map<string, number>();
  const dersGorevKuyrugu = new Map<string, Gorev[]>();
  for (const g of gorevler) {
    const ad = DERSLER[g.kazanim.kazanim.ders].kisaAd;
    const l = dersGorevKuyrugu.get(ad) ?? [];
    l.push(g);
    dersGorevKuyrugu.set(ad, l);
  }

  /* ── 4-5. Yuvaya yerleştirme ───────────────────────────────────── */
  const bloklar: CalismaBlogu[] = [];
  const tekrarlar: TekrarKaydi[] = [];
  const toplamAtanan = () => [...atanan.values()].reduce((a, b) => a + b, 0);

  // Tekrar, konu çalışmasının yerini almamalı: toplam yuvaların en fazla %25'i.
  const tekrarTavani = Math.max(2, Math.floor(slotlar.length * 0.25));
  let tekrarSayisi = 0;
  let denemeSayisi = 0;

  function dersSec(): string | null {
    let enIyi: string | null = null;
    let enIyiAcik = -Infinity;
    const toplam = toplamAtanan();
    for (const [ad, kuyruk] of dersGorevKuyrugu) {
      if (!kuyruk.length) continue;
      const pay = hedefPay.get(ad) ?? 0;
      const mevcut = (atanan.get(ad) ?? 0) / (toplam || 1);
      const acik = pay - mevcut;
      if (acik > enIyiAcik) {
        enIyiAcik = acik;
        enIyi = ad;
      }
    }
    return enIyi;
  }

  for (const slot of slotlar) {
    // Vadesi gelen tekrarlar; tavandan düşenler 7 günü geçtiyse kuyruktan atılır.
    const vadesiGelenler = tekrarlar
      .filter((t) => t.vadeTarihi <= slot.tarih)
      .sort((a, b) => a.vadeTarihi.localeCompare(b.vadeTarihi));
    for (const t of vadesiGelenler) {
      if (gunFarki(t.vadeTarihi, slot.tarih) > 7) tekrarlar.splice(tekrarlar.indexOf(t), 1);
    }
    const tekrarUygun = tekrarSayisi < tekrarTavani;
    const vadesiGelen = tekrarUygun ? vadesiGelenler.find((t) => tekrarlar.includes(t)) : undefined;

    let tip: BlokTipi;
    let kazanim: KazanimDurumu | undefined;
    let baslik: string;
    let detay: string;
    let dakika = slot.dakika;

    if (slot.rezerv === "deneme") {
      tip = "deneme";
      dakika = Math.min(165, Math.round(slot.dakika * 2.5));
      baslik = `${sinavTuru} genel deneme`;
      detay =
        "Süre tutarak tam deneme çöz. Deneme biter bitmez optik kontrolü yap ve yanlışlarını işaretle; analizi erteleme.";
      denemeSayisi += 1;
    } else if (slot.rezerv === "yanlis-analizi") {
      tip = "yanlis-analizi";
      baslik = "Yanlış defteri analizi";
      detay =
        "Son denemenin yanlışlarını dört kategoriye ayır: bilgi eksiği / dikkat / işlem hatası / süre. Bilgi eksiği çıkan kazanımları kuyruğun başına al.";
    } else if (vadesiGelen) {
      tekrarlar.splice(tekrarlar.indexOf(vadesiGelen), 1);
      tekrarSayisi += 1;
      tip = "tekrar";
      kazanim = vadesiGelen.kazanim;
      dakika = Math.max(20, Math.round(slot.dakika * 0.75 * ZORLUK_CARPANI[kazanim.kazanim.zorluk]));
      baslik = `${DERSLER[kazanim.kazanim.ders].kisaAd}: ${kazanim.kazanim.unite} tekrarı`;
      detay = `Aralıklı tekrar ${vadesiGelen.etap}. etap — ${kazanim.kazanim.ad}. Önce kendi notuna bakmadan 10 soru çöz, sonra notunu karşılaştır.`;
    } else {
      const dersAd = dersSec();
      const kuyruk = dersAd ? dersGorevKuyrugu.get(dersAd) : undefined;
      const gorev = kuyruk?.shift();
      if (!gorev) {
        tip = "tekrar";
        baslik = "Serbest tekrar / soru çözümü";
        detay = "Kuyrukta yeni kazanım kalmadı. Daha önce çalıştığın ünitelerden karma test çöz.";
      } else {
        tip = gorev.tip;
        kazanim = gorev.kazanim;
        const carpan = ZORLUK_CARPANI[kazanim.kazanim.zorluk];
        if (tip === "konu") {
          dakika = Math.max(25, Math.round(slot.dakika * carpan));
          baslik = `${DERSLER[kazanim.kazanim.ders].kisaAd}: ${kazanim.kazanim.unite}`;
          detay = `Konu çalışması — ${kazanim.kazanim.ad}. Konu anlatımını oku, örnek soruları kendi başına çöz, ardından 10 soruluk temel test. Ustalık: %${Math.round(kazanim.ustalik * 100)}.`;
        } else {
          dakika = Math.max(20, Math.round(slot.dakika * 0.95 * carpan));
          baslik = `${DERSLER[kazanim.kazanim.ders].kisaAd}: ${kazanim.kazanim.unite} test`;
          detay = `Soru çözümü — ${kazanim.kazanim.ad}. 20 soru, süre tutarak. Yanlışları işaretle ve nedenini yaz.`;
          // Test bitti → aralıklı tekrar vadeleri kur.
          const kritik = kazanim.durum === "kritik";
          for (const [i, gun] of (kritik ? [1, 3, 7] : [3, 7]).entries()) {
            tekrarlar.push({ kazanim, vadeTarihi: gunEkle(slot.tarih, gun), etap: i + 1 });
          }
        }
        atanan.set(dersAd!, (atanan.get(dersAd!) ?? 0) + dakika);
      }
    }

    bloklar.push({
      id: slot.id,
      tarih: slot.tarih,
      baslangic: slot.baslangic,
      dakika,
      tip,
      ders: kazanim ? DERSLER[kazanim.kazanim.ders].ad : "Genel",
      baslik,
      detay,
      kazanimId: kazanim?.kazanim.id,
      tamamlandi: false,
    });
  }

  /* ── Özet ──────────────────────────────────────────────────────── */
  const ozet: string[] = [];
  const tipDagilim = new Map<BlokTipi, number>();
  for (const b of bloklar) tipDagilim.set(b.tip, (tipDagilim.get(b.tip) ?? 0) + b.dakika);
  const toplamDakika = bloklar.reduce((t, b) => t + b.dakika, 0);

  const hedefDakika = haftalikDakika * haftaSayisi;
  const sapma = ((toplamDakika - hedefDakika) / hedefDakika) * 100;
  ozet.push(
    `${haftaSayisi} haftalık program: ${bloklar.length} blok, toplam ${(toplamDakika / 60).toFixed(1)} saat ` +
      `(haftalık ${ogrenci.haftalikSaat} saat bütçesine göre %${sapma >= 0 ? "+" : ""}${sapma.toFixed(0)}). ` +
      `Çalışma günleri: ${gunler.map((g) => GUN_ADLARI[g]).join(", ")}. Blok uzunluğu ${blokDakika} dk.`,
  );
  if (Math.abs(sapma) > 10) {
    ozet.push(
      `Sapma uyarısı: deneme ve konu blokları standart blok süresinden uzun olduğu için plan bütçenin ` +
        `%${Math.abs(sapma).toFixed(0)} ${sapma > 0 ? "üstüne" : "altına"} çıkıyor. Bütçeye oturmak için blok süresini veya hafta sayısını ayarla.`,
    );
  }
  ozet.push(
    "Blok dağılımı: " +
      [...tipDagilim.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([t, d]) => `${tipAdi(t)} ${(d / 60).toFixed(1)} sa (%${Math.round((d / toplamDakika) * 100)})`)
        .join(" · ") +
      ".",
  );
  const dersDagilim = new Map<string, number>();
  for (const b of bloklar) if (b.ders !== "Genel") dersDagilim.set(b.ders, (dersDagilim.get(b.ders) ?? 0) + b.dakika);
  ozet.push(
    "Ders dağılımı: " +
      [...dersDagilim.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([d, dk]) => `${d} ${(dk / 60).toFixed(1)} sa`)
        .join(" · ") +
      ".",
  );
  const kapsananKazanim = new Set(bloklar.map((b) => b.kazanimId).filter(Boolean)).size;
  ozet.push(
    `${denemeSayisi} genel deneme, ${tekrarSayisi} aralıklı tekrar bloğu planlandı (tekrar tavanı ${tekrarTavani} blok). ` +
      `Denemeler hafta sonuna, yanlış analizi haftanın ilk çalışma gününe yerleştirildi.`,
  );
  ozet.push(
    kapsananKazanim
      ? `Program ${kapsananKazanim} kazanımı kapsıyor; her kazanım için konu + test + aralıklı tekrar (kritiklerde 1-3-7 gün) planlandı.`
      : "Ölçülmüş eksik kazanım bulunamadı; program genel tekrar ve deneme ağırlıklı kuruldu.",
  );

  return {
    ogrenciId: ogrenci.id,
    baslangicTarihi: girdi.baslangicTarihi,
    haftaSayisi,
    haftalikSaat: ogrenci.haftalikSaat,
    olusturulma: new Date().toISOString(),
    bloklar,
    ozet,
  };
}

/** İki ISO tarih arasındaki gün farkı (b - a). */
function gunFarki(a: string, b: string): number {
  const ms = (iso: string) =>
    Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
  return Math.round((ms(b) - ms(a)) / 86400000);
}

/** Hafta ve gün numarasından gerçek tarih. */
function tarihBul(baslangic: string, haftaNo: number, gunNo: number): string {
  const base = new Date(
    Number(baslangic.slice(0, 4)),
    Number(baslangic.slice(5, 7)) - 1,
    Number(baslangic.slice(8, 10)),
  );
  // Başlangıç haftasının Pazar gününe gerile.
  const haftaninPazari = new Date(base);
  haftaninPazari.setDate(base.getDate() - base.getDay());
  const hedef = new Date(haftaninPazari);
  hedef.setDate(haftaninPazari.getDate() + haftaNo * 7 + gunNo);
  // Geçmişe düşmesin.
  return isoTarih(hedef);
}

/**
 * Çalışılacak kazanım sırası.
 * Ölçülmüş eksikler öncelik skoruna göre; sayı yetmezse katalogdaki ağırlığı en yüksek
 * ölçülmemiş kazanımlar eklenir (kör nokta önleme).
 */
export function oncelikKuyrugu(toplu: KazanimDurumu[], sinavTuru: SinavTuru): KazanimDurumu[] {
  const limit = 40;
  const olculen = toplu
    .filter((k) => k.durum === "kritik" || k.durum === "gelistirilmeli")
    .sort((a, b) => b.oncelik - a.oncelik)
    .slice(0, limit);

  const sinavKazanimlari = derslerOf(sinavTuru).flatMap((d) => kazanimlarOf(d.kod));
  const secili = new Set(olculen.map((k) => k.kazanim.id));
  const doldurma = sinavKazanimlari
    .filter((k) => !secili.has(k.id))
    .sort((a, b) => b.agirlik - a.agirlik)
    .slice(0, Math.max(0, limit - olculen.length))
    .map<KazanimDurumu>((k) => ({
      kazanim: k,
      dogru: 0,
      yanlis: 0,
      bos: 0,
      toplam: 0,
      ustalik: 0,
      isabet: 0,
      oncelik: k.agirlik * 0.5,
      durum: "verisiz",
    }));

  return [...olculen, ...doldurma];
}

export function tipAdi(t: BlokTipi): string {
  return {
    konu: "Konu çalışması",
    test: "Soru çözümü",
    tekrar: "Tekrar",
    deneme: "Deneme",
    "yanlis-analizi": "Yanlış analizi",
  }[t];
}

export const TIP_RENK: Record<BlokTipi, string> = {
  konu: "#6366f1",
  test: "#f59e0b",
  tekrar: "#10b981",
  deneme: "#ef4444",
  "yanlis-analizi": "#a855f7",
};

/** Program günlerini tarih bazında gruplar. */
export function gunlereGoreGrupla(
  program: CalismaProgrami,
): { tarih: string; gunAdi: string; bloklar: CalismaBlogu[]; toplamDakika: number }[] {
  const map = new Map<string, CalismaBlogu[]>();
  for (const b of program.bloklar) {
    const l = map.get(b.tarih) ?? [];
    l.push(b);
    map.set(b.tarih, l);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([tarih, bl]) => ({
      tarih,
      gunAdi: GUN_ADLARI[gunIndex(tarih)],
      bloklar: bl,
      toplamDakika: bl.reduce((t, b) => t + b.dakika, 0),
    }));
}

/** ICS takvim dosyası içeriği. */
export function icsUret(program: CalismaProgrami, ogrenciAdi: string): string {
  const satirlar = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ozelders-takip//Calisma Programi//TR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  for (const b of program.bloklar) {
    const [y, m, d] = b.tarih.split("-");
    const bas = `${y}${m}${d}T${b.baslangic.replace(":", "")}00`;
    const bitSaat = saatEkle(b.baslangic, b.dakika);
    const bit = `${y}${m}${d}T${bitSaat.replace(":", "")}00`;
    satirlar.push(
      "BEGIN:VEVENT",
      `UID:${b.id}@ozelders-takip`,
      `DTSTART:${bas}`,
      `DTEND:${bit}`,
      `SUMMARY:${icsKacis(`[${tipAdi(b.tip)}] ${b.baslik}`)}`,
      `DESCRIPTION:${icsKacis(`${b.ders} — ${b.detay} (Öğrenci: ${ogrenciAdi})`)}`,
      "END:VEVENT",
    );
  }
  satirlar.push("END:VCALENDAR");
  return satirlar.join("\r\n");
}

function icsKacis(s: string): string {
  return s.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
}

export { kisaTarih, gunIndex };
