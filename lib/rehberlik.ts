import { DERSLER } from "./data/dersler";
import { kazanimDurumlari, sinavAnalizi, topluKazanimDurumu, sinavNet } from "./analysis";
import { dersBazliHedefNet, nettenPuan, puandanNet, siniflandir, tahminiSiralama } from "./rehberlik-core";
import type {
  KazanimDurumu,
  Ogrenci,
  RehberlikSonucu,
  Sinav,
  SinavAnalizi,
} from "./types";

const pct = (x: number) => `${Math.round(x * 100)}%`;

/**
 * Rehberlik raporu: hedef karşılaştırması + öncelik sırası + tekrar planı + öneri/risk listesi.
 * Tüm girdiler öğrencinin ölçülmüş sınav verisinden türetilir; hiçbir adım tahminî değildir
 * (tek istisna net→puan dönüşümüdür, o da rehberlik-core'da açıkça işaretlidir).
 */
export function rehberlikRaporu(
  ogrenci: Ogrenci,
  sinavlar: Sinav[],
): {
  analiz: SinavAnalizi | null;
  oncekiAnaliz: SinavAnalizi | null;
  toplu: KazanimDurumu[];
  rehberlik: RehberlikSonucu;
} | null {
  if (!sinavlar.length) return null;

  const sirali = [...sinavlar].sort((a, b) => b.tarih.localeCompare(a.tarih));
  const son = sirali[0];
  const onceki = sirali[1];
  const analiz = sinavAnalizi(son, onceki);
  const oncekiAnaliz = onceki ? sinavAnalizi(onceki) : null;
  const toplu = topluKazanimDurumu(sirali);

  const hedef = siniflandir(ogrenci, analiz, toplu);
  const hedefNet = hedef?.hedefNet ?? puandanNet(ogrenci.sinavTuru, ogrenci.hedefPuan ?? 0, son);
  const dagilim = dersBazliHedefNet(ogrenci, analiz);

  const oncelikSirasi = toplu
    .filter((k) => k.durum === "kritik" || k.durum === "gelistirilmeli")
    .slice(0, 15)
    .map((k) => ({
      ders: DERSLER[k.kazanim.ders].kisaAd,
      kazanimAdi: k.kazanim.ad,
      oncelik: k.oncelik,
      ustalik: k.ustalik,
    }));

  // Aralıklı tekrar: kritik kazanımlar 1-3-7 gün, geliştirilecekler 3-7-21 gün.
  const tekrarListesi: RehberlikSonucu["tekrarListesi"] = [];
  for (const k of toplu.filter((k) => k.durum === "kritik").slice(0, 8)) {
    for (const gun of [1, 3, 7]) {
      tekrarListesi.push({
        kazanimAdi: k.kazanim.ad,
        ders: DERSLER[k.kazanim.ders].kisaAd,
        gun,
      });
    }
  }
  for (const k of toplu.filter((k) => k.durum === "gelistirilmeli").slice(0, 6)) {
    for (const gun of [3, 7, 21]) {
      tekrarListesi.push({
        kazanimAdi: k.kazanim.ad,
        ders: DERSLER[k.kazanim.ders].kisaAd,
        gun,
      });
    }
  }

  const oneriler: string[] = [];
  const riskler: string[] = [];

  /* ── Hedef ─────────────────────────────────────────────────────── */
  if (hedef) {
    if (hedef.netAcigi <= 0.5) {
      oneriler.push(
        `Hedef netinin (${hedef.hedefNet.toFixed(0)}) üstündesin. Yeni konu eklemek yerine haftada en az 2 tam deneme çöz ve yalnızca hatalı kazanımlara dön.`,
      );
    } else {
      oneriler.push(
        `Hedef için ${hedef.netAcigi.toFixed(2)} net gerekiyor. Çalışma bütçenin %60'ını en düşük ustalıklı kazanımlara, %25'ini denemeye, %15'ini tekrara ayır.`,
      );
      riskler.push(
        `Açık ${hedef.netAcigi.toFixed(0)} net; kabaca ${hedef.tahminiHafta} haftalık kesintisiz çalışma gerektirir. Boşa geçen her hafta hedefi 1 hafta öteler.`,
      );
    }
    oneriler.push(
      `Hedef verim: her dersten ortalama ${pct(dagilim.ortakVerim)}. Şu an en geride olan ders(ler): ` +
        Object.entries(dagilim.acik)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 2)
          .map(([d, a]) => `${d} (${a > 0 ? "-" : "+"}${Math.abs(a).toFixed(2)} net)`)
          .join(", ") +
        ".",
    );
  } else {
    oneriler.push("Öğrenci profili için hedef puan tanımlanmadı; hedef girildiğinde net açığı otomatik hesaplanır.");
  }

  /* ── Yanlış / boş davranışı ────────────────────────────────────── */
  const isaretlenen = analiz.toplamDogru + analiz.toplamYanlis;
  const yanlisOrani = isaretlenen ? analiz.toplamYanlis / isaretlenen : 0;
  const bosOrani = analiz.toplamSoru ? analiz.toplamBos / analiz.toplamSoru : 0;

  if (yanlisOrani > 0.28) {
    riskler.push(
      `İşaretlenen sorularda yanlış oranı ${pct(yanlisOrani)}. Her denemeden sonra yanlış defteri tutulmazsa aynı hatalar tekrar eder.`,
    );
    oneriler.push(
      "Her yanlış soruyu dört kategoriye ayır: bilgi eksiği / dikkat / işlem hatası / süre. Haftalık dağılım hangi kategoriye çalışacağını söyler.",
    );
  }
  if (bosOrani > 0.15) {
    riskler.push(
      `Boş bırakma oranı ${pct(bosOrani)}. Boş soru tanı bilgisi üretmez; hangi kazanımın eksik olduğunu göremeyiz.`,
    );
    oneriler.push(
      "Tur tekniği uygula: ilk turda yalnızca 45 saniyede çözülebilen sorular, ikinci turda kalanlar. Süre tutarak çöz.",
    );
  }

  /* ── Kazanım ───────────────────────────────────────────────────── */
  const kritikSayi = toplu.filter((k) => k.durum === "kritik" && k.toplam >= 2).length;
  const verisizSayi = toplu.filter((k) => k.durum === "verisiz").length;
  if (kritikSayi) {
    oneriler.push(
      `${kritikSayi} kazanım kritik durumda. Bunlar müfredatta merkezi konumda olduğu için diğer konuları da bloke ediyor; çalışmaya buradan başla.`,
    );
  }
  if (verisizSayi > toplu.length * 0.4) {
    riskler.push(
      `Ölçülememiş ${verisizSayi} kazanım var (katalogdaki ${toplu.length} kazanımın ${pct(verisizSayi / toplu.length)}'i). ` +
        `Bu kazanımlar henüz girdiğin sınavlarda sorulmadı; kör nokta olabilir. Farklı yayınların denemelerini çözerek ölçümü genişlet.`,
    );
  }

  /* ── Deneme sıklığı ────────────────────────────────────────────── */
  const denemeSayisi = sinavlar.length;
  if (denemeSayisi < 3) {
    oneriler.push(
      `Sistemde ${denemeSayisi} sınav var. Trend okuyabilmek ve kazanım ölçümünü doldurmak için en az 6 sınav gerekir; haftada 1 deneme hedefle.`,
    );
  }

  /* ── Sıralama ──────────────────────────────────────────────────── */
  const puan = nettenPuan(ogrenci.sinavTuru, analiz.toplamNet, son);
  const sira = ogrenci.hedefSiralama ?? null;
  const tahmin = ogrenci.sinavTuru === "LGS" ? null : tahminiSiralama(puan);
  if (tahmin) {
    oneriler.push(
      `Mevcut netin yaklaşık ${puan} puana ve kaba bir tahminle ${tahmin.toLocaleString("tr-TR")} sıralamaya karşılık geliyor.` +
        (sira ? ` Hedef sıralaman ${sira.toLocaleString("tr-TR")}.` : "") +
        // AYT puanı tek başına YKS yerleştirme puanı değildir; TYT katkısı ayrıca girer.
        (ogrenci.sinavTuru === "AYT"
          ? " Bu değer yalnızca AYT netinden türetilmiştir; YKS yerleştirme puanı TYT ve AYT puanlarının ağırlıklı toplamıdır, TYT sonucun buraya dâhil değil."
          : ""),
    );
  }

  oneriler.push(
    `Haftalık ${ogrenci.haftalikSaat} saatlik bütçe = günde ortalama ${(ogrenci.haftalikSaat / Math.max(ogrenci.calismaGunleri.length, 1)).toFixed(1)} saat. ` +
      `Bunu ${ogrenci.blokDakika} dakikalık bloklar hâlinde çalış ve her blok sonunda 10 dakika mola ver.`,
  );

  return {
    analiz,
    oncekiAnaliz,
    toplu,
    rehberlik: {
      hedefNet: hedef?.hedefNet ?? null,
      mevcutNet: analiz.toplamNet,
      netAcigi: hedef?.netAcigi ?? 0,
      hedefeYuzde: hedef ? hedef.hedefeYuzde * 100 : 0,
      tahminiSiralama: tahmin,
      dersBazliHedefNet: dagilim.hedef,
      dersBazliAcik: dagilim.acik,
      oncelikSirasi,
      tekrarListesi,
      oneriler,
      riskler,
    },
  };
}

