/**
 * Paneli örnek veriyle doldurur.
 *
 *   npm run seed
 *
 * Okulizyon bağlantısı kurulmadan paneli denemek için iki öğrenci (biri TYT, biri LGS)
 * oluşturur, demo karneleri normalleştirip kaydeder ve çalışma programlarını üretir.
 * Zaten veri varsa hiçbir şeyi silmez; yalnızca eksik öğrencileri ekler.
 */
import {
  baglantiKaydet,
  ogrenciEkle,
  ogrenciler,
  programKaydet,
  sinavKaydet,
  sinavlar,
} from "../lib/db";
import { demoKarnelerUret } from "../lib/okulizyon/demo";
import { karneListesiHazirla } from "../lib/okulizyon/import";
import { calismaProgramiUret } from "../lib/plan";
import { topluKazanimDurumu } from "../lib/analysis";
import { bugunIso, gunEkle } from "../lib/tarih";
import type { Ogrenci } from "../lib/types";

const ORNEKLER: (Partial<Ogrenci> & { ad: string; sinavTuru: "TYT" | "LGS" })[] = [
  {
    ad: "Elif Yılmaz",
    sinavTuru: "TYT",
    sinifSeviyesi: "12",
    okul: "Örnek Anadolu Lisesi",
    okulizyonOgrenciNo: "998877",
    hedefPuan: 450,
    hedefSiralama: 40000,
    haftalikSaat: 14,
    blokDakika: 50,
    calismaGunleri: [1, 2, 3, 4, 5, 6],
  },
  {
    ad: "Mert Kaya",
    sinavTuru: "LGS",
    sinifSeviyesi: "8",
    okul: "Örnek Ortaokulu",
    okulizyonOgrenciNo: "112233",
    hedefPuan: 480,
    haftalikSaat: 10,
    blokDakika: 40,
    calismaGunleri: [1, 2, 3, 4, 5],
  },
];

function main() {
  baglantiKaydet({ aktif: true, mod: "demo" });
  const mevcut = ogrenciler();

  for (const ornek of ORNEKLER) {
    if (mevcut.some((o) => o.ad === ornek.ad)) {
      console.log(`· ${ornek.ad} zaten kayıtlı, atlanıyor`);
      continue;
    }
    const o = ogrenciEkle(ornek);
    const ham = demoKarnelerUret(ornek.sinavTuru, o.id, 4);
    const eklenen = sinavKaydet(karneListesiHazirla(ham, ornek.sinavTuru, o.id, "seed"));
    const program = calismaProgramiUret(
      ogrenciler().find((x) => x.id === o.id)!,
      topluKazanimDurumu(sinavlar(o.id)),
      ornek.sinavTuru,
      { baslangicTarihi: gunEkle(bugunIso(), 1), haftaSayisi: 3 },
    );
    programKaydet(program);
    console.log(
      `✓ ${o.ad} (${ornek.sinavTuru}) — ${eklenen.eklenen} sınav, ${program.bloklar.length} bloklu program`,
    );
  }
  console.log("\nHazır. `npm run dev` ile paneli aç.");
}

main();
