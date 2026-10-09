import type { HamKarne } from "./parse";
import type { OkulizyonAdapter, SenkronBaglami } from "./adapter";

/**
 * Gerçek Okulizyon istemcisi.
 *
 * ÖNEMLİ — dürüst durum tespiti:
 * Okulizyon'un kamuya açık, belgelenmiş bir REST API'si yoktur; platform mobil uygulama ve
 * okulizyon.com üzerindeki öğrenci girişi üstünden çalışır. Bu yüzden bu adaptör sabit bir
 * uç nokta varsaymaz: taban adres, giriş ucu ve karne ucu panelin "Bağlantı" ekranından
 * girilir ve cevap burada tolere eden bir okuyucuyla normalleştirilir.
 *
 * Kullanım sözleşmesi ve KVKK açısından: yalnızca kurumun/öğrencinin kendi hesabıyla,
 * kendi verisi için kullanılmalıdır. Şifre diske yazılmaz, yalnızca istek süresince bellekte kalır.
 */

const ZAMAN_ASIMI_MS = 15000;

async function zamanAsimli(url: string, init: RequestInit): Promise<Response> {
  const denetleyici = new AbortController();
  const zamanlayici = setTimeout(() => denetleyici.abort(), ZAMAN_ASIMI_MS);
  try {
    return await fetch(url, { ...init, signal: denetleyici.signal });
  } finally {
    clearTimeout(zamanlayici);
  }
}

function jetonAra(govde: unknown): string | null {
  if (!govde || typeof govde !== "object") return null;
  const o = govde as Record<string, unknown>;
  for (const k of ["token", "accessToken", "access_token", "jwt", "id_token", "Token"]) {
    const v = o[k];
    if (typeof v === "string" && v) return v;
  }
  if (o.data && typeof o.data === "object") return jetonAra(o.data);
  return null;
}

/** Cevap gövdesinden karne dizisini bulur — sarmalayıcı adı kuruma göre değişebiliyor. */
function karneDizisiBul(govde: unknown): HamKarne[] | null {
  if (Array.isArray(govde)) return govde as HamKarne[];
  if (!govde || typeof govde !== "object") return null;
  const o = govde as Record<string, unknown>;
  for (const k of ["karneler", "sonuclar", "sonuçlar", "sinavlar", "sınavlar", "data", "items", "list", "results"]) {
    const v = o[k];
    if (Array.isArray(v)) return v as HamKarne[];
  }
  // Tek karne nesnesi dönmüş olabilir.
  const tekil = o.sinavAdi ?? o.sinav_adi ?? o.bolumler ?? o.sorular;
  if (tekil !== undefined) return [o as unknown as HamKarne];
  for (const v of Object.values(o)) {
    const ic = karneDizisiBul(v);
    if (ic) return ic;
  }
  return null;
}

export const httpAdapter: OkulizyonAdapter = {
  ad: "http",
  async senkron(baglam: SenkronBaglami) {
    const { ayar, ogrenci, sifre } = baglam;
    if (!ayar.baseUrl) throw new Error("Bağlantı ayarlarında taban adres (base URL) boş.");
    if (!ayar.karneEndpoint) throw new Error("Karne uç noktası (karne endpoint) tanımlanmamış.");

    const taban = ayar.baseUrl.replace(/\/+$/, "");
    let jeton: string | null = null;
    let kurabiye: string | null = null;

    /* ── 1. Giriş ─────────────────────────────────────────────── */
    if (ayar.girisEndpoint) {
      const girisGovde = {
        ogrenciNo: ayar.ogrenciNo || ogrenci.okulizyonOgrenciNo,
        tcKimlikNo: ayar.tcKimlikNo,
        sifre: sifre ?? "",
        il: ayar.il,
        ilce: ayar.ilce,
        kurum: ayar.kurum,
        sinif: ogrenci.sinifSeviyesi,
      };
      const girisCevap = await zamanAsimli(`${taban}${ayar.girisEndpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(girisGovde),
      });
      if (!girisCevap.ok) {
        throw new Error(
          `Giriş isteği ${girisCevap.status} ${girisCevap.statusText} döndü. Öğrenci numarası, T.C. kimlik no ve şifreyi kontrol et; uç nokta adresinin doğru olduğundan emin ol.`,
        );
      }
      const setCookie = girisCevap.headers.get("set-cookie");
      if (setCookie) kurabiye = setCookie.split(",").map((c) => c.trim().split(";")[0]).join("; ");
      const govde = await girisCevap.json().catch(() => null);
      jeton = jetonAra(govde);
      if (!jeton && !kurabiye) {
        throw new Error(
          "Giriş başarılı görünüyor ama cevapta oturum jetonu bulunamadı. Okulizyon'un bu uç noktası farklı bir kimlik doğrulama yöntemi kullanıyor olabilir.",
        );
      }
    }

    /* ── 2. Karne çekimi ──────────────────────────────────────── */
    const sorgu = new URLSearchParams({
      ogrenciNo: ayar.ogrenciNo || ogrenci.okulizyonOgrenciNo || "",
      tcKimlikNo: ayar.tcKimlikNo || "",
      il: ayar.il || "",
      ilce: ayar.ilce || "",
      kurum: ayar.kurum || "",
      sinavTuru: baglam.sinavTuru,
    }).toString();
    const ayirac = ayar.karneEndpoint.includes("?") ? "&" : "?";
    const cevap = await zamanAsimli(`${taban}${ayar.karneEndpoint}${ayirac}${sorgu}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(jeton ? { Authorization: `Bearer ${jeton}` } : {}),
        ...(kurabiye ? { Cookie: kurabiye } : {}),
      },
    });

    if (!cevap.ok) {
      throw new Error(`Karne isteği ${cevap.status} ${cevap.statusText} döndü.`);
    }
    const govde = await cevap.json().catch(() => null);
    const karneler = karneDizisiBul(govde);
    if (!karneler || !karneler.length) {
      throw new Error(
        "Cevap alındı ama içinde karne bulunamadı. Alan adları Okulizyon'un bu uç noktasında farklı olabilir; ham cevabı 'Bağlantı' ekranındaki örnek çıktıyla karşılaştır.",
      );
    }

    return {
      karneler,
      mesaj: `Okulizyon'dan ${karneler.length} karne çekildi.`,
    };
  },
};
