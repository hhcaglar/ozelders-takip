import { siniflandir } from "./rehberlik-core";
import { yuzdeBelirtme, yuzdeBulunma, yuzdeIyelik, yuzdeYonelik } from "./dilbilgisi";
import { DERSLER } from "./data/dersler";
import type { DersAnalizi, KazanimDurumu, Ogrenci, Sinav, SinavAnalizi, YorumBlogu } from "./types";

const pct = (x: number) => `${Math.round(x * 100)}%`;

/**
 * Kural tabanlı yorum üreticisi.
 *
 * Bilinçli olarak yapay zekâ çağrısı yapmaz: her cümle ölçülebilir bir eşikten türetilir,
 * böylece öğretmen yorumun gerekçesini sayısal olarak doğrulayabilir.
 */
export function sinavYorumu(
  ogrenci: Ogrenci,
  analiz: SinavAnalizi,
  onceki: Sinav | undefined,
  oncekiAnaliz: SinavAnalizi | null | undefined,
  toplu: KazanimDurumu[],
): YorumBlogu[] {
  const bloglar: YorumBlogu[] = [];
  const s = analiz.sinav;

  /* ── 1. Genel özet ─────────────────────────────────────────────── */
  const netFarki = oncekiAnaliz ? analiz.toplamNet - oncekiAnaliz.toplamNet : null;
  const yon =
    netFarki === null ? "" : netFarki > 1 ? "yükselmiş" : netFarki < -1 ? "gerilemiş" : "sabit kalmış";

  bloglar.push({
    baslik: "Genel Değerlendirme",
    ton: netFarki !== null && netFarki < -3 ? "uyari" : "bilgi",
    metin: [
      `${s.baslik} sınavında ${analiz.toplamSoru} sorunun ${analiz.toplamDogru} tanesini doğru, ` +
        `${analiz.toplamYanlis} tanesini yanlış cevaplamış, ${analiz.toplamBos} soruyu boş bırakmışsın. ` +
        `Toplam netin ${analiz.toplamNet.toFixed(2)}.`,
      analiz.netTavanOrani
        ? `Bu, sınavdaki ${s.bolumler.reduce((t, b) => t + (DERSLER[b.ders]?.soruSayisi ?? 0), 0)} soruluk net tavanının ${yuzdeYonelik(analiz.netTavanOrani)} karşılık geliyor.`
        : "",
      oncekiAnaliz
        ? `Bir önceki sınavına (${oncekiAnaliz.sinav.baslik}) göre netin ${netFarki! >= 0 ? "+" : ""}${netFarki!.toFixed(2)} değişmiş; performansın ${yon}.`
        : "Bu, sistemdeki ilk sınavın olduğu için karşılaştırma yapılamıyor; bundan sonraki her sınav bu tabloya işlenecek.",
    ]
      .filter(Boolean)
      .join(" "),
  });

  /* ── 2. Güçlü dersler ──────────────────────────────────────────── */
  const guclu = analiz.dersler.filter((d) => d.verim >= 0.6).slice(0, 2);
  if (guclu.length) {
    bloglar.push({
      baslik: "Güçlü Olduğun Alanlar",
      ton: "olumlu",
      metin:
        guclu
          .map(
            (d) =>
              `${d.ders.ad}: ${d.dogru} doğru / ${d.yanlis} yanlış / ${d.bos} boş → ${d.net.toFixed(2)} net ` +
              `(verim ${pct(d.verim)}${d.netDegisim !== null ? `, öncekiye göre ${d.netDegisim >= 0 ? "+" : ""}${d.netDegisim.toFixed(2)}` : ""})`,
          )
          .join(" • ") +
        ". Bu derslerde konu hâkimiyetin iyi seviyede; burada yeni konu çalışmak yerine hız ve isabet için bol deneme çözmek daha verimli olur.",
    });
  }

  /* ── 3. Zayıf dersler ──────────────────────────────────────────── */
  const zayif = analiz.dersler.filter((d) => d.verim < 0.45);
  if (zayif.length) {
    bloglar.push({
      baslik: "Öncelikli Alanlar",
      ton: "kritik",
      metin:
        zayif
          .map(
            (d) =>
              `${d.ders.ad} ${d.net.toFixed(2)} nette kalmış (verim ${pct(d.verim)}, yanlış oranı ${pct(d.yanlisOrani)})`,
          )
          .join("; ") +
        ". Bu dersler net tavanına en uzak olanlar ve her doğru burada en yüksek puan getirisi sağlıyor; çalışma programında ilk sıraya alındı.",
    });
  }

  /* ── 4. Yanlış / boş ayrımı ────────────────────────────────────── */
  const yanlisToplam = analiz.toplamDogru + analiz.toplamYanlis;
  const yanlisOrani = yanlisToplam ? analiz.toplamYanlis / yanlisToplam : 0;
  const bosOrani = analiz.toplamSoru ? analiz.toplamBos / analiz.toplamSoru : 0;

  if (yanlisOrani > 0.28) {
    bloglar.push({
      baslik: "Yanlış Analizi",
      ton: "uyari",
      metin: `İşaretlediğin soruların ${yuzdeIyelik(yanlisOrani)} yanlış. Bu oran %20 eşiğinin belirgin üstünde ve iki nedene işaret eder: ya konu eksiği var ya da soruyu okumadan cevaplıyorsun. ` +
        `Öneri: her deneme sonrası yanlış yaptığın her soruyu "bilgi eksiği / dikkat / işlem hatası / süre yetmedi" diye etiketleyip yanlış defterine yaz. ` +
        `Bir hafta sonra aynı soruları yeniden çöz; hâlâ yapamıyorsan konu eksiğidir ve konuya dönmen gerekir.`,
    });
  }
  if (bosOrani > 0.15) {
    bloglar.push({
      baslik: "Boş Bırakma Davranışı",
      ton: "uyari",
      metin: `Soruların ${yuzdeBelirtme(bosOrani)} boş bırakmışsın. Boş soru, yanlış sorudan daha pahalıdır: yanlış en azından sana hangi kazanımda eksik olduğunu söyler, boş hiçbir veri üretmez. ` +
        `Kalan süre sorunuysa tur tekniği uygula (kolay → orta → zor), süre değilse soruyu okumadan geçme alışkanlığına dön; her boş bıraktığın soruyu en azından eleyerek işaretle.`,
    });
  }
  if (yanlisOrani <= 0.2 && bosOrani <= 0.12) {
    bloglar.push({
      baslik: "Sınav Tekniği",
      ton: "olumlu",
      metin: `Yanlış oranın ${pct(yanlisOrani)}, boş oranın ${pct(bosOrani)}. Sınav tekniğin dengeli; işaretlediğin sorularda isabetin yüksek ve süre yönetimin soruna yol açmıyor.`,
    });
  }

  /* ── 5. Sınıf/kurum karşılaştırması ────────────────────────────── */
  if (s.sinifOrtalamaNet !== undefined || s.kurumOrtalamaNet !== undefined) {
    const sinifOrt = s.sinifOrtalamaNet;
    const kurumOrt = s.kurumOrtalamaNet;
    const parcalar: string[] = [];
    if (sinifOrt !== undefined) {
      const f = analiz.toplamNet - sinifOrt;
      parcalar.push(
        `sınıf ortalaması ${sinifOrt.toFixed(2)} net — senin ${f >= 0 ? `${f.toFixed(2)} net üstünde` : `${Math.abs(f).toFixed(2)} net altında`}`,
      );
    }
    if (kurumOrt !== undefined) {
      const f = analiz.toplamNet - kurumOrt;
      parcalar.push(
        `kurum ortalaması ${kurumOrt.toFixed(2)} net — senin ${f >= 0 ? `${f.toFixed(2)} net üstünde` : `${Math.abs(f).toFixed(2)} net altında`}`,
      );
    }
    bloglar.push({ baslik: "Karşılaştırma", ton: "bilgi", metin: parcalar.join("; ") + "." });
  }

  /* ── 6. Kazanım düzeyi yorum ───────────────────────────────────── */
  const kritikler = toplu.filter((k) => k.durum === "kritik" && k.toplam >= 2).slice(0, 6);
  if (kritikler.length) {
    bloglar.push({
      baslik: "Kritik Kazanım Eksikleri",
      ton: "kritik",
      metin:
        "Aşağıdaki kazanımlarda birden fazla sınavda ölçüldün ve ustalık düzeyin düşük kaldı. " +
        "Bunlar müfredatta merkezi konumda oldukları için diğer konuları da bloke ediyor:\n" +
        kritikler
          .map(
            (k) =>
              `• ${DERSLER[k.kazanim.ders].kisaAd} — ${k.kazanim.ad} (ustalık ${pct(k.ustalik)}, ağırlık ${k.kazanim.agirlik}/3)`,
          )
          .join("\n"),
    });
  }

  const ustalar = toplu.filter((k) => k.durum === "kazanildi" && k.toplam >= 2).slice(0, 5);
  if (ustalar.length) {
    bloglar.push({
      baslik: "Kazanılmış Beceriler",
      ton: "olumlu",
      metin:
        "Bu kazanımları ölçüldüğün sınavlarda istikrarlı biçimde doğru yapıyorsun: " +
        ustalar.map((k) => `${k.kazanim.ad} (${pct(k.ustalik)})`).join(", ") +
        ". Bunlar için konu çalışmaya gerek yok; sadece 2-3 haftada bir kısa tekrar yeterli.",
    });
  }

  /* ── 7. Trend yorumu ───────────────────────────────────────────── */
  if (oncekiAnaliz && netFarki !== null) {
    const dusenler = analiz.dersler.filter(
      (d) => d.netDegisim !== null && d.netDegisim < -1 && oncekiAnaliz.dersler.some((o) => o.ders.kod === d.ders.kod),
    );
    if (dusenler.length) {
      bloglar.push({
        baslik: "Gerileyen Dersler",
        ton: "uyari",
        metin:
          dusenler
            .map((d) => `${d.ders.ad} ${d.netDegisim!.toFixed(2)} net gerilemiş`)
            .join("; ") +
          ". Düşüş genelde iki şeyden olur: konu unutulmuştur (tekrar gerekmez, hatırlatma yeter) ya da soru tarzı değişmiştir (yeni kaynak gerekmez, aynı kazanımın farklı tipte sorularını çöz). " +
          "İkisini ayırmak için düşen dersin son sınavdaki yanlışlarına bak: yanlışlar aynı ünitede toplanıyorsa unutma, dağınıksa soru tipi değişimi.",
      });
    }
    const yukselenler = analiz.dersler.filter((d) => d.netDegisim !== null && d.netDegisim > 2);
    if (yukselenler.length) {
      bloglar.push({
        baslik: "Gelişim Gösteren Dersler",
        ton: "olumlu",
        metin:
          yukselenler
            .map((d) => `${d.ders.ad} +${d.netDegisim!.toFixed(2)} net`)
            .join("; ") +
          ". Uyguladığın çalışma yöntemi bu derslerde işe yarıyor; aynı yöntemi zayıf derslerine de taşı.",
      });
    }
  }

  /* ── 8. Hedef karşılaştırması ──────────────────────────────────── */
  const hedef = hedefKiyas(ogrenci, analiz);
  if (hedef) bloglar.push(hedef);

  return bloglar;
}

