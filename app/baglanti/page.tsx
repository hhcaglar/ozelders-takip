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
            baslik="Doğrulananlar ve bilinmeyenler"
            altBaslik="Bu panelin Okulizyon hakkında gerçekten bildiği ve bilmediği şeyler"
          >
            <p className="mb-2 text-xs font-semibold text-emerald-700">Doğrulandı (okulizyon.com erişilerek)</p>
            <ul className="mb-3 space-y-1.5 text-sm leading-relaxed text-solgun">
              <li>
                <Rozet ton="olumlu">adres</Rozet> Öğrenci girişi{" "}
                <a className="underline" href="https://okulizyon.com/app2/ogrgiris" target="_blank" rel="noreferrer">
                  okulizyon.com/app2/ogrgiris
                </a>
                , öğretmen girişi <code>/app2/giris</code>. Ana site <code>/app/index.php</code>.
              </li>
              <li>
                <Rozet ton="olumlu">kimlik</Rozet> Giriş formu üç sekme sunuyor: <strong>Öğrenci No</strong>,{" "}
                <strong>T.C. Kimlik No</strong>, <strong>Telefon</strong> — panel bu üçünü destekliyor.
              </li>
              <li>
                <Rozet ton="olumlu">alanlar</Rozet> Sınıf, il, ilçe, kurum ve şifre alanları formda var; istek
                gövdesi bu alanlarla kuruluyor.
              </li>
              <li>
                <Rozet ton="olumlu">kurum kodu</Rozet> Giriş adresinde <code>?kk=…</code> biçiminde bir kurum kodu
                parametresi gözlemlendi; isteğe sorgu olarak ekleniyor.
              </li>
              <li>
                <Rozet ton="olumlu">alternatif</Rozet> Bazı kurumlar <code>okulizyon.karnemiz.com/&lt;eğitim-yılı&gt;/ogrenci/</code>{" "}
                üstünden çalışıyor (OrbimSoft). Taban adresi buna göre değiştirebilirsin.
              </li>
            </ul>

            <p className="mb-2 text-xs font-semibold text-rose-700">Bilinmiyor (uydurulmadı, boş bırakıldı)</p>
            <ul className="mb-3 space-y-1.5 text-sm leading-relaxed text-solgun">
              <li>
                <Rozet ton="kritik">uç noktalar</Rozet> Giriş ve karne isteklerinin gittiği yollar. Okulizyon'un
                belgelenmiş bir API'si yok; bu adresler yalnızca oturum açmış bir tarayıcının ağ sekmesinden
                okunabiliyor. Bu yüzden varsayılanları boş ve istek atılmıyor.
              </li>
              <li>
                <Rozet ton="kritik">cevap şeması</Rozet> Karne cevabının alan adları kuruma göre değişebiliyor.
                Aşağıdaki örnek şema benim normalize edebildiğim biçim; gerçek cevabı ağ sekmesinden kopyalayıp
                karşılaştırman gerekiyor. Normalize edici alan adı alternatiflerini tolere ediyor.
              </li>
              <li>
                <Rozet ton="kritik">optik dosya biçimi</Rozet> Okulizyon sonuç dosyalarını <code>.TXT</code> veya{" "}
                <code>.DAT</code> olarak veriyor; sütun düzeni belgelenmemiş. Bu biçim henüz desteklenmiyor —{" "}
                aşağıdaki iki CSV şemasından birine dönüştürüp içe aktar.
              </li>
            </ul>

            <p className="rounded-lg bg-zemin px-3 py-2 text-xs leading-relaxed text-solgun">
              <Rozet ton="uyari">yetki ve KVKK</Rozet> Yalnızca kendi/kurumunun hesabı ve kendi öğrencisinin
              verisi için kullan. Otomatik çekimden önce kurumun kullanım koşullarını kontrol et. Şifre diske
              yazılmaz; yalnızca istek süresince bellekte kalır.
            </p>
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
