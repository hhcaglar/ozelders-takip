/**
 * Türkçe ek uyumu yardımcıları.
 *
 * Rapor veliye/öğrenciye verilen bir belge olduğu için bozuk ek kabul edilemez.
 * Yüzde ifadelerinde iyelik eki sayının SON KELİMESİNE takılır ("yüzde altmış iki" →
 * "yüzde altmış ikisi"), ardından hâl eki gelir.
 *
 * ÖNEMLİ: Son rakam tek başına yeterli DEĞİLDİR. 0 ile biten sayıların son kelimesi
 * değişir ve ek de onunla değişir:
 *   20 yirmi  → yirmisi   → %20'sine
 *   30 otuz   → otuzu     → %30'una
 *   40 kırk   → kırkı     → %40'ına
 *   50 elli   → ellisi    → %50'sine
 *   60 altmış → altmışı   → %60'ına
 *   70 yetmiş → yetmişi   → %70'ine
 *   80 seksen → sekseni   → %80'ine
 * Bu yüzden son kelime bulunup ünlü uyumu ona göre uygulanır.
 */

/** 0-100 arası sayıların okunuş kelimeleri. */
const BIRLER = ["sıfır", "bir", "iki", "üç", "dört", "beş", "altı", "yedi", "sekiz", "dokuz"];
const ONLAR = ["", "on", "yirmi", "otuz", "kırk", "elli", "altmış", "yetmiş", "seksen", "doksan"];

/** Son ünlüye göre iyelik ünlüsü. */
function iyelikUnlusu(kelime: string): "ı" | "i" | "u" | "ü" {
  const unluler = kelime.split("").filter((h) => "aeıioöuü".includes(h));
  const son = unluler[unluler.length - 1] ?? "a";
  if ("aı".includes(son)) return "ı";
  if ("ou".includes(son)) return "u";
  if ("öü".includes(son)) return "ü";
  return "i"; // e, i
}

function onUnluMu(kelime: string): boolean {
  const unluler = kelime.split("").filter((h) => "aeıioöuü".includes(h));
  const son = unluler[unluler.length - 1] ?? "a";
  return "eiöü".includes(son);
}

/** Sayının son kelimesi — iyelik eki buna takılır. */
function sonKelime(n: number): string {
  const y = Math.abs(Math.round(n));
  if (y === 0) return "sıfır";
  if (y === 100) return "yüz";
  const bir = y % 10;
  const on = Math.floor(y / 10);
  return bir !== 0 ? BIRLER[bir] : ONLAR[on];
}

function sesliMiBiter(kelime: string): boolean {
  return "aeıioöuü".includes(kelime[kelime.length - 1]);
}

interface Ekler {
  iyelik: string;
  yonelik: string;
  bulunma: string;
  belirtme: string;
  ilgi: string;
}

function ekler(n: number): Ekler {
  const kelime = sonKelime(n);
  const V = iyelikUnlusu(kelime);
  const iyelik = (sesliMiBiter(kelime) ? "s" : "") + V;
  const on = onUnluMu(kelime) ? "e" : "a";
  return {
    iyelik,
    yonelik: `${iyelik}n${on}`,
    bulunma: `${iyelik}nd${on}`,
    belirtme: `${iyelik}n${V}`,
    // İlgi hâli belirtmeden farklıdır: iyelik + n + ünlü + n ("ikisinin", "altmışının").
    ilgi: `${iyelik}n${V}n`,
  };
}

/** Girdi 0-1 arası oran ya da 0-100 arası yüzde olabilir; varsayılan olarak oran. */
function yuzdeyeCevir(deger: number, oranMi: boolean): number {
  return Math.round(oranMi ? deger * 100 : deger);
}

function olustur(deger: number, alan: keyof Ekler, oranMi: boolean): string {
  const y = yuzdeyeCevir(deger, oranMi);
  return `%${y}'${ekler(y)[alan]}`;
}

/** Yalın hâl: "%62" */
export function yuzde(deger: number, oranMi = true): string {
  return `%${yuzdeyeCevir(deger, oranMi)}`;
}

/** İyelik: "%62'si", "%20'si", "%60'ı" */
export function yuzdeIyelik(deger: number, oranMi = true): string {
  return olustur(deger, "iyelik", oranMi);
}

/** Yönelik: "%62'sine", "%20'sine", "%60'ına" */
export function yuzdeYonelik(deger: number, oranMi = true): string {
  return olustur(deger, "yonelik", oranMi);
}

/** Bulunma: "%62'sinde", "%20'sinde", "%60'ında" */
export function yuzdeBulunma(deger: number, oranMi = true): string {
  return olustur(deger, "bulunma", oranMi);
}

/** Belirtme: "%62'sini", "%20'sini", "%60'ını" */
export function yuzdeBelirtme(deger: number, oranMi = true): string {
  return olustur(deger, "belirtme", oranMi);
}

/** İlgi: "%62'sinin", "%20'sinin", "%60'ının" */
export function yuzdeIlgi(deger: number, oranMi = true): string {
  return olustur(deger, "ilgi", oranMi);
}

/** Testlerde ve hata mesajlarında kullanılmak üzere dışa açılır. */
export function yuzdeEkleri(n: number): Ekler {
  return ekler(n);
}
