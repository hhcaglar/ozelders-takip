import type { DersKodu, Kazanim } from "../types";

/**
 * MEB müfredat kazanımlarından derlenmiş katalog.
 *
 * Her satır: [kazanım ifadesi, ağırlık(1-3), zorluk]
 *  - ağırlık: müfredattaki merkezîlik + sınavda çıkma sıklığı. Öncelik skorunda çarpan.
 *  - zorluk:  çalışma programındaki blok süresi tahminini etkiler.
 *
 * Katalog genişletmeye açıktır: aynı yapıda satır eklemek analiz, yorum ve program
 * modüllerinin hepsine otomatik yansır.
 */
type Satir = [ad: string, agirlik: number, zorluk?: "kolay" | "orta" | "zor"];

const B: Kazanim["zorluk"] = "kolay";
const O: Kazanim["zorluk"] = "orta";
const Z: Kazanim["zorluk"] = "zor";

type Unite = [uniteAdi: string, satirlar: Satir[]];

const KATALOG: Record<DersKodu, Unite[]> = {
  /* ─────────────────────────────  TYT  ───────────────────────────── */
  TYT_TUR: [
    [
      "Sözcükte Anlam",
      [
        ["Sözcüğün gerçek, yan ve mecaz anlamlarını bağlam içinde ayırt eder", 3, O],
        ["Deyim ve atasözlerinin cümleye kattığı anlamı açıklar", 2, B],
        ["Sözcükler arası anlam ilişkilerini (eş, zıt, yakın) belirler", 2, B],
        ["Sözcüğün cümle içinde kazandığı anlamı yorumlar", 3, O],
      ],
    ],
    [
      "Cümlede Anlam",
      [
        ["Cümleden çıkarılabilecek yargıyı belirler", 3, O],
        ["Anlamca çelişen / örtüşen cümleleri ayırt eder", 2, O],
        ["Düşüncenin akışını bozan cümleyi bulur", 2, O],
        ["Boş bırakılan yere getirilebilecek ifadeyi belirler (cümle tamamlama)", 2, O],
        ["Cümleleri anlam bütünlüğüne göre sıralar", 2, Z],
        ["Yakın anlamlı cümleleri gruplar", 2, O],
      ],
    ],
    [
      "Paragrafta Anlam",
      [
        ["Paragrafın ana düşüncesini belirler", 3, O],
        ["Paragrafın konusunu ve başlığını belirler", 3, B],
        ["Paragraftan çıkarılabilecek / çıkarılamayacak yargıyı ayırt eder", 3, O],
        ["Paragrafı iki paragrafa ayırma / tamamlama becerisi gösterir", 3, Z],
        ["Anlatım biçimlerini (öyküleyici, betimleyici, açıklayıcı, tartışmacı) ayırt eder", 2, O],
        ["Düşünceyi geliştirme yollarını (örnekleme, tanık gösterme, karşılaştırma) belirler", 2, O],
        ["Paragrafta anlatıcının tutum ve bakış açısını çözümler", 2, Z],
        ["Uzun metinlerde bilgiyi tarayarak hızlı sonuca ulaşır", 3, O],
      ],
    ],
    [
      "Yazım ve Noktalama",
      [
        ["Büyük harf, bitişik/ayrı yazım kurallarını uygular", 2, B],
        ["Noktalama işaretlerinin işlevlerini uygular", 2, B],
        ["Sayı, kısaltma ve alıntı yazımında kurala uyar", 1, B],
      ],
    ],
    [
      "Dil Bilgisi",
      [
        ["İsim, sıfat, zamir, zarf türlerini ayırt eder", 2, B],
        ["Edat, bağlaç ve ünlemlerin cümledeki işlevini belirler", 2, O],
        ["Fiilimsileri (isim-fiil, sıfat-fiil, zarf-fiil) bulur ve türünü belirler", 2, O],
        ["Cümlenin ögelerini (özne, yüklem, nesne, dolaylı tümleç, zarf tümleci) bulur", 2, O],
        ["Cümle türlerini (yapı ve anlam bakımından) sınıflar", 1, O],
        ["Anlatım bozukluğunu tespit eder ve gerekçelendirir", 2, Z],
      ],
    ],
  ],
  TYT_MAT: [
    [
      "Temel Kavramlar ve Sayılar",
      [
        ["Sayı kümelerini ayırt eder ve temel işlem özelliklerini uygular", 3, B],
        ["Sayı basamakları ve çözümleme işlemlerini yapar", 2, O],
        ["Bölme-bölünebilme kurallarını uygular", 2, O],
        ["Asal çarpanlara ayırma yapar", 2, O],
        ["EBOB-EKOK problemlerini çözer", 2, Z],
        ["Rasyonel sayılarda dört işlem yapar", 3, B],
        ["Üslü sayılarda işlem yapar", 3, O],
        ["Köklü sayılarda işlem yapar", 2, O],
        ["Çarpanlara ayırma özdeşliklerini uygular", 3, O],
      ],
    ],
    [
      "Denklem ve Orantı",
      [
        ["Birinci dereceden denklemleri çözer", 3, B],
        ["Oran-orantı problemlerini çözer", 3, O],
        ["İkinci dereceden denklemlerin köklerini bulur", 2, Z],
      ],
    ],
    [
      "Kümeler ve Fonksiyonlar",
      [
        ["Küme işlemlerini yapar ve Venn şeması ile modeller", 2, B],
        ["Kartezyen çarpım ve bağıntı kavramlarını uygular", 1, O],
        ["Fonksiyon kavramını tanır, tanım-görüntü kümesini bulur", 2, O],
        ["Bileşke ve ters fonksiyon işlemlerini yapar", 2, Z],
      ],
    ],
    [
      "Problemler",
      [
        ["Sayı ve kesir problemlerini çözer", 3, O],
        ["Yaş problemlerini çözer", 2, O],
        ["İşçi ve havuz problemlerini çözer", 2, Z],
        ["Hareket (hız-zaman-yol) problemlerini çözer", 3, Z],
        ["Yüzde, kâr-zarar ve faiz problemlerini çözer", 3, O],
        ["Karışım problemlerini çözer", 2, Z],
        ["Rutin olmayan problem çözme stratejileri geliştirir", 3, Z],
      ],
    ],
    [
      "Olasılık ve Veri",
      [
        ["Permütasyon ve kombinasyon hesaplar", 2, O],
        ["Basit ve bileşik olasılık hesaplar", 2, Z],
        ["Veri okur; ortalama, medyan, mod yorumlar", 1, B],
        ["Mantık önermelerinde doğruluk değeri ve denklik bulur", 1, O],
      ],
    ],
  ],
  TYT_FEN: [
    [
      "Fizik",
      [
        ["Fizik biliminin alt alanlarını ve büyüklükleri sınıflar", 1, B],
        ["Madde ve özelliklerini (özkütle, adezyon-kohezyon) açıklar", 2, O],
        ["Isı, sıcaklık ve hal değişimi hesaplamalarını yapar", 3, O],
        ["Hareket ve kuvvet kavramlarını Newton yasalarıyla açıklar", 3, Z],
        ["İş, güç ve enerji dönüşümlerini hesaplar", 2, O],
        ["Elektrostatik ve elektrik yüklerini açıklar", 2, O],
        ["Elektrik devrelerinde akım, gerilim, direnç hesaplar", 3, Z],
        ["Manyetizma ve manyetik alan kavramlarını uygular", 1, O],
        ["Dalgaların ortak özelliklerini ve ses-su dalgalarını açıklar", 2, O],
        ["Optik: yansıma, kırılma ve merceklerde görüntü oluşumunu açıklar", 2, Z],
      ],
    ],
    [
      "Kimya",
      [
        ["Kimyanın alt disiplinlerini ve laboratuvar güvenliğini açıklar", 1, B],
        ["Atom modellerini ve atomun yapısını açıklar", 2, O],
        ["Periyodik sistemde yer bulur, özellikleri yorumlar", 3, O],
        ["Kimyasal türler arası etkileşimleri (iyonik, kovalent, metalik) ayırt eder", 2, O],
        ["Maddenin halleri ve gaz yasalarını uygular", 2, Z],
        ["Asit, baz ve tuzların özelliklerini ayırt eder", 2, B],
        ["Kimyasal tepkimeleri denkleştirir, kütle hesaplar", 3, Z],
        ["Karışımları ayırma yöntemlerini uygular", 1, B],
      ],
    ],
    [
      "Biyoloji",
      [
        ["Canlıların ortak özelliklerini sıralar", 1, B],
        ["Hücre yapısını ve organellerin görevlerini açıklar", 3, O],
        ["Hücre zarından madde geçişlerini (difüzyon, osmoz, aktif taşıma) ayırt eder", 3, Z],
        ["Canlıların sınıflandırılmasında âlem ve özellikleri eşleştirir", 2, O],
        ["Enzimlerin yapısını ve çalışmasını etkileyen etmenleri açıklar", 2, O],
        ["Hücre bölünmelerini (mitoz-mayoz) karşılaştırır", 2, O],
        ["Kalıtımın genel ilkelerini uygular", 1, Z],
        ["Ekosistem ve güncel çevre sorunlarını değerlendirir", 1, B],
      ],
    ],
  ],
  TYT_SOS: [
    [
      "Tarih",
      [
        ["Tarih biliminin yöntemini ve dönemlendirmeyi açıklar", 1, B],
        ["İlk ve Orta Çağ uygarlıklarını karşılaştırır", 2, O],
        ["İslam medeniyetinin bilim ve kültür katkılarını açıklar", 2, O],
        ["Türklerin İslamiyet öncesi ve sonrası siyasi tarihini ilişkilendirir", 2, O],
        ["Osmanlı kuruluş-yükselme dönemini yorumlar", 2, O],
        ["Osmanlı'da yenileşme ve dağılma sürecini analiz eder", 2, O],
        ["Millî Mücadele ve Cumhuriyet'in ilanını değerlendirir", 3, O],
      ],
    ],
    [
      "Coğrafya",
      [
        ["Doğa ve insan etkileşimini coğrafyanın bölümleriyle ilişkilendirir", 1, B],
        ["Harita bilgisini ve izohips yorumunu uygular", 2, O],
        ["Dünya'nın şekli, hareketleri ve koordinat sistemini açıklar", 2, O],
        ["Atmosfer, iklim elemanları ve iklim tiplerini yorumlar", 3, Z],
        ["Yeryüzü şekillerinin oluşumunu iç-dış kuvvetlerle açıklar", 2, O],
        ["Nüfusun özelliklerini ve dağılışını yorumlar", 2, B],
        ["Bölgeler ve doğal afetler arasındaki ilişkiyi kurar", 2, O],
      ],
    ],
    [
      "Felsefe ve Din",
      [
        ["Felsefenin anlamını ve filozofun özelliklerini açıklar", 2, B],
        ["Felsefi metin çözümler ve kavramları ilişkilendirir", 3, O],
        ["Bilgi felsefesi görüşlerini karşılaştırır", 2, Z],
        ["Varlık felsefesi yaklaşımlarını ayırt eder", 2, Z],
        ["Ahlak felsefesi kuramlarını değerlendirir", 2, Z],
        ["Din ve toplum, İslam'ın temel kaynakları hakkında bilgi edinir", 1, B],
      ],
    ],
  ],

  /* ─────────────────────────────  AYT  ───────────────────────────── */
  AYT_MAT: [
    [
      "Temel Kavramlar ve Cebir",
      [
        ["Sayı kümeleri ve mutlak değer işlemlerini uygular", 2, O],
        ["Üslü ve köklü ifadelerde ileri düzey işlemler yapar", 2, O],
        ["Çarpanlara ayırma özdeşliklerini karmaşık ifadelerde kullanır", 2, Z],
        ["Mantık: önermeler, niceleyiciler ve ispat yöntemleri", 2, O],
        ["Karmaşık sayılarda dört işlem ve eşlenik işlemlerini yapar", 1, O],
      ],
    ],
    [
      "Fonksiyonlar",
      [
        ["Fonksiyonlarda dört işlem ve bileşke uygular", 2, O],
        ["Ters fonksiyon bulur ve grafik yorumlar", 2, Z],
        ["Polinomlarda bölme ve kök-bağıntı kurallarını uygular", 2, Z],
        ["İkinci dereceden denklemler ve eşitsizlikleri çözer", 2, Z],
      ],
    ],
    [
      "Trigonometri",
      [
        ["Yönlü açılar ve birim çemberi kullanır", 3, O],
        ["Trigonometrik oranları ve özdeşlikleri uygular", 3, Z],
        ["Toplam-fark ve iki kat açı formüllerini kullanır", 3, Z],
        ["Trigonometrik denklemleri çözer", 2, Z],
      ],
    ],
    [
      "Diziler, Logaritma ve Seriler",
      [
        ["Aritmetik ve geometrik dizilerin genel terimini bulur", 2, O],
        ["Dizilerin toplamını hesaplar", 2, Z],
        ["Logaritma fonksiyonunun özelliklerini uygular", 3, O],
        ["Logaritmik denklem ve eşitsizlikleri çözer", 2, Z],
      ],
    ],
    [
      "Analiz",
      [
        ["Fonksiyonlarda limit hesaplar ve sürekliliği yorumlar", 2, Z],
        ["Türev kurallarını uygular ve teğet denklemi yazar", 3, Z],
        ["Türev ile maksimum-minimum ve grafik çizimi yapar", 3, Z],
        ["Belirsiz integral ve integral alma tekniklerini uygular", 3, Z],
        ["Belirli integral ile alan hesabı yapar", 2, Z],
      ],
    ],
    [
      "Olasılık ve Geometri",
      [
        ["Permütasyon, kombinasyon ve binom açılımını uygular", 2, O],
        ["Koşullu olasılık ve deneysel olasılık hesaplar", 2, Z],
        ["Analitik düzlemde doğru ve çember denklemlerini yazar", 2, O],
        ["Vektörlerde işlemler yapar", 1, O],
      ],
    ],
  ],
  AYT_FIZ: [
    [
      "Mekanik",
      [
        ["Vektörleri bileşenlerine ayırır ve toplar", 2, O],
        ["Bağıl hız problemlerini çözer", 2, Z],
        ["Newton'un hareket yasalarını uygular", 3, Z],
        ["Enerji ve momentumun korunumunu kullanır", 3, Z],
        ["Tork ve denge koşullarını uygular", 2, Z],
        ["Kütle merkezi hesaplaması yapar", 2, Z],
        ["Basit makinelerde kuvvet kazancını hesaplar", 2, O],
      ],
    ],
    [
      "Elektrik ve Manyetizma",
      [
        ["Elektriksel kuvvet ve alan hesaplar", 2, Z],
        ["Kondansatörlerin bağlı olduğu devreleri çözümler", 2, Z],
        ["Doğru akım devrelerinde Kirchhoff yasalarını uygular", 2, Z],
        ["Manyetik alan ve manyetik kuvveti yorumlar", 2, Z],
        ["Alternatif akım ve transformatörleri açıklar", 1, Z],
      ],
    ],
    [
      "Modern Fizik ve Dalgalar",
      [
        ["Dairesel ve basit harmonik hareketi açıklar", 2, Z],
        ["Dalgaların özelliklerini ve girişimi yorumlar", 2, Z],
        ["Fotoelektrik olay ve Compton saçılmasını açıklar", 2, Z],
        ["Özel görelilik ve kütle-enerji ilişkisini uygular", 1, Z],
        ["Atom modellerini ve radyoaktiviteyi karşılaştırır", 2, O],
      ],
    ],
  ],
  AYT_KIM: [
    [
      "Atom ve Periyodik Sistem",
      [
        ["Atomun kuantum modelini ve elektron dizilimini uygular", 2, O],
        ["Periyodik özelliklerdeki değişimi yorumlar", 2, O],
      ],
    ],
    [
      "Kimyasal Hesaplamalar",
      [
        ["Mol kavramı ve mol hesaplamalarını yapar", 3, Z],
        ["Kimyasal tepkimelerde stokiometri problemlerini çözer", 3, Z],
        ["Gazlarda kinetik teori ve gaz yasalarını uygular", 2, Z],
      ],
    ],
    [
      "Çözeltiler ve Denge",
      [
        ["Çözünürlük ve derişim hesaplamalarını yapar", 3, Z],
        ["Koligatif özellikleri yorumlar", 2, Z],
        ["Kimyasal denge ve dengeye etki eden faktörleri uygular", 3, Z],
        ["Asit-baz dengesi ve pH hesaplaması yapar", 3, Z],
        ["Çözünürlük çarpanı hesaplaması yapar", 2, Z],
      ],
    ],
    [
      "Organik ve Elektrokimya",
      [
        ["Elektrokimyasal hücreler ve pil potansiyeli hesaplar", 2, Z],
        ["Organik bileşiklerin fonksiyonel gruplarını tanır", 3, O],
        ["Hidrokarbonları adlandırır ve sınıflar", 3, O],
        ["Tepkime hızını ve hızı etkileyen faktörleri yorumlar", 2, O],
      ],
    ],
  ],
  AYT_BIY: [
    [
      "Hücre ve Metabolizma",
      [
        ["Hücre organellerini ve görevlerini ilişkilendirir", 2, O],
        ["Enzimler ve metabolik tepkimeleri açıklar", 2, O],
        ["Hücre solunumunu (glikoliz, Krebs, ETS) açıklar", 3, Z],
        ["Fotosentez evrelerini ve etkenlerini açıklar", 3, Z],
      ],
    ],
    [
      "Kalıtım",
      [
        ["Mendel ilkelerini ve çaprazlama problemlerini uygular", 3, Z],
        ["Eşeye bağlı kalıtımı yorumlar", 2, Z],
        ["DNA replikasyonu, transkripsiyon ve translasyonu açıklar", 3, Z],
        ["Biyoteknoloji ve genetik mühendisliği uygulamalarını değerlendirir", 1, O],
      ],
    ],
    [
      "Sistemler ve Ekoloji",
      [
        ["Destek ve hareket sistemini açıklar", 1, O],
        ["Sindirim ve dolaşım sistemini ilişkilendirir", 2, O],
        ["Sinir sisteminde iletimi ve duyu organlarını açıklar", 2, Z],
        ["Endokrin sistem ve hormonları eşleştirir", 2, O],
        ["Bağışıklık sistemini açıklar", 2, O],
        ["Bitki biyolojisi: yapı, taşıma ve üreme", 2, Z],
        ["Komünite ve popülasyon ekolojisini yorumlar", 2, O],
      ],
    ],
  ],
  AYT_EDB: [
    [
      "Edebiyat Bilgisi",
      [
        ["Güzel sanatlar içinde edebiyatın yerini açıklar", 1, B],
        ["Şiir bilgisini (ölçü, kafiye, nazım biçimi) uygular", 3, O],
        ["Söz sanatlarını (teşbih, istiare, kinaye, tezat) ayırt eder", 2, O],
        ["Metin türlerini (roman, hikâye, tiyatro, deneme) tanır", 2, B],
        ["Anlatım tekniklerini ve bakış açılarını belirler", 2, O],
      ],
    ],
    [
      "Türk Edebiyatı Dönemleri",
      [
        ["İslamiyet öncesi Türk edebiyatını tanır", 2, O],
        ["Halk edebiyatı (âşık, tekke, anonim) ürünlerini eşleştirir", 3, O],
        ["Divan edebiyatı şair, eser ve nazım biçimlerini eşleştirir", 3, Z],
        ["Tanzimat ve ara nesil sanatçılarını ayırt eder", 2, O],
        ["Servet-i Fünun ve Fecriati dönemi eserlerini eşleştirir", 2, Z],
        ["Millî Edebiyat dönemi sanatçılarını tanır", 2, O],
        ["Cumhuriyet dönemi şiir akımlarını ayırt eder", 3, Z],
        ["Cumhuriyet dönemi roman ve hikâyecilerini eşleştirir", 3, Z],
      ],
    ],
  ],
  AYT_TAR: [
    [
      "Genel Türk Tarihi",
      [
        ["Türklerin ana yurdu ve göçlerini açıklar", 1, O],
        ["İslamiyet öncesi Türk devletlerini tanır", 2, O],
        ["Türk-İslam devletlerini karşılaştırır", 2, O],
      ],
    ],
    [
      "Osmanlı Tarihi",
      [
        ["Osmanlı devlet teşkilatını açıklar", 2, O],
        ["Osmanlı'da ekonomi, toprak ve vergi düzenini yorumlar", 2, Z],
        ["Osmanlı kültür ve medeniyetini değerlendirir", 2, O],
        ["Osmanlı'da değişim çağında Avrupa ve Osmanlı'yı karşılaştırır", 3, Z],
      ],
    ],
    [
      "Yakın Çağ ve İnkılaplar",
      [
        ["20. yüzyıl başında Osmanlı Devleti'ni yorumlar", 2, O],
        ["I. Dünya Savaşı ve cepheleri açıklar", 2, O],
        ["Millî Mücadele hazırlık dönemini analiz eder", 3, O],
        ["Kurtuluş Savaşı cepheleri ve antlaşmaları eşleştirir", 3, Z],
        ["Atatürk ilkelerini ve inkılapları ilişkilendirir", 3, O],
        ["Atatürk dönemi Türk dış politikasını değerlendirir", 2, O],
      ],
    ],
  ],
  AYT_COG: [
    [
      "Doğal Sistemler",
      [
        ["Biyomları ve doğal bitki örtüsünü yorumlar", 2, O],
        ["Ekosistem ve madde döngülerini açıklar", 2, O],
        ["Ekstrem doğa olaylarını değerlendirir", 1, O],
      ],
    ],
    [
      "Beşerî ve Ekonomik Sistemler",
      [
        ["Nüfus politikalarını ve etkilerini yorumlar", 2, O],
        ["Şehirlerin fonksiyonlarını sınıflar", 2, O],
        ["Tarım, hayvancılık ve sanayi dağılışını yorumlar", 3, O],
        ["Türkiye'de ulaşım, ticaret ve turizmi değerlendirir", 2, O],
      ],
    ],
    [
      "Bölgesel Coğrafya",
      [
        ["Türkiye'nin bölgelerini doğal ve beşerî özellikleriyle karşılaştırır", 3, O],
        ["Ülkeler coğrafyasında gelişmişlik farklarını yorumlar", 2, O],
        ["Çevre sorunlarını ve küresel etkilerini analiz eder", 2, O],
      ],
    ],
  ],
  AYT_FEL: [
    [
      "Felsefe",
      [
        ["Felsefi okuma ve yazma becerisi gösterir", 2, O],
        ["MÖ 6. yy – MS 2. yy felsefesini tanır", 2, O],
        ["15-17. yy felsefesini ve bilimsel devrimi açıklar", 2, Z],
        ["18-19. yy felsefesini değerlendirir", 2, Z],
        ["20. yy felsefe akımlarını ayırt eder", 2, Z],
      ],
    ],
    [
      "Psikoloji, Sosyoloji ve Mantık",
      [
        ["Psikolojinin temel süreçlerini (algı, öğrenme, bellek) açıklar", 3, O],
        ["Psikolojinin temel yaklaşımlarını karşılaştırır", 2, O],
        ["Sosyolojide toplumsal yapı ve kurumları yorumlar", 3, O],
        ["Sosyolojide araştırma yöntemlerini ayırt eder", 2, Z],
        ["Mantıkta çıkarım ve geçerlilik değerlendirir", 2, Z],
      ],
    ],
  ],

  /**
   * AYT Din Kültürü ve Ahlak Bilgisi (DKAB) yalnızca Sözel alanın Sosyal
   * Bilimler-2 testinde 6 soru olarak çıkar. Katalogda DKAB kazanımı tutulmuyor;
   * bu dersin neti ölçülür ama kazanım eşleştirmesi yapılmaz. Felsefe havuzuna
   * bağlamak Sözel alanında aynı kazanımları iki kez sayardı.
   */
  AYT_DIN: [],

  /* ─────────────────────────────  LGS  ───────────────────────────── */
  LGS_TUR: [
    [
      "Sözcük ve Cümle Düzeyinde Anlam",
      [
        ["Sözcüğün cümleye kattığı anlamı belirler", 2, B],
        ["Deyim, atasözü ve özdeyişlerin anlamını açıklar", 2, B],
        ["Cümleden çıkarılabilecek yargıyı belirler", 3, O],
        ["Cümle tamamlama ve oluşturma yapar", 2, O],
        ["Anlamca çelişen cümleleri ayırt eder", 2, O],
      ],
    ],
    [
      "Paragraf ve Metin Yorumu",
      [
        ["Metnin konusunu ve ana fikrini bulur", 3, O],
        ["Metinden çıkarılacak/çıkarılamayacak yargıyı ayırt eder", 3, O],
        ["Metnin başlığını belirler", 2, B],
        ["Söz sanatlarını (benzetme, kişileştirme, abartma, konuşturma) bulur", 2, O],
        ["Metnin türünü ve anlatım biçimini belirler", 2, O],
        ["Duyulardan yararlanılan ayrıntıları tespit eder", 2, O],
        ["Görsel ve grafikleri yorumlar", 3, O],
        ["Metinler arası karşılaştırma yapar", 2, Z],
        ["Hikâye unsurlarını (olay, yer, zaman, kişi) belirler", 2, O],
      ],
    ],
    [
      "Dil Bilgisi ve Yazım",
      [
        ["Fiilimsileri bulur ve türünü ayırt eder", 2, O],
        ["Cümlenin ögelerini bulur", 2, O],
        ["Cümle türlerini ayırt eder", 2, O],
        ["Yazım kurallarını uygular", 2, B],
        ["Noktalama işaretlerini doğru kullanır", 2, B],
        ["Anlatım bozukluğunu tespit eder", 2, Z],
      ],
    ],
  ],
  LGS_MAT: [
    [
      "Sayılar ve İşlemler",
      [
        ["Çarpanlar ve katlar (EBOB-EKOK) problemlerini çözer", 3, O],
        ["Üslü ifadelerle işlem yapar", 3, O],
        ["Kareköklü ifadelerle işlem yapar", 3, Z],
      ],
    ],
    [
      "Cebirsel İfadeler",
      [
        ["Veri analizi: ortalama, ortanca, tepe değer ve grafiği yorumlar", 2, O],
        ["Basit olayların olasılığını hesaplar", 2, O],
        ["Cebirsel ifadeleri çarpanlarına ayırır", 3, Z],
        ["Özdeşlikleri (tam kare, iki kare farkı) kullanır", 3, Z],
      ],
    ],
    [
      "Doğrusal İlişkiler",
      [
        ["Doğrusal denklemlerin grafiğini çizer", 3, O],
        ["Eğim kavramını yorumlar ve hesaplar", 2, O],
        ["Koordinat sisteminde dönüşümleri uygular", 2, Z],
        ["Doğrusal denklem sistemlerini çözer", 2, Z],
      ],
    ],
    [
      "Geometri ve Ölçme",
      [
        ["Üçgende açı özelliklerini ve eşlik-benzerliği uygular", 3, Z],
        ["Pisagor bağıntısını kullanır", 3, O],
        ["Dönme, öteleme ve yansıma dönüşümlerini uygular", 2, O],
        ["Dairenin çevresini ve alanını hesaplar", 2, O],
        ["Cisimlerin yüzey alanı ve hacmini hesaplar", 3, Z],
      ],
    ],
  ],
  LGS_FEN: [
    [
      "Mevsimler ve İklim",
      [
        ["Dünya'nın hareketlerinin mevsimlere etkisini açıklar", 2, O],
        ["İklim ve hava olaylarını karşılaştırır", 2, O],
      ],
    ],
    [
      "DNA ve Genetik Kod",
      [
        ["DNA'nın yapısını ve görevli birimlerini açıklar", 3, O],
        ["Kalıtım: baskın-çekinik gen ve çaprazlama yapar", 3, Z],
        ["Mutasyon, modifikasyon ve adaptasyonu ayırt eder", 2, O],
        ["Biyoteknoloji uygulamalarını değerlendirir", 1, O],
      ],
    ],
    [
      "Basınç ve Madde",
      [
        ["Katı, sıvı ve gaz basıncını örneklerle açıklar", 3, O],
        ["Basıncın günlük yaşam ve teknolojideki uygulamalarını yorumlar", 2, O],
        ["Maddenin tanecikli yapısını ve hâl değişimlerini açıklar", 2, B],
        ["Yoğunluk ve kütle-hacim ilişkisini hesaplar", 3, O],
      ],
    ],
    [
      "Kimyasal Tepkimeler ve Enerji",
      [
        ["Basit tepkime denklemlerini yazar ve denkleştirir", 2, Z],
        ["Kütlenin korunumu yasasını uygular", 2, O],
        ["Asit ve bazların özelliklerini ayırt eder", 2, B],
        ["Fiziksel ve kimyasal değişimi ayırt eder", 2, B],
        ["Enerji dönüşümlerini ve enerji kaynaklarını değerlendirir", 2, O],
      ],
    ],
    [
      "Canlılarda Enerji ve Elektrik",
      [
        ["Fotosentez ve solunum arasındaki ilişkiyi açıklar", 3, O],
        ["Besin zinciri ve enerji akışını yorumlar", 2, B],
        ["Basit elektrik devrelerinde akım ve gerilim ilişkisini açıklar", 2, O],
        ["Elektriksel direnci etkileyen faktörleri deneylerle açıklar", 2, Z],
      ],
    ],
  ],
  LGS_INK: [
    [
      "Birinci Dünya Savaşı ve Millî Mücadele",
      [
        ["Birinci Dünya Savaşı'nın neden ve sonuçlarını açıklar", 3, O],
        ["Mondros Ateşkesi ve işgalleri yorumlar", 2, O],
        ["Millî Mücadele'yi başlatan cemiyetleri ve kongreleri eşleştirir", 3, Z],
        ["Amasya Genelgesi, Erzurum ve Sivas Kongrelerini ilişkilendirir", 3, Z],
      ],
    ],
    [
      "Kurtuluş Savaşı ve Cumhuriyet",
      [
        ["Kurtuluş Savaşı cephelerini ve antlaşmaları eşleştirir", 3, O],
        ["Misakımillî ve TBMM'nin açılmasının önemini açıklar", 3, O],
        ["Atatürk ilkelerini ve amaçlarını ilişkilendirir", 3, O],
        ["Siyasi, hukuki, eğitim, ekonomi ve sosyal alan inkılaplarını ayırt eder", 3, Z],
        ["Atatürk dönemi Türk dış politikasını değerlendirir", 2, O],
      ],
    ],
  ],
  LGS_INS: [
    [
      "Sözcük Bilgisi",
      [
        ["Ünite sözcük dağarcığını bağlam içinde kullanır", 3, B],
        ["Eş ve zıt anlamlı sözcükleri ayırt eder", 2, B],
      ],
    ],
    [
      "Okuma ve Anlama",
      [
        ["Kısa metinlerde ana fikri bulur", 3, O],
        ["Metindeki ayrıntı sorularını yanıtlar", 3, O],
        ["Görsel ve diyagramları yorumlar", 2, O],
      ],
    ],
    [
      "Dilbilgisi ve Diyalog",
      [
        ["Zaman yapılarını (present/past/future) doğru kullanır", 3, O],
        ["Diyalog tamamlama sorularını yanıtlar", 2, B],
        ["Soru sözcüklerini ve yardımcı fiilleri uygular", 2, B],
      ],
    ],
  ],
  LGS_DIN: [
    [
      "İnanç ve İbadet",
      [
        ["Kader ve kaza inancını açıklar", 3, O],
        ["İnsanın iradesi ve sorumluluğunu yorumlar", 2, O],
        ["Zekât, sadaka ve yardımlaşmanın önemini açıklar", 2, B],
        ["Hac ve kurban ibadetinin toplumsal boyutunu açıklar", 2, B],
      ],
    ],
    [
      "Ahlak ve Peygamberler",
      [
        ["Ahlaki davranışların birey ve topluma katkısını değerlendirir", 2, O],
        ["Hz. Muhammed'in örnek kişiliğini açıklar", 2, B],
        ["Din, bilim ve sanat ilişkisini yorumlar", 2, O],
        ["Kur'an'ın temel özelliklerini ve mesajlarını açıklar", 2, B],
      ],
    ],
  ],
} as Record<DersKodu, Unite[]>;

