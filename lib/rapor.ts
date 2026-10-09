import { DERSLER } from "./data/dersler";
import { dersTrendi, netTrendi, sinavAnalizi, topluKazanimDurumu } from "./analysis";
import { puandanNet, siniflandir } from "./rehberlik-core";
import { rehberlikRaporu } from "./rehberlik";
import { dersYorumu, kazanimYorumu, sinavYorumu } from "./yorum";
import { gunlereGoreGrupla, tipAdi } from "./plan";
import { uzunTarih, kisaTarih } from "./tarih";
import { yuzdeBulunma, yuzdeYonelik } from "./dilbilgisi";
import type {
  BlokTipi,
  CalismaProgrami,
  KazanimDurumu,
  Ogrenci,
  Sinav,
  SinavAnalizi,
  YorumBlogu,
} from "./types";

const pct = (x: number) => `%${Math.round(x * 100)}`;

export interface RaporBolumu {
  baslik: string;
  /** Bölümün kısa amacı — raporun başında içindekiler gibi görünür. */
  ozet?: string;
  paragraflar: string[];
  liste?: { madde: string; vurgu?: "olumlu" | "uyari" | "kritik" }[];
  tablo?: { basliklar: string[]; satirlar: string[][] };
}

export interface Rapor {
  ogrenciId: string;
  ogrenciAdi: string;
  baslik: string;
  /** Raporun üretildiği gün. */
  raporTarihi: string;
  /** Kapsanan sınav aralığı, insan okur biçimde. */
  donem: string;
  kunye: { etiket: string; deger: string }[];
  bolumler: RaporBolumu[];
  /** Aynı içeriğin düz metin hâli — veliye e-posta/mesaj olarak kopyalanabilir. */
  duzMetin: string;
  /** Raporun dayandığı sayısal taban; okuyucu her cümleyi buradan doğrulayabilir. */
  kaynak: {
    sinavSayisi: number;
    olculenKazanim: number;
    toplamKazanim: number;
    sonNet: number;
    hedefNet: number | null;
  };
}

/**
 * Veliye/öğrenciye verilebilir yazılı rehberlik raporu üretir.
 *
 * Rapordaki her cümle ölçülmüş veriden türetilir; serbest yorum katılmaz. Aynı veri
 * yapısından hem sayfa görünümü hem düz metin üretildiği için ikisi asla ayrışmaz.
 */
