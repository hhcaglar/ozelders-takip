import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Özel Ders Takip — Net, Kazanım ve Rehberlik Paneli",
  description:
    "Okulizyon verisinden öğrenci netlerini çeker, yorumlar, kazanımlara göre kıyaslar ve haftalık çalışma programı üretir.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="min-h-screen antialiased">
        <header className="yazdirma-gizle sticky top-0 z-30 border-b border-cizgi bg-white/85 backdrop-blur">
          <div className="sayfa mx-auto flex max-w-[1200px] items-center gap-6 px-5 py-3">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="grid size-8 place-items-center rounded-lg bg-vurgu text-sm font-bold text-white">
                ÖD
              </span>
              <span className="leading-tight">
                <span className="block text-sm font-semibold">Özel Ders Takip</span>
                <span className="block text-[11px] text-solgun">Net · Kazanım · Rehberlik</span>
              </span>
            </Link>
            <nav className="ml-auto flex items-center gap-1 text-sm">
              <Link
                href="/"
                className="rounded-lg px-3 py-1.5 font-medium text-solgun transition hover:bg-zemin hover:text-murekkep"
              >
                Öğrenciler
              </Link>
              <Link
                href="/baglanti"
                className="rounded-lg px-3 py-1.5 font-medium text-solgun transition hover:bg-zemin hover:text-murekkep"
              >
                Okulizyon Bağlantısı
              </Link>
              <a
                href="https://okulizyon.com/ogrenci/"
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-cizgi px-3 py-1.5 text-xs font-medium text-solgun transition hover:bg-zemin"
              >
                Okulizyon ↗
              </a>
            </nav>
          </div>
        </header>
        <main className="sayfa mx-auto max-w-[1200px] px-5 py-6">{children}</main>
        <footer className="yazdirma-gizle sayfa mx-auto max-w-[1200px] px-5 pb-10 pt-2 text-xs text-solgun">
          Net→puan dönüşümleri ve sıralama tahminleri yaklaşıktır; ÖSYM/MEB gerçek hesaplamada standart puan
          (T-puan) dönüşümü kullanır. Kazanım kataloğu MEB müfredatından derlenmiştir.
        </footer>
      </body>
    </html>
  );
}