function hedefKiyas(ogrenci: Ogrenci, analiz: SinavAnalizi): YorumBlogu | null {
  if (!ogrenci.hedefPuan) return null;
  const k = siniflandir(ogrenci, analiz);
  if (!k) return null;
  if (k.netAcigi <= 0.5) {
    return {
      baslik: "Hedefe Uzaklık",
      ton: "olumlu",
      metin: `${ogrenci.hedefPuan} puanlık hedefinin yaklaşık karşılığı ${k.hedefNet.toFixed(0)} net; şu an ${analiz.toplamNet.toFixed(2)} nettesin ve hedef netin üstündesin. ` +
        `Bundan sonrası istikrar işi: deneme sıklığını artır, hata tipini sıfırla ve sınav günü rutinine çalış.`,
    };
  }
  const p = k.potansiyelDers;
  return {
    baslik: "Hedefe Uzaklık",
    ton: k.netAcigi > 20 ? "kritik" : "uyari",
    metin: `${ogrenci.hedefPuan} puanlık hedefin yaklaşık ${k.hedefNet.toFixed(0)} nete karşılık geliyor; şu an ${analiz.toplamNet.toFixed(2)} nettesin. ` +
      `Aradaki fark ${k.netAcigi.toFixed(2)} net, yani hedefin ${yuzdeBulunma(k.hedefeYuzde)}. ` +
      (p
        ? `Bu farkın en rahat kapanacağı yer ${p.ad}: ${p.mevcutNet.toFixed(2)} nettesin ve ${p.tavan} soruluk tavanda ${p.acik.toFixed(2)} netlik alan duruyor. `
        : "") +
      `Ölçülmüş kazanımların içinde en düşük ustalık ${pct(k.enDusukUstalik)} — demek ki açık tek bir konudan değil, birikmiş birkaç kazanım eksiğinden geliyor. ` +
      `Haftalık ${ogrenci.haftalikSaat} saatlik bütçenle bu fark kabaca ${k.tahminiHafta} haftalık odaklı çalışmayla kapanabilir (tahmin, mevcut seviyene göre haftada ${(k.netAcigi / k.tahminiHafta).toFixed(1)} net artış varsayar).`,
  };
}