export function rehberlikRaporuUret(
  ogrenci: Ogrenci,
  sinavlar: Sinav[],
  program: CalismaProgrami | null,
): Rapor | null {
  if (!sinavlar.length) return null;

  const sirali = [...sinavlar].sort((a, b) => b.tarih.localeCompare(a.tarih));
  const son = sirali[0];
  const onceki = sirali[1];
  const analiz = sinavAnalizi(son, onceki);
  const oncekiAnaliz = onceki ? sinavAnalizi(onceki) : null;
  const toplu = topluKazanimDurumu(sirali);
  const paket = rehberlikRaporu(ogrenci, sinavlar);
  const rehberlik = paket?.rehberlik ?? null;
  const hedef = siniflandir(ogrenci, analiz, toplu);
  const yorumlar = sinavYorumu(ogrenci, analiz, onceki, oncekiAnaliz, toplu);
  const trend = netTrendi(sirali);

  const olculen = toplu.filter((k) => k.durum !== "verisiz");
  const kritik = toplu.filter((k) => k.durum === "kritik");
  const gelistirilmeli = toplu.filter((k) => k.durum === "gelistirilmeli");
  const kazanildi = toplu.filter((k) => k.durum === "kazanildi");
  const verisiz = toplu.filter((k) => k.durum === "verisiz");

  const bolumler: RaporBolumu[] = [];

  /* ── 1. Genel durum ────────────────────────────────────────────── */
  bolumler.push({
    baslik: "1. Genel Durum",
    ozet: "Öğrencinin ölçülen son sınavdaki konumu ve gidiş yönü.",
    paragraflar: [
      `${ogrenci.ad}, ${ogrenci.sinavTuru} hazırlığı kapsamında ${uzunTarih(son.tarih)} tarihli ` +
        `${son.baslik} sınavına girmiştir. ${analiz.toplamSoru} soruluk sınavda ${analiz.toplamDogru} doğru, ` +
        `${analiz.toplamYanlis} yanlış ve ${analiz.toplamBos} boş ile ${analiz.toplamNet.toFixed(2)} net elde etmiştir. ` +
        `Bu sonuç, sınavın ${analiz.sinav.bolumler.reduce((t, b) => t + (DERSLER[b.ders]?.soruSayisi ?? 0), 0)} soruluk ` +
        `net tavanının ${yuzdeYonelik(analiz.netTavanOrani)} karşılık gelmektedir.`,
      oncekiAnaliz
        ? `Bir önceki sınav (${oncekiAnaliz.sinav.baslik}, ${uzunTarih(onceki.tarih)}) ile karşılaştırıldığında ` +
          `toplam net ${trendEgitimYon(oncekiAnaliz.toplamNet, analiz.toplamNet)}. Kazanım düzeyinde ölçülen ortalama ` +
          `ustalık ${pct(analiz.ustalikOrtalama)} seviyesindedir; bu, öğrencinin karşılaştığı kazanımların ` +
          `${yuzdeBulunma(analiz.ustalikOrtalama)} doğru yanıt verebildiği anlamına gelir.`
        : `Bu, sistemde kayıtlı ilk sınavı olduğu için karşılaştırmalı bir değerlendirme yapılamamaktadır. ` +
          `Kazanım düzeyinde ölçülen ortalama ustalık ${pct(analiz.ustalikOrtalama)} seviyesindedir.`,
    ],
    tablo: {
      basliklar: ["Gösterge", "Değer", "Değerlendirme"],
      satirlar: [
        ["Toplam net", analiz.toplamNet.toFixed(2), hedef ? hedefDurumMetni(hedef.netAcigi) : "hedef tanımsız"],
        ["Doğru / Yanlış / Boş", `${analiz.toplamDogru} / ${analiz.toplamYanlis} / ${analiz.toplamBos}`, bosYorumu(analiz)],
        ["Kazanım ustalığı", pct(analiz.ustalikOrtalama), ustalikDegerlendirme(analiz.ustalikOrtalama)],
        ["Ölçülen kazanım", `${olculen.length} / ${toplu.length}`, verisiz.length ? `${verisiz.length} kazanım hiç ölçülmedi` : "katalog tam ölçülmüş"],
        ["Kritik kazanım", String(kritik.length), kritik.length === 0 ? "kritik eksik yok" : "öncelikli çalışma alanı"],
      ],
    },
  });

  /* ── 2. Ders bazlı değerlendirme ───────────────────────────────── */
  bolumler.push({
    baslik: "2. Ders Bazlı Değerlendirme",
    ozet: "Her dersin neti, verimi ve bir önceki sınava göre değişimi.",
    paragraflar: [
      `Sınav, ${analiz.dersler.length} dersten oluşmaktadır. Dersler net verimine göre sıralandığında en güçlü alan ` +
        `${analiz.guclu[0]?.ders.ad} (${analiz.guclu[0]?.net.toFixed(2)} net, ${pct(analiz.guclu[0]?.verim ?? 0)} verim), ` +
        `en zayıf alan ise ${analiz.zayif[0]?.ders.ad} (${analiz.zayif[0]?.net.toFixed(2)} net, ` +
        `${pct(analiz.zayif[0]?.verim ?? 0)} verim) olarak görülmektedir. Net tavanına en uzak ders, çalışma ` +
        `programında en yüksek payı almıştır.`,
    ],
    tablo: {
      basliklar: ["Ders", "D / Y / B", "Net", "Verim", "Değişim", "Değerlendirme"],
      satirlar: analiz.dersler.map((d) => [
        d.ders.ad,
        `${d.dogru} / ${d.yanlis} / ${d.bos}`,
        d.net.toFixed(2),
        pct(d.verim),
        d.netDegisim === null ? "—" : `${d.netDegisim >= 0 ? "+" : ""}${d.netDegisim.toFixed(2)}`,
        dersYorumu(d),
      ]),
    },
  });

  /* ── 3. Kazanım düzeyinde eksikler ─────────────────────────────── */
  const oncelikliler = [...kritik, ...gelistirilmeli].sort((a, b) => b.oncelik - a.oncelik).slice(0, 12);
  bolumler.push({
    baslik: "3. Kazanım Düzeyinde Eksikler",
    ozet: "MEB kazanım kataloğuyla kıyaslandığında öncelikli çalışma alanları.",
    paragraflar: [
      `Öğrencinin yanıtları MEB kazanım kataloğundaki ${toplu.length} kazanımla eşleştirilmiştir. Bunların ` +
        `${olculen.length} tanesi en az bir sınavda ölçülmüş, ${kazanildi.length} kazanımda yeterli ustalık ` +
        `gözlenmiş, ${kritik.length} kazanım kritik düzeyde eksik, ${gelistirilmeli.length} kazanım ise ` +
        `geliştirilmeye açık durumda tespit edilmiştir.`,
      oncelikliler.length
        ? `Aşağıdaki liste, öncelik skoruna göre sıralanmıştır. Skor üç bileşenden oluşur: kazanımın müfredattaki ` +
          `ağırlığı, öğrencinin o kazanımdaki ustalık eksiği ve kazanımın kaç kez ölçüldüğü. Yüksek skor, ` +
          `"hem önemli hem de zayıf" anlamına gelir.`
        : `Ölçülen kazanımların tamamında yeterli ustalık gözlenmiştir; bu bölümde öncelikli eksik bulunmamaktadır.`,
    ],
    tablo: oncelikliler.length
      ? {
          basliklar: ["Ders", "Kazanım", "Ünite", "Ustalık", "Durum", "Öneri"],
          satirlar: oncelikliler.map((k) => [
            DERSLER[k.kazanim.ders].kisaAd,
            k.kazanim.ad,
            k.kazanim.unite,
            pct(k.ustalik),
            k.durum === "kritik" ? "Kritik" : "Geliştirilmeli",
            kazanimYorumu(k),
          ]),
        }
      : undefined,
    liste: verisiz.length
      ? [
          {
            madde:
              `${verisiz.length} kazanım (${pct(verisiz.length / toplu.length)}) öğrencinin girdiği sınavlarda hiç ` +
              `sorulmadığı için ölçülememiştir. Bu kazanımlar kör nokta olabilir; farklı yayınevlerinin denemeleri ` +
              `çözülerek ölçüm kapsamı genişletilmelidir.`,
            vurgu: "uyari",
          },
        ]
      : undefined,
  });

  /* ── 4. Güçlü alanlar ──────────────────────────────────────────── */
  const ustalar = kazanildi.sort((a, b) => b.toplam - a.toplam).slice(0, 8);
  bolumler.push({
    baslik: "4. Güçlü Alanlar",
    ozet: "Korunması gereken, tekrar yükü düşük beceriler.",
    paragraflar: [
      ustalar.length
        ? `Öğrenci aşağıdaki kazanımlarda ölçüldüğü sınavların tamamına yakınında doğru yanıt vermiştir. Bu alanlarda ` +
          `yeni konu çalışmak yerine mevcut düzeyi korumak yeterlidir; ayda bir kısa tekrar bu kazanımların ` +
          `kalıcılığı için yeterli olacaktır.`
        : `Ölçülen kazanımların hiçbirinde tam ustalık gözlenmemiştir; tüm alanlar geliştirilmeye açıktır.`,
    ],
    liste: ustalar.length
      ? ustalar.map((k) => ({
          madde: `${DERSLER[k.kazanim.ders].kisaAd} — ${k.kazanim.ad} (ustalık ${pct(k.ustalik)}, ${k.dogru} doğru / ${k.toplam} ölçüm)`,
          vurgu: "olumlu" as const,
        }))
      : [
          {
            madde: `${analiz.guclu[0]?.ders.ad} dersi görece en güçlü alandır (${pct(analiz.guclu[0]?.verim ?? 0)} verim) ` +
              `ancak kazanım düzeyinde tam ustalık gözlenmemiştir.`,
            vurgu: "bilgi" as never,
          },
        ],
  });

  /* ── 5. Hedef karşılaştırması ──────────────────────────────────── */
  if (hedef) {
    bolumler.push({
      baslik: "5. Hedef Karşılaştırması",
      ozet: "Belirlenen hedef puan ile mevcut düzey arasındaki fark ve kapanma süresi.",
      paragraflar: [
        `Öğrencinin hedefi ${ogrenci.hedefPuan} puandır${ogrenci.hedefSiralama ? ` (hedef sıralama ${ogrenci.hedefSiralama.toLocaleString("tr-TR")})` : ""}. ` +
          `Bu hedefin ${ogrenci.sinavTuru} karşılığı yaklaşık ${hedef.hedefNet.toFixed(0)} nettir. Öğrenci şu an ` +
          `${analiz.toplamNet.toFixed(2)} nettedir; yani hedefin ${yuzdeYonelik(hedef.hedefeYuzde)} ulaşmış durumdadır.`,
        hedef.netAcigi <= 0.5
          ? `Hedef netin üstünde bir sonuç elde edilmiştir. Bundan sonraki çalışma yeni konu kazanımından çok ` +
            `istikrarı korumaya yönelik olmalıdır: deneme sıklığının artırılması, hata tiplerinin sıfırlanması ve ` +
            `sınav günü rutininin pekiştirilmesi önerilir.`
          : `Kapatılması gereken fark ${hedef.netAcigi.toFixed(2)} nettir. Öğrencinin haftalık ${ogrenci.haftalikSaat} saatlik ` +
            `çalışma bütçesiyle bu farkın yaklaşık ${hedef.tahminiHafta} haftada kapanabileceği öngörülmektedir. ` +
            `Bu tahmin, mevcut seviyeye göre haftada ortalama ${(hedef.netAcigi / hedef.tahminiHafta).toFixed(1)} net ` +
            `artış varsayar ve düşük seviyelerde yüksek, yüksek seviyelerde düşük gerçekleşir.`,
      ],
      tablo: {
        basliklar: ["Ders", "Mevcut net", "Hedef net", "Açık"],
        satirlar: Object.entries(rehberlik?.dersBazliHedefNet ?? {}).map(([ders, h]) => [
          ders,
          String(analiz.dersler.find((d) => d.ders.kisaAd === ders)?.net.toFixed(2) ?? "—"),
          h.toFixed(2),
          ((rehberlik?.dersBazliAcik[ders] ?? 0) >= 0 ? "-" : "+") +
            Math.abs(rehberlik?.dersBazliAcik[ders] ?? 0).toFixed(2),
        ]),
      },
    });
  }

  /* ── 6. Önerilen çalışma düzeni ────────────────────────────────── */
  if (program) {
    const gunler = gunlereGoreGrupla(program);
    const tipDagilim = new Map<BlokTipi, number>();
    for (const b of program.bloklar) {
      tipDagilim.set(b.tip, (tipDagilim.get(b.tip) ?? 0) + b.dakika);
    }
    const toplamDakika = program.bloklar.reduce((t, b) => t + b.dakika, 0);
    const kapsanan = new Set(program.bloklar.map((b) => b.kazanimId).filter(Boolean)).size;

    bolumler.push({
      baslik: "6. Önerilen Çalışma Düzeni",
      ozet: "Üretilen çalışma programının kapsamı ve haftalık dağılımı.",
      paragraflar: [
        `${program.haftaSayisi} haftalık bir çalışma programı oluşturulmuştur (${uzunTarih(program.baslangicTarihi)} ` +
          `başlangıçlı). Program ${program.bloklar.length} bloktan ve toplam ${(toplamDakika / 60).toFixed(1)} saatten ` +
          `oluşmakta, ${kapsanan} kazanımı kapsamaktadır. Her kazanım için önce konu çalışması, ardından soru çözümü ` +
          `planlanmış; kritik kazanımlara 1-3-7 gün aralıklı tekrar eklenmiştir. Haftada bir genel deneme ve bir ` +
          `yanlış analizi oturumu ayrılmıştır.`,
        `Blok dağılımı: ` +
          [...tipDagilim.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([t, d]) => `${tipAdi(t)} ${(d / 60).toFixed(1)} saat`)
            .join(", ") +
          `. Çalışma günleri: ${gunler.length} gün.`,
      ],
      tablo: {
        basliklar: ["Hafta", "Çalışma günü", "Blok", "Süre"],
        satirlar: haftalikOzet(gunler, program.baslangicTarihi),
      },
    });
  }

  /* ── 7. Rehber öğretmen notu ───────────────────────────────────── */
  const notlar = rehberlik
    ? [...rehberlik.riskler.map((r) => ({ madde: r, vurgu: "kritik" as const })), ...rehberlik.oneriler.map((o) => ({ madde: o, vurgu: "olumlu" as const }))]
    : [];
  bolumler.push({
    baslik: "7. Rehberlik Notları",
    ozet: "Veli ve öğrenci için uygulanabilir öneriler ve dikkat edilmesi gereken riskler.",
    paragraflar: [
      `Bu bölüm, yukarıdaki sayısal bulgulardan türetilmiş uygulanabilir önerileri içerir. Önerilerin sırası ` +
        `önem sırasına göredir; riskler önce, öneriler sonra listelenmiştir.`,
    ],
    liste: notlar,
  });

  /* ── 8. Ölçüm notu ─────────────────────────────────────────────── */
  bolumler.push({
    baslik: "8. Ölçüm ve Yöntem Notu",
    paragraflar: [
      `Net hesabında ${ogrenci.sinavTuru === "LGS" ? "3 yanlış 1 doğruyu götürür" : "4 yanlış 1 doğruyu götürür"} ` +
        `varsayımı kullanılmıştır. Kazanım ustalığı, boş bırakılan sorular da öğrenme eksiği sayılarak ` +
        `doğru / (doğru + yanlış + boş) olarak hesaplanmıştır.`,
      `Hedef puandan net karşılığına dönüşüm yaklaşıktır. ÖSYM ve MEB gerçek hesaplamada ham puanı standart puana ` +
        `(T-puan) çevirir; bu dönüşüm sınav popülasyonunun ortalamasına ve standart sapmasına bağlıdır ve sınavdan ` +
        `önce bilinemez. Bu rapordaki puan ve sıralama değerleri yön gösterici eşiklerdir, resmî hesap değildir.`,
      yorumKaynakNotu(yorumlar),
    ],
  });

  const kunye = [
    { etiket: "Öğrenci", deger: ogrenci.ad },
    { etiket: "Sınıf", deger: `${ogrenci.sinifSeviyesi}. sınıf` },
    { etiket: "Sınav", deger: ogrenci.sinavTuru },
    ...(ogrenci.okul ? [{ etiket: "Kurum", deger: ogrenci.okul }] : []),
    { etiket: "Rapor tarihi", deger: uzunTarih(new Date().toISOString().slice(0, 10)) },
    { etiket: "Kapsanan dönem", deger: `${kisaTarih(sirali[sirali.length - 1].tarih)} – ${kisaTarih(son.tarih)}` },
    { etiket: "Sınav sayısı", deger: String(sinavlar.length) },
    ...(ogrenci.hedefPuan ? [{ etiket: "Hedef", deger: `${ogrenci.hedefPuan} puan` }] : []),
  ];

  const rapor: Rapor = {
    ogrenciId: ogrenci.id,
    ogrenciAdi: ogrenci.ad,
    baslik: `${ogrenci.ad} — ${ogrenci.sinavTuru} Rehberlik ve Kazanım Değerlendirme Raporu`,
    raporTarihi: new Date().toISOString().slice(0, 10),
    donem: `${kisaTarih(sirali[sirali.length - 1].tarih)} – ${kisaTarih(son.tarih)}`,
    kunye,
    bolumler,
    duzMetin: "",
    kaynak: {
      sinavSayisi: sinavlar.length,
      olculenKazanim: olculen.length,
      toplamKazanim: toplu.length,
      sonNet: analiz.toplamNet,
      hedefNet: hedef?.hedefNet ?? null,
    },
  };
  rapor.duzMetin = duzMetneCevir(rapor);
  return rapor;
}

