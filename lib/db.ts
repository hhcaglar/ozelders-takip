import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { BaglantiAyari, CalismaProgrami, Ogrenci, Sinav, VeriTabani } from "./types";

/**
 * Veri dizini tembel okunur: böylece testler process.env.DATA_DIR'ı içe aktarmadan önce
 * değil, istedikleri an değiştirebilir ve üretim kodu aynı yolu kullanmaya devam eder.
 */
function veriDizini(): string {
  return process.env.DATA_DIR ?? path.join(process.cwd(), "data");
}
function dbDosya(): string {
  return path.join(veriDizini(), "panel.json");
}
function programDizini(): string {
  return path.join(veriDizini(), "programlar");
}

/**
 * Doğrulanmış değerler dolu, doğrulanmamış olanlar bilerek BOŞ bırakıldı.
 *
 * Doğrulananlar (okulizyon.com erişilerek):
 *   - baseUrl        https://okulizyon.com
 *   - girisSayfasi   /app2/ogrgiris  (öğrenci girişi; öğretmen girişi /app2/giris)
 *   - girisTipi      form üç kimlik sekmesi sunuyor: Öğrenci No / T.C. Kimlik No / Telefon
 *   - alanlar        sınıf, il, ilçe, kurum, şifre
 *   - kurumKodu      giriş adresinde ?kk=… parametresi gözlemlendi
 *
 * Bilinmeyenler (bilerek boş): girisEndpoint ve karneEndpoint. Okulizyon'un belgelenmiş
 * bir API'si yok ve uç nokta adları yalnızca tarayıcının ağ sekmesinden okunabiliyor.
 * Buraya uydurma "/api/giris" gibi bir yol yazmak, kullanıcıya doğrulanmamış bir bilgiyi
 * doğrulanmış gibi sunmak olurdu; o yüzden boş ve arayüzde nasıl bulunacağı anlatılıyor.
 */
export const VARSAYILAN_BAGLANTI: BaglantiAyari = {
  aktif: false,
  baseUrl: "https://okulizyon.com",
  girisSayfasi: "/app2/ogrgiris",
  girisEndpoint: "",
  karneEndpoint: "",
  girisTipi: "ogrenciNo",
  ogrenciNo: "",
  tcKimlikNo: "",
  telefon: "",
  kurumKodu: "",
  il: "",
  ilce: "",
  kurum: "",
  mod: "demo",
};

function bosDb(): VeriTabani {
  return { ogrenciler: [], sinavlar: [], baglanti: { ...VARSAYILAN_BAGLANTI } };
}

function oku(): VeriTabani {
  try {
    if (!existsSync(dbDosya())) return bosDb();
    const ham = JSON.parse(readFileSync(dbDosya(), "utf8")) as VeriTabani;
    return {
      ogrenciler: ham.ogrenciler ?? [],
      sinavlar: ham.sinavlar ?? [],
      baglanti: { ...VARSAYILAN_BAGLANTI, ...(ham.baglanti ?? {}) },
    };
  } catch {
    return bosDb();
  }
}

/** Atomik yazım: yarıda kesilirse mevcut dosya bozulmaz. */
function yaz(db: VeriTabani): void {
  mkdirSync(veriDizini(), { recursive: true });
  const gecici = `${dbDosya()}.${process.pid}.tmp`;
  writeFileSync(gecici, JSON.stringify(db, null, 2), "utf8");
  renameSync(gecici, dbDosya());
}

/* ─────────────────────────── Öğrenciler ─────────────────────────── */

export function ogrenciler(): Ogrenci[] {
  return oku().ogrenciler;
}

export function ogrenciBul(id: string): Ogrenci | undefined {
  return oku().ogrenciler.find((o) => o.id === id);
}

export function ogrenciEkle(veri: Partial<Ogrenci> & { ad: string }): Ogrenci {
  const db = oku();
  const simdi = new Date().toISOString();
  const o: Ogrenci = {
    id: randomUUID(),
    ad: veri.ad,
    sinifSeviyesi: veri.sinifSeviyesi ?? "12",
    sinavTuru: veri.sinavTuru ?? "TYT",
    okul: veri.okul,
    okulizyonOgrenciNo: veri.okulizyonOgrenciNo,
    hedefPuan: veri.hedefPuan,
    hedefSiralama: veri.hedefSiralama,
    haftalikSaat: veri.haftalikSaat ?? 12,
    calismaGunleri: veri.calismaGunleri?.length ? veri.calismaGunleri : [1, 2, 3, 4, 5, 6],
    blokDakika: veri.blokDakika ?? 50,
    olusturulma: simdi,
    guncelleme: simdi,
  };
  db.ogrenciler.push(o);
  yaz(db);
  return o;
}

