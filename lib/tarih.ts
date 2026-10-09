export const GUN_ADLARI = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
export const GUN_KISA = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
export const AYLAR = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

/** Date -> YYYY-MM-DD (yerel tarih, saat kayması olmadan). */
export function isoTarih(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const g = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${g}`;
}

/** YYYY-MM-DD -> Date (yerel saat 00:00). */
export function tarihtenIso(iso: string): Date {
  const [y, m, g] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, g ?? 1);
}

export function gunEkle(iso: string, gun: number): string {
  const d = tarihtenIso(iso);
  d.setDate(d.getDate() + gun);
  return isoTarih(d);
}

/** 0=Pazar ... 6=Cumartesi */
export function gunIndex(iso: string): number {
  return tarihtenIso(iso).getDay();
}

export function bugunIso(): string {
  return isoTarih(new Date());
}

/** TR biçimli kısa tarih: 12 Eki */
export function kisaTarih(iso: string): string {
  const d = tarihtenIso(iso);
  return `${d.getDate()} ${AYLAR[d.getMonth()].slice(0, 3)}`;
}

/** TR biçimli tam tarih: 12 Ekim 2026 Pazartesi */
export function uzunTarih(iso: string): string {
  const d = tarihtenIso(iso);
  return `${d.getDate()} ${AYLAR[d.getMonth()]} ${d.getFullYear()} ${GUN_ADLARI[d.getDay()]}`;
}

/** Dakika -> SS:DD */
export function dakikaSaat(dakika: number): string {
  const s = Math.floor(dakika / 60);
  const d = dakika % 60;
  return s ? `${s} sa ${d} dk` : `${d} dk`;
}

/** "HH:MM" + dakika -> "HH:MM" */
export function saatEkle(saat: string, dakika: number): string {
  const [h, m] = saat.split(":").map(Number);
  const toplam = (h ?? 0) * 60 + (m ?? 0) + dakika;
  const hh = String(Math.floor((toplam % 1440) / 60)).padStart(2, "0");
  const mm = String(((toplam % 1440) % 60)).padStart(2, "0");
  return `${hh}:${mm}`;
}
