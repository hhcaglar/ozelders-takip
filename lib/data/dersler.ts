import type { DersBilgisi, DersKodu, SinavTuru } from "../types";

/**
 * ÖSYM/MEB sınav yerleşimine göre ders kartları.
 * soruSayisi: TYT ve AYT için ÖSYM test yapısı, LGS için MEB merkezi sınav yapısı.
 */
export const DERSLER: Record<DersKodu, DersBilgisi> = {
  TYT_TUR: { kod: "TYT_TUR", ad: "TYT Türkçe", kisaAd: "Türkçe", sinav: "TYT", alan: "genel", soruSayisi: 40, renk: "#6366f1" },
  TYT_MAT: { kod: "TYT_MAT", ad: "TYT Matematik", kisaAd: "Matematik", sinav: "TYT", alan: "sayisal", soruSayisi: 40, renk: "#f59e0b" },
  TYT_SOS: { kod: "TYT_SOS", ad: "TYT Sosyal Bilimler", kisaAd: "Sosyal", sinav: "TYT", alan: "sozel", soruSayisi: 20, renk: "#10b981" },
  TYT_FEN: { kod: "TYT_FEN", ad: "TYT Fen Bilimleri", kisaAd: "Fen", sinav: "TYT", alan: "sayisal", soruSayisi: 20, renk: "#ef4444" },

  AYT_MAT: { kod: "AYT_MAT", ad: "AYT Matematik", kisaAd: "AYT Mat", sinav: "AYT", alan: "sayisal", soruSayisi: 40, renk: "#f59e0b" },
  AYT_FIZ: { kod: "AYT_FIZ", ad: "AYT Fizik", kisaAd: "Fizik", sinav: "AYT", alan: "sayisal", soruSayisi: 14, renk: "#3b82f6" },
  AYT_KIM: { kod: "AYT_KIM", ad: "AYT Kimya", kisaAd: "Kimya", sinav: "AYT", alan: "sayisal", soruSayisi: 13, renk: "#8b5cf6" },
  AYT_BIY: { kod: "AYT_BIY", ad: "AYT Biyoloji", kisaAd: "Biyoloji", sinav: "AYT", alan: "sayisal", soruSayisi: 13, renk: "#22c55e" },
  AYT_EDB: { kod: "AYT_EDB", ad: "AYT Türk Dili ve Edebiyatı", kisaAd: "Edebiyat", sinav: "AYT", alan: "sozel", soruSayisi: 24, renk: "#ec4899" },
  AYT_TAR: { kod: "AYT_TAR", ad: "AYT Tarih", kisaAd: "Tarih", sinav: "AYT", alan: "sozel", soruSayisi: 21, renk: "#14b8a6" },
  AYT_COG: { kod: "AYT_COG", ad: "AYT Coğrafya", kisaAd: "Coğrafya", sinav: "AYT", alan: "sozel", soruSayisi: 17, renk: "#84cc16" },
  AYT_FEL: { kod: "AYT_FEL", ad: "AYT Felsefe Grubu", kisaAd: "Felsefe", sinav: "AYT", alan: "sozel", soruSayisi: 12, renk: "#a855f7" },

  LGS_TUR: { kod: "LGS_TUR", ad: "LGS Türkçe", kisaAd: "Türkçe", sinav: "LGS", alan: "genel", soruSayisi: 20, renk: "#6366f1" },
  LGS_MAT: { kod: "LGS_MAT", ad: "LGS Matematik", kisaAd: "Matematik", sinav: "LGS", alan: "sayisal", soruSayisi: 20, renk: "#f59e0b" },
  LGS_FEN: { kod: "LGS_FEN", ad: "LGS Fen Bilimleri", kisaAd: "Fen", sinav: "LGS", alan: "sayisal", soruSayisi: 20, renk: "#ef4444" },
  LGS_INK: { kod: "LGS_INK", ad: "T.C. İnkılap Tarihi ve Atatürkçülük", kisaAd: "İnkılap", sinav: "LGS", alan: "sozel", soruSayisi: 10, renk: "#10b981" },
  LGS_DIN: { kod: "LGS_DIN", ad: "Din Kültürü ve Ahlak Bilgisi", kisaAd: "Din", sinav: "LGS", alan: "sozel", soruSayisi: 10, renk: "#0ea5e9" },
  LGS_INS: { kod: "LGS_INS", ad: "İngilizce", kisaAd: "İngilizce", sinav: "LGS", alan: "dil", soruSayisi: 10, renk: "#f43f5e" },
};

export const DERS_LISTESI = Object.values(DERSLER);

export function derslerOf(sinav: SinavTuru): DersBilgisi[] {
  return DERS_LISTESI.filter((d) => d.sinav === sinav);
}

export function dersOf(kod: DersKodu): DersBilgisi {
  return DERSLER[kod];
}

/**
 * Net hesabı politikası.
 *  - YKS (TYT/AYT): 4 yanlış 1 doğruyu götürür.
 *  - LGS: MEB resmi olarak doğruyu götürmez ancak yayınevleri/karşılaştırma raporları
 *    pratikte 3 yanlış = 1 net götürür varsayımıyla net hesaplar. Panel varsayılanı
 *    karşılaştırılabilirlik için bu pratiktir; bölme değeri ayarlardan değiştirilebilir.
 */
export const NET_BOLEN: Record<SinavTuru, number> = { TYT: 4, AYT: 4, LGS: 3 };

export function netHesapla(dogru: number, yanlis: number, sinav: SinavTuru, bolen?: number): number {
  const b = bolen ?? NET_BOLEN[sinav];
  if (b <= 0) return dogru;
  return Math.round((dogru - yanlis / b) * 100) / 100;
}
