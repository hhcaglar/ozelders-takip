import { baglantiAyari } from "@/lib/db";
import BaglantiFormu from "@/components/BaglantiFormu";
import { Kart, Rozet } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function BaglantiSayfasi() {
  const ayar = baglantiAyari();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Okulizyon Bağlantısı</h1>
        <p className="mt-1 text-sm text-solgun">
          Karne ve optik sonuçlarının nereden çekileceğini belirle. Kimlik bilgileri öğrenci bazlıdır; şifre bu
          panelde saklanmaz.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_420px]">
        <BaglantiFormu baslangic={ayar} />

        <div className="space-y-4">
          <Kart
            baslik="Dürüst durum tespiti"
            altBaslik="Bu panelin Okulizyon ile ilişkisi hakkında bilmen gerekenler"
          >
            <ul className="space-y-2 text-sm leading-relaxed text-solgun">
              <li>
                <Rozet ton="uyari">Belgelenmiş API yok</Rozet> Okulizyon'un kamuya açık, resmî bir REST API'si
                bulunmuyor; platform mobil uygulama ve okulizyon.com öğrenci girişi üstünden çalışıyor.
              </li>
              <li>
                <Rozet ton="bilgi">Uç nokta yapılandırılabilir</Rozet> Bu yüzden panel sabit bir adres varsaymaz.
                Taban adres, giriş ucu ve karne ucu buradan girilir; cevap alanları tolere eden bir okuyucuyla
                normalize edilir.
              </li>
              <li>
                <Rozet ton="notr">Demo mod</Rozet> Uç noktalar girilene kadar demo modda Okulizyon biçiminde
                örnek karne üretilir; böylece net → kazanım → yorum → program akışı gerçek kod yolundan test
                edilir.
              </li>
              <li>
                <Rozet ton="kritik">Yetki ve KVKK</Rozet> Yalnızca kendi/kurumunun hesabı ve kendi öğrencisinin
                verisi için kullan. Otomatik çekim yapmadan önce kurumun kullanım koşullarını kontrol et.
              </li>
            </ul>
          </Kart>

          <Kart baslik="Beklenen karne biçimi" altBaslik="Alan adları için alternatifler de kabul edilir.">
            <pre className="overflow-x-auto rounded-lg bg-zemin p-3 text-[11px] leading-relaxed text-murekkep/90">
{`[
  {
    "sinavAdi": "TYT Deneme 3",
    "tarih": "2026-09-20",
    "yayinevi": "Damla Yayınları",
    "puan": 412,
    "siralama": 48000,
    "sinifOrtalama": 78.4,
    "kurumOrtalama": 81.2,
    "bolumler": [
      { "ders": "Türkçe",     "dogru": 32, "yanlis": 5,  "bos": 3 },
      { "ders": "Matematik",  "dogru": 21, "yanlis": 11, "bos": 8 },
      { "ders": "Fen",        "dogru": 9,  "yanlis": 6,  "bos": 5 },
      { "ders": "Sosyal",     "dogru": 14, "yanlis": 4,  "bos": 2 }
    ],
    "sorular": [
      { "no": 1, "ders": "Türkçe",
        "kazanım": "Paragrafta Anlam / Ana düşünce",
        "durum": "D" }
    ]
  }
]`}
            </pre>
            <p className="mt-2 text-[11px] leading-relaxed text-solgun">
              Alan alternatifleri: <code>sinavAdi/sinav_adi/baslik</code>, <code>tarih/sinavTarihi/date</code>,{" "}
              <code>dogru/correct</code>, <code>yanlis/wrong</code>, <code>bos/empty/blank</code>,{" "}
              <code>kazanım/kazanim/konu/outcome</code>, <code>durum/cevap/answer</code>. Ders adı serbest
              metin olabilir (“Fen Bilimleri”, “Sosyal Bilimler”, “Matematik”…).
            </p>
          </Kart>
        </div>
      </div>
    </div>
  );
}
