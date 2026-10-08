// Çalışma zamanı duman testi: uygulamayı jsdom'da mount eder,
// demo verinin ve ana ekranın render edildiğini doğrular.
import { JSDOM } from 'jsdom'
import { build } from 'esbuild'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')

// 1) entry'yi tek dosyaya derle. Vite'ın "?raw" içe aktarmasını (dosyayı metin
//    olarak alma) esbuild'e küçük bir eklentiyle öğretiyoruz.
const rawPlugin = {
  name: 'raw',
  setup(b) {
    b.onResolve({ filter: /\?raw$/ }, (args) => ({
      path: path.resolve(args.resolveDir, args.path.replace(/\?raw$/, '')),
      namespace: 'raw',
    }))
    b.onLoad({ filter: /.*/, namespace: 'raw' }, (args) => ({
      contents: readFileSync(args.path, 'utf8'),
      loader: 'text',
    }))
  },
}
await build({
  absWorkingDir: root,
  entryPoints: ['scripts/smoke-entry.jsx'],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env': '{}' },
  outfile: 'scripts/smoke-bundle.js',
  plugins: [rawPlugin],
  logLevel: 'warning',
})

// 2) jsdom ortamını kur
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
})
globalThis.window = dom.window
globalThis.document = dom.window.document
// Node 21+ globalThis.navigator salt-okunur getter'dır → defineProperty ile ez
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true, writable: true })
globalThis.localStorage = dom.window.localStorage
globalThis.HTMLElement = dom.window.HTMLElement
globalThis.Element = dom.window.Element
globalThis.Node = dom.window.Node
globalThis.getComputedStyle = dom.window.getComputedStyle
globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0)
globalThis.cancelAnimationFrame = (id) => clearTimeout(id)
window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
globalThis.matchMedia = window.matchMedia

const errors = []
window.addEventListener('error', (e) => errors.push(e.error?.message || e.message))

// 3) bundle'ı çalıştır
const code = readFileSync(path.join(root, 'scripts/smoke-bundle.js'), 'utf8')
try {
  new Function(code)()
} catch (e) {
  console.error('MOUNT HATASI:', e)
  process.exit(1)
}

// 4) async yükleme tamamlansın
await new Promise((r) => setTimeout(r, 600))

const html = document.getElementById('root').innerHTML
const checks = [
  ['Uygulama mounts', html.includes('DersTakip')],
  ['Demo öğrenci (Elif Demir) sidebar', html.includes('Elif Demir')],
  ['Demo öğrenci 2 (Kerem Aydın)', html.includes('Kerem Aydın')],
  ['İstatistik: İşlenen konu', html.includes('İşlenen konu')],
  ['Sekmeler', html.includes('Sınavlar') && html.includes('Ödevler')],
  ['localStorage\'a yazıldı', Boolean(window.localStorage.getItem('ders-takip:data-v2'))],
  ['Veli kodu üretildi (DEMO-2026)', (window.localStorage.getItem('ders-takip:data-v2') || '').includes('DEMO-2026')],
  ['Hata banner yok', !html.includes('kaydedilemedi')],
]

let failed = 0
for (const [name, ok] of checks) {
  console.log((ok ? '✅' : '❌'), name)
  if (!ok) failed++
}
if (errors.length) {
  console.log('⚠️ window hataları:', errors.slice(0, 3))
  failed++
}

// 5) Etkileşim testleri
const clickByText = (text) => {
  const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim().includes(text))
  if (!btn) throw new Error('Buton bulunamadı: ' + text)
  btn.click()
  return true
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const body = () => document.getElementById('root').innerHTML