/* ─────────────────────────── Yardımcılar ─────────────────────────── */

function trendEgitimYon(onceki: number, simdiki: number): string {
  const fark = simdiki - onceki;
  if (fark > 1) return `${fark.toFixed(2)} net artmıştır (yükseliş eğilimi)`;
  if (fark < -1) return `${Math.abs(fark).toFixed(2)} net azalmıştır (gerileme eğilimi)`;
  return `belirgin biçimde değişmemiştir (${fark >= 0 ? "+" : ""}${fark.toFixed(2)} net)`;
}

function hedefDurumMetni(acik: number): string {
  if (acik <= 0.5) return "hedefin üstünde";
  if (acik <= 10) return "hedefe yakın";
  if (acik <= 20) return "hedefin gerisinde";
  return "hedefin belirgin gerisinde";
}

function bosYorumu(analiz: SinavAnalizi): string {
  const bosOrani = analiz.toplamSoru ? analiz.toplamBos / analiz.toplamSoru : 0;
  if (bosOrani > 0.15) return "boş oranı yüksek — süre yönetimi çalışılmalı";
  if (bosOrani > 0.08) return "boş oranı kabul edilebilir";
  return "süre yönetimi yeterli";
}

function ustalikDegerlendirme(u: number): string {
  if (u >= 0.75) return "iyi düzeyde";
  if (u >= 0.6) return "orta düzeyde, geliştirilmeli";
  if (u >= 0.4) return "zayıf, sistematik çalışma gerekli";
  return "çok zayıf, temel konulara dönüş gerekli";
}