export function ogrenciGuncelle(id: string, degisiklik: Partial<Ogrenci>): Ogrenci | undefined {
  const db = oku();
  const i = db.ogrenciler.findIndex((o) => o.id === id);
  if (i < 0) return undefined;
  db.ogrenciler[i] = { ...db.ogrenciler[i], ...degisiklik, id, guncelleme: new Date().toISOString() };
  yaz(db);
  return db.ogrenciler[i];
}

export function ogrenciSil(id: string): boolean {
  const db = oku();
  const once = db.ogrenciler.length;
  db.ogrenciler = db.ogrenciler.filter((o) => o.id !== id);
  db.sinavlar = db.sinavlar.filter((s) => s.ogrenciId !== id);
  yaz(db);
  return db.ogrenciler.length < once;
}

/* ─────────────────────────── Sınavlar ─────────────────────────── */

export function sinavlar(ogrenciId: string): Sinav[] {
  return oku().sinavlar.filter((s) => s.ogrenciId === ogrenciId);
}

/**
 * Sınav ekler; aynı kaynak referansı + başlık + tarih kombinasyonu zaten varsa
 * günceller (senkronun tekrar tekrar yinelenmesi kayıt şişirmesin).
 */
export function sinavKaydet(liste: Sinav[]): { eklenen: number; guncellenen: number } {
  const db = oku();
  let eklenen = 0;
  let guncellenen = 0;
  for (const s of liste) {
    const anahtar = `${s.kaynakRef ?? ""}|${s.baslik}|${s.tarih}`;
    const mevcut = db.sinavlar.find(
      (x) =>
        x.ogrenciId === s.ogrenciId &&
        x.baslik === s.baslik &&
        x.tarih === s.tarih &&
        (x.kaynakRef ?? "") === (s.kaynakRef ?? ""),
    );
    if (mevcut) {
      Object.assign(mevcut, s, { id: mevcut.id });
      guncellenen += 1;
    } else {
      db.sinavlar.push({ ...s, id: s.id || randomUUID() });
      eklenen += 1;
    }
    void anahtar;
  }
  yaz(db);
  return { eklenen, guncellenen };
}

export function sinavSil(id: string): boolean {
  const db = oku();
  const once = db.sinavlar.length;
  db.sinavlar = db.sinavlar.filter((s) => s.id !== id);
  yaz(db);
  return db.sinavlar.length < once;
}

/* ─────────────────────────── Bağlantı ayarları ─────────────────────────── */

export function baglantiAyari(): BaglantiAyari {
  return oku().baglanti;
}

export function baglantiKaydet(degisiklik: Partial<BaglantiAyari>): BaglantiAyari {
  const db = oku();
  db.baglanti = { ...db.baglanti, ...degisiklik };
  yaz(db);
  return db.baglanti;
}

/* ─────────────────────────── Çalışma programları ─────────────────────────── */

export function programKaydet(program: CalismaProgrami): void {
  mkdirSync(programDizini(), { recursive: true });
  writeFileSync(
    path.join(programDizini(), `${program.ogrenciId}.json`),
    JSON.stringify(program, null, 2),
    "utf8",
  );
}

export function programOku(ogrenciId: string): CalismaProgrami | null {
  const dosya = path.join(programDizini(), `${ogrenciId}.json`);
  if (!existsSync(dosya)) return null;
  try {
    return JSON.parse(readFileSync(dosya, "utf8")) as CalismaProgrami;
  } catch {
    return null;
  }
}

export function programSil(ogrenciId: string): void {
  const dosya = path.join(programDizini(), `${ogrenciId}.json`);
  if (existsSync(dosya)) writeFileSync(dosya, "", "utf8");
}

export function veriYolu() {
  return { dizin: veriDizini(), dosya: dbDosya(), programlar: programDizini() };
}