const interact = []
try {
  interact.push(['Genel Bakış varsayılan sekme (v3.2)', body().includes('Toplam öğrenci')])
  interact.push(['Öğrenci kartları + uyarılar (v3.2)', body().includes('Öğrenciyi aç')])
  clickByText('Rapor'); await wait(150)
  interact.push(['Rapor sekmesi açılıyor', body().includes('Veli Raporu')])
  interact.push(['Yazdır/PDF butonu (v3.2)', body().includes('Yazdır / PDF')])
  interact.push(['Veli kodu gösteriliyor', body().includes('DEMO-2026')])

  clickByText('Öneriler'); await wait(150)
  interact.push(['Öneriler: net gelişimi tespiti', body().includes('Son sınavda net düşüşü')])

  clickByText('Öğrenciyi sil'); await wait(150)
  interact.push(['Silme onayı açılıyor (window.confirm değil)', body().includes('kalıcı olarak silinecek')])
  clickByText('Vazgeç'); await wait(100)
  interact.push(['Vazgeç ile onay kapanıyor', !body().includes('kalıcı olarak silinecek')])

  const before = (window.localStorage.getItem('ders-takip:data-v2') || '').match(/"name":"([^"]+)"/g)?.length ?? 0
  // Öğretmen → Veli geçişi (yerel mod düğmesi)
  clickByText('Veli'); await wait(150)
  interact.push(['Veli modunda "Öğrenciyi sil" gizlenir', !body().includes('Öğrenciyi sil')])
  clickByText('Öğretmen'); await wait(150)
  interact.push(['Öğretmen moduna dönüş', body().includes('Öğrenciyi sil')])

  // v3 ekleri
  interact.push(['Öğrenci düzenle butonu (v3)', body().includes('Düzenle')])
  clickByText('Ödevler'); await wait(150)
  interact.push(['Ödev filtre çipleri (v3)', body().includes('Geciken') && body().includes('Bekleyen')])
  interact.push(['Görsel cila sınıfı dt-btn (v3)', document.querySelector('.dt-btn') !== null])
  interact.push(['Öğrenci sayacı (v3)', document.body.textContent.includes('ÖĞRENCİLER (2)')])

  // v3.3 — yerel modda kayıt (önceden upsertStudent eksikti → hata bandı çıkıyordu)
  const statusSelects = [...document.querySelectorAll('select')].filter((el) => [...el.options].some((o) => o.value === 'teslim'))
  const target = statusSelects.find((el) => el.value === 'bekliyor')
  const targetTitle = target?.closest('.dt-card-hover')?.querySelector('div > div')?.textContent || ''
  if (target) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set
    setter.call(target, 'teslim')
    target.dispatchEvent(new window.Event('change', { bubbles: true }))
  }
  await wait(1100) // otomatik kayıt 800 ms gecikmeli
  interact.push(['Yerel modda ödev durumu kaydedilir (hata bandı yok)', Boolean(target) && !body().includes('kaydedilemedi')])
  const stored = JSON.parse(window.localStorage.getItem('ders-takip:data-v2') || '{}')
  const storedHw = (stored.students || []).flatMap((st) => st.homeworks || []).find((h) => targetTitle.startsWith(h.title))
  interact.push(['Değişiklik localStorage\'a yazıldı', storedHw?.status === 'teslim'])

  // v3.3 — Ek Süre (Microsoft Family Safety) sekmesi
  interact.push(['Ek Süre sekmesi öğretmende görünür', [...document.querySelectorAll('nav button')].some((b) => b.textContent.includes('Ek Süre'))])
  clickByText('Ek Süre'); await wait(200)
  interact.push(['Ek Süre: başlık', body().includes('Microsoft Family Safety')])
  interact.push(['Ek Süre: yerel modda önizleme uyarısı', body().includes('Önizleme:')])
  interact.push(['Ek Süre: nasıl çalıştığı anlatılıyor', body().includes('Daha fazla süre iste') && body().includes('bir seferlik')])
  interact.push(['Ek Süre: hak listesi ve istatistikler', body().includes('Ek süre hakları') && body().includes('Kullanılabilir hak')])
  interact.push(['Ek Süre: kurallar (günde en fazla)', body().includes('Kurallar') && body().includes('Günde en fazla')])
  interact.push(['Ek Süre: sunucu kurulum kartı', body().includes('Sunucu kurulumu')])
  clickByText('Sunucu kurulumu'); await wait(150)
  const sqlBox = document.querySelector('textarea')
  interact.push(['Kurulum: zamanlayıcı SQL\'i site adresiyle dolduruldu', Boolean(sqlBox) && sqlBox.value.includes("'http://localhost'") && !sqlBox.value.includes("'__GIZLI_ANAHTAR__'")])
  clickByText('Şimdi kontrol et'); await wait(150)
  interact.push(['Önizlemede işlem yapılmaz, kullanıcı bilgilendirilir', body().includes('Önizleme modunda işlem yapılmaz')])
  clickByText('Veli'); await wait(150)
  interact.push(['Veli görünümünde Ek Süre sekmesi yok', ![...document.querySelectorAll('nav button')].some((b) => b.textContent.includes('Ek Süre'))])
  clickByText('Öğretmen'); await wait(150)
} catch (e) {
  interact.push(['Etkileşim akışı hatasız', false])
  console.error('ETKİLEŞİM HATASI:', e.message)
}

for (const [name, ok] of interact) {
  console.log((ok ? '✅' : '❌'), name)
  if (!ok) failed++
}

console.log(failed === 0 ? '\nTÜM TESTLER GEÇTİ' : `\n${failed} TEST BAŞARISIZ`)
process.exit(failed === 0 ? 0 : 1)