/** Program üreticisinin ihtiyaç duyduğu öncelikli kazanım listesi. */
export function oncelikliKazanimlar(toplu: KazanimDurumu[], limit = 60): KazanimDurumu[] {
  const olculen = toplu.filter((k) => k.durum === "kritik" || k.durum === "gelistirilmeli");
  const list = olculen.sort((a, b) => b.oncelik - a.oncelik).slice(0, limit);
  if (list.length < limit) {
    // Ölçülememiş ama müfredat ağırlığı yüksek kazanımlarla doldur (kör nokta önleme).
    const verisiz = toplu
      .filter((k) => k.durum === "verisiz")
      .sort((a, b) => b.kazanim.agirlik - a.kazanim.agirlik)
      .slice(0, limit - list.length);
    list.push(...verisiz);
  }
  return list;
}

/** Özet satırı — kartlar ve raporlar için. */
export function rehberlikOzetSatiri(ogrenci: Ogrenci, sinavlar: Sinav[]): string {
  const hedef = ogrenci.hedefPuan ? puandanNet(ogrenci.sinavTuru, ogrenci.hedefPuan) : null;
  const hedefMetni = hedef && Number.isFinite(hedef) ? ` (hedef ~${hedef.toFixed(0)} net)` : "";
  // Sınav yokken "0.00 net" yazmak ölçülmüş bir sonuç gibi okunur; veri
  // olmadığını açıkça söylemek gerekir.
  if (!sinavlar.length) return `${ogrenci.ad} — ${ogrenci.sinavTuru} — henüz sınav verisi yok${hedefMetni}`;
  const net = sinavNet(sinavlar[sinavlar.length - 1]);
  if (!hedef || !Number.isFinite(hedef)) return `${ogrenci.ad} — ${ogrenci.sinavTuru} — son net ${net.toFixed(2)}`;
  return `${ogrenci.ad} — ${ogrenci.sinavTuru} — ${net.toFixed(2)} / ${hedef.toFixed(0)} net (${ogrenci.hedefPuan} puan hedefi)`;
}

export { sinavAnalizi, kazanimDurumlari };