/** Ders bazlı kazanım listesi (hafızada tek seferde kurulur). */
const INDEX: Record<string, Kazanim[]> = {};

const UNITE_KISA: Record<string, string> = {
  TYT_TUR: "TUR",
  TYT_MAT: "MAT",
  TYT_FEN: "FEN",
  TYT_SOS: "SOS",
  AYT_MAT: "MAT",
  AYT_FIZ: "FIZ",
  AYT_KIM: "KIM",
  AYT_BIY: "BIY",
  AYT_EDB: "EDB",
  AYT_TAR: "TAR",
  AYT_COG: "COG",
  AYT_FEL: "FEL",
  AYT_DIN: "DKAB",
  LGS_TUR: "TUR",
  LGS_MAT: "MAT",
  LGS_FEN: "FEN",
  LGS_INS: "INS",
  LGS_DIN: "DIN",
  LGS_INK: "INK",
};

export function kazanimlarOf(ders: DersKodu): Kazanim[] {
  if (!INDEX[ders]) {
    const unites = KATALOG[ders] ?? [];
    const kisaltma = UNITE_KISA[ders] ?? ders;
    const liste: Kazanim[] = [];
    unites.forEach(([uniteAdi, satirlar], uIdx) => {
      satirlar.forEach(([ad, agirlik, zorluk], kIdx) => {
        const num = String(uIdx + 1).padStart(2, "0") + "." + String(kIdx + 1).padStart(2, "0");
        liste.push({
          id: `${ders}#${num}`,
          kod: `${kisaltma}.${num}`,
          ad,
          ders,
          unite: uniteAdi,
          agirlik,
          zorluk: zorluk ?? O,
        });
      });
    });
    INDEX[ders] = liste;
  }
  return INDEX[ders];
}

export function tumKazanimlar(dersler: DersKodu[]): Kazanim[] {
  return dersler.flatMap(kazanimlarOf);
}

export function kazanimBul(id: string | null | undefined): Kazanim | undefined {
  if (!id) return undefined;
  const [ders] = id.split("#");
  if (!ders) return undefined;
  return kazanimlarOf(ders as DersKodu).find((k) => k.id === id);
}

/** Katalogdaki toplam kazanım sayısı — katalog bütünlük testi için. */
export function katalogBoyutu(): number {
  return Object.keys(UNITE_KISA).reduce((t, d) => t + kazanimlarOf(d as DersKodu).length, 0);
}
