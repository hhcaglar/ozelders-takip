// Çalışma zamanı duman testi: uygulamayı jsdom'da mount eder,
// demo verinin ve ana ekranın render edildiğini doğrular.
import { JSDOM } from 'jsdom'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')

// 1) entry'yi tek dosyaya derle
execFileSync(
  process.execPath,
  [path.join(root, 'node_modules/esbuild/install.js')].length ? [] : [],
  { stdio: 'ignore' }
)
execFileSync(path.join(root, 'node_modules/.bin/esbuild'), [
  'scripts/smoke-entry.jsx',
  '--bundle',
  '--format=iife',
  '--platform=browser',
  '--jsx=automatic',
  '--define:process.env.NODE_ENV="production"',
  '--define:import.meta.env={}',
  `--outfile=scripts/smoke-bundle.js`,
], { cwd: root, stdio: 'inherit' })

// 2) jsdom ortamını kur
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
})
globalThis.window = dom.window
globalThis.document = dom.window.document
globalThis.navigator = dom.window.navigator
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

