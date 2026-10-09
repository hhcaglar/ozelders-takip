import { z } from "zod";

/**
 * Öğrenci kaydı için doğrulama şeması.
 *
 * POST ve PATCH aynı şemayı paylaşır; PATCH'te `.partial()` ile tüm alanlar
 * isteğe bağlı olur. Ayrı tutulursa güncelleme yolu doğrulamasız kalır ve
 * geçersiz `sinavTuru` / `aytAlani` / `blokDakika` doğrudan kalıcılaşıp analiz,
 * program ve rapor hesaplarını bozar.
 *
 * Route dosyasından export edilemez: Next.js route modüllerinde yalnızca HTTP
 * methodları ve belirli yapılandırma alanları dışa açılabilir.
 */
export const OGRENCI_SEMASI = z.object({
  ad: z.string().min(2, "Ad en az 2 karakter olmalı"),
  sinifSeviyesi: z.string().optional(),
  sinavTuru: z.enum(["TYT", "AYT", "LGS"]),
  /** AYT alanı. Yalnızca AYT için anlamlı; verilmezse Sayısal kabul edilir. */
  aytAlani: z.enum(["SAY", "EA", "SOZ"]).optional(),
  okul: z.string().optional(),
  okulizyonOgrenciNo: z.string().optional(),
  hedefPuan: z.number().min(0).max(600).optional(),
  hedefSiralama: z.number().int().positive().optional(),
  haftalikSaat: z.number().min(1).max(80),
  calismaGunleri: z.array(z.number().int().min(0).max(6)).min(1),
  blokDakika: z.number().int().min(20).max(120),
});