function yorumKaynakNotu(yorumlar: YorumBlogu[]): string {
  const kritik = yorumlar.filter((y) => y.ton === "kritik").length;
  const uyari = yorumlar.filter((y) => y.ton === "uyari").length;
  return `Bu rapordaki değerlendirmeler kural tabanlı bir değerlendirme motoru tarafından üretilmiştir: her cümle ` +
    `ölçülebilir bir eşikten türetilir (örneğin yanlış oranı > %28, boş oranı > %15, net düşüşü < −1). ` +
    `Bu sınav için ${kritik} kritik ve ${uyari} uyarı düzeyinde bulgu üretilmiştir.`;
}

function haftalikOzet(
  gunler: { tarih: string; bloklar: unknown[]; toplamDakika: number }[],
  baslangic: string,
): string[][] {
  const map = new Map<number, { gun: number; dakika: number }>();
  for (const g of gunler) {
    const hafta = Math.floor(
      (Date.UTC(Number(g.tarih.slice(0, 4)), Number(g.tarih.slice(5, 7)) - 1, Number(g.tarih.slice(8, 10))) -
        Date.UTC(Number(baslangic.slice(0, 4)), Number(baslangic.slice(5, 7)) - 1, Number(baslangic.slice(8, 10)))) /
        (7 * 86400000),
    );
    const once = map.get(hafta) ?? { gun: 0, dakika: 0 };
    once.gun += 1;
    once.dakika += g.toplamDakika;
    map.set(hafta, once);
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([hafta, v]) => [
      `${hafta + 1}. hafta`,
      String(v.gun),
      String(gunler.filter((g) => haftaEslestir(g.tarih, baslangic, hafta)).reduce((t, g) => g.bloklar.length, 0)),
      `${(v.dakika / 60).toFixed(1)} saat`,
    ]);
}

