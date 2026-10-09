/**
 * Panel genelinde kullanılan veri modeli.
 * Tüm tipler JSON'a serileştirilebilir olmalıdır (dosya tabanlı kalıcılık).
 */

export type SinavTuru = "TYT" | "AYT" | "LGS";

export type DersKodu =
  // TYT
  | "TYT_TUR"
  | "TYT_MAT"
  | "TYT_SOS"
  | "TYT_FEN"
  // AYT
  | "AYT_MAT"
  | "AYT_FIZ"
  | "AYT_KIM"
  | "AYT_BIY"
  | "AYT_EDB"
  | "AYT_TAR"
  | "AYT_COG"
  | "AYT_FEL"
  // LGS
  | "LGS_TUR"
  | "LGS_MAT"
  | "LGS_FEN"
  | "LGS_INK"
  | "LGS_DIN"
  | "LGS_INS";

export interface DersBilgisi {
  kod: DersKodu;
  ad: string;
  kisaAd: string;
  sinav: SinavTuru;
  alan: "sayisal" | "sozel" | "esitagirlik" | "dil" | "genel";
  /** Bu derse ait standart soru sayısı (ÖSYM/MEB yerleşimi). */
  soruSayisi: number;
  /** Grafik/rozet rengi. */
  renk: string;
}

export interface Kazanim {
  id: string;
  kod: string;
  ad: string;
  ders: DersKodu;
  unite: string;
  /** Müfredattaki önemi + sınavda çıkma sıklığı (1-3). Öncelik skorunda çarpan olarak kullanılır. */
  agirlik: number;
  /** Ortalama öğrenci için zorluk; çalışma programındaki süre tahminini etkiler. */
  zorluk: "kolay" | "orta" | "zor";
}

/** Bir sınavdaki ders bazlı ham sonuç. */
export interface BolumSonucu {
  ders: DersKodu;
  dogru: number;
  yanlis: number;
  bos: number;
}

/** Tek bir sorunun kazanım eşleşmeli sonucu (optik okuma çıktısı). */
export interface SoruSonucu {
  no: number;
  ders: DersKodu;
  kazanimId: string | null;
  dogru: boolean;
  /** false ise soru boş bırakılmış; boş ile yanlış ayrımı kritik. */
  isaretlendi: boolean;
}

export type VeriKaynagi = "okulizyon" | "manuel" | "demo";

export interface Sinav {
  id: string;
  ogrenciId: string;
  baslik: string;
  /** YYYY-MM-DD */
  tarih: string;
  sinavTuru: SinavTuru;
  yayinevi?: string;
  kaynak: VeriKaynagi;
  /** Okulizyon'daki sınav/optik kaynağına referans. */
  kaynakRef?: string;
  bolumler: BolumSonucu[];
  sorular: SoruSonucu[];
  puan?: number;
  genelSiralama?: number;
  sinifSiralamasi?: number;
  /** Karşılaştırma için okulizyon'un verdiği ortalamalar (net cinsinden). */
  sinifOrtalamaNet?: number;
  kurumOrtalamaNet?: number;
  /** Sınav süresini etkin kullanma ölçütü: boş bırakılan soruların toplam içindeki payı. */
  sureNotu?: string;
  olusturulma: string;
}

export interface Ogrenci {
  id: string;
  ad: string;
  sinifSeviyesi: string;
  sinavTuru: SinavTuru;
  okul?: string;
  okulizyonOgrenciNo?: string;
  hedefPuan?: number;
  hedefSiralama?: number;
  /** Haftalık çalışmaya ayrılabilen saat. */
  haftalikSaat: number;
  /** 0 = Pazar ... 6 = Cumartesi */
  calismaGunleri: number[];
  /** Oturum başına çalışma dakikası (Pomodoro blok uzunluğu). */
  blokDakika: number;
  olusturulma: string;
  guncelleme: string;
}

/** Okulizyon bağlantı ayarları. Şifreler diske yazılmaz. */
export interface BaglantiAyari {
  aktif: boolean;
  baseUrl: string;
  girisEndpoint: string;
  karneEndpoint: string;
  ogrenciNo: string;
  tcKimlikNo: string;
  il: string;
  ilce: string;
  kurum: string;
  /** 'demo' = örnek veri üreticisi, 'http' = gerçek Okulizyon çağrısı */
  mod: "demo" | "http";
  sonSenkron?: string;
  sonSenkronDurum?: "basarili" | "hata";
  sonSenkronMesaj?: string;
}

export interface VeriTabani {
  ogrenciler: Ogrenci[];
  sinavlar: Sinav[];
  baglanti: BaglantiAyari;
}

/** Kazanım bazlı öğrenme durumu. */
export interface KazanimDurumu {
  kazanim: Kazanim;
  dogru: number;
  yanlis: number;
  bos: number;
  toplam: number;
  /** dogru / (doğru+yanlış+boş) */
  ustalik: number;
  /** yalnızca işaretlenmişler üstünden: dogru / (doğru+yanlış) */
  isabet: number;
  /** (agirlik * (1-ustalik) * log(1+toplam)) ile hesaplanan çalışma önceliği */
  oncelik: number;
  durum: "kazanildi" | "gelistirilmeli" | "kritik" | "verisiz";
}

export interface DersAnalizi {
  ders: DersBilgisi;
  dogru: number;
  yanlis: number;
  bos: number;
  net: number;
  /** net / soru sayısı (0-1) */
  verim: number;
  yanlisOrani: number;
  bosOrani: number;
  /** Son iki sınav arasındaki net değişimi */
  netDegisim: number | null;
}

export interface SinavAnalizi {
  sinav: Sinav;
  toplamDogru: number;
  toplamYanlis: number;
  toplamBos: number;
  toplamNet: number;
  toplamSoru: number;
  netTavanOrani: number;
  dersler: DersAnalizi[];
  /** En yüksek verimli 2 ders */
  guclu: DersAnalizi[];
  /** En düşük verimli 2 ders */
  zayif: DersAnalizi[];
  kritikKazanimlar: KazanimDurumu[];
  ustalikOrtalama: number;
}

export interface YorumBlogu {
  baslik: string;
  ton: "olumlu" | "uyari" | "kritik" | "bilgi";
  metin: string;
}

export interface RehberlikSonucu {
  hedefNet: number | null;
  mevcutNet: number;
  netAcigi: number;
  hedefeYuzde: number;
  tahminiSiralama: number | null;
  dersBazliHedefNet: Record<string, number>;
  dersBazliAcik: Record<string, number>;
  oncelikSirasi: { ders: string; kazanimAdi: string; oncelik: number; ustalik: number }[];
  tekrarListesi: { kazanimAdi: string; ders: string; gun: number }[];
  oneriler: string[];
  riskler: string[];
}

export type BlokTipi = "konu" | "test" | "tekrar" | "deneme" | "yanlis-analizi";

export interface CalismaBlogu {
  id: string;
  /** YYYY-MM-DD */
  tarih: string;
  baslangic: string;
  dakika: number;
  tip: BlokTipi;
  ders: string;
  baslik: string;
  detay: string;
  kazanimId?: string;
  tamamlandi?: boolean;
}

export interface CalismaProgrami {
  ogrenciId: string;
  baslangicTarihi: string;
  haftaSayisi: number;
  haftalikSaat: number;
  olusturulma: string;
  bloklar: CalismaBlogu[];
  ozet: string[];
}