/** Kazanım kartı için kısa, tek satırlık yorum. */
export function kazanimYorumu(k: KazanimDurumu): string {
  if (k.durum === "verisiz") return "Bu kazanım henüz girdiğin sınavlarda ölçülmedi.";
  const bolum: string[] = [];
  bolum.push(
    `${k.dogru} doğru, ${k.yanlis} yanlış, ${k.bos} boş → ustalık ${pct(k.ustalik)}.`,
  );
  if (k.durum === "kritik") {
    bolum.push(
      k.isabet < k.ustalik
        ? "Yanlışların doğru sayını geçiyor: konu anlatımına baştan dönüp örnek çözümü adım adım yazarak çalış."
        : "Konunun temel kavramlarında boşluk var; önce konu özeti, ardından 20 soruluk temel seviye test.",
    );
  } else if (k.durum === "gelistirilmeli") {
    bolum.push("Kısmen hâkimsin; karma test + yanlış analizi ile kalıcı hâle getir.");
  } else {
    bolum.push("Kazanılmış; ayda bir kısa tekrar yeterli.");
  }
  if (k.bos / Math.max(k.toplam, 1) > 0.3) bolum.push("Boş bırakma oranı yüksek — süre yönetimi çalış.");
  return bolum.join(" ");
}

/** Ders kartı için tek cümlelik özet. */
export function dersYorumu(d: DersAnalizi): string {
  const parcalar: string[] = [];
  parcalar.push(`${d.net.toFixed(2)} net (${pct(d.verim)} verim).`);
  if (d.bosOrani > 0.2) parcalar.push("Boş oranı yüksek: tur tekniği ve süre çalışması.");
  else if (d.yanlisOrani > 0.25) parcalar.push("Yanlış oranı yüksek: yanlış defteri + konu tekrarı.");
  else if (d.verim > 0.7) parcalar.push("Güçlü: deneme ağırlıklı ilerle.");
  else parcalar.push("Dengeli: konu + test karışık ilerle.");
  if (d.netDegisim !== null && Math.abs(d.netDegisim) >= 1) {
    parcalar.push(`Önceki sınavdan ${d.netDegisim >= 0 ? "+" : ""}${d.netDegisim.toFixed(2)} net.`);
  }
  return parcalar.join(" ");
}