function haftaEslestir(tarih: string, baslangic: string, hafta: number): boolean {
  return (
    Math.floor(
      (Date.UTC(Number(tarih.slice(0, 4)), Number(tarih.slice(5, 7)) - 1, Number(tarih.slice(8, 10))) -
        Date.UTC(Number(baslangic.slice(0, 4)), Number(baslangic.slice(5, 7)) - 1, Number(baslangic.slice(8, 10)))) /
        (7 * 86400000),
    ) === hafta
  );
}

/** Raporu veliye gönderilebilir düz metne çevirir. */
export function duzMetneCevir(rapor: Rapor): string {
  const cizgi = "─".repeat(60);
  const satirlar: string[] = [rapor.baslik.toUpperCase(), cizgi];
  for (const k of rapor.kunye) satirlar.push(`${k.etiket}: ${k.deger}`);
  satirlar.push("");
  for (const b of rapor.bolumler) {
    satirlar.push(b.baslik.toUpperCase());
    if (b.ozet) satirlar.push(`(${b.ozet})`);
    satirlar.push("");
    for (const p of b.paragraflar) satirlar.push(p, "");
    if (b.tablo) {
      satirlar.push(b.tablo.basliklar.join(" | "));
      satirlar.push(b.tablo.basliklar.map(() => "—").join(" | "));
      for (const s of b.tablo.satirlar) satirlar.push(s.join(" | "));
      satirlar.push("");
    }
    if (b.liste) {
      for (const l of b.liste) satirlar.push(`• ${l.madde}`);
      satirlar.push("");
    }
  }
  satirlar.push(cizgi);
  satirlar.push("Bu rapor ozelders-takip paneli tarafından üretilmiştir.");
  return satirlar.join("\n");
}

export { dersTrendi };
