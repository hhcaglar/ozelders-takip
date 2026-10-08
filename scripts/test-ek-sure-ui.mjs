// Ek Süre arayüz testi (bulut modu, sahte API) — jsdom'da tıklama akışı.
// Çalıştırma: node scripts/test-ek-sure-ui.mjs
import { JSDOM } from 'jsdom'
import { build } from 'esbuild'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createRunner } from './lib/test-db.mjs'

const root = path.resolve(import.meta.dirname, '..')
const plugins = [
  {
    name: 'raw',
    setup(b) {
      b.onResolve({ filter: /\?raw$/ }, (a) => ({ path: path.resolve(a.resolveDir, a.path.replace(/\?raw$/, '')), namespace: 'raw' }))
      b.onLoad({ filter: /.*/, namespace: 'raw' }, (a) => ({ contents: readFileSync(a.path, 'utf8'), loader: 'text' }))
    },
  },
  {
    // src/lib/ekSure.js → sahte API
    name: 'mock-ek-sure',
    setup(b) {
      b.onResolve({ filter: /lib\/ekSure\.js$/ }, () => ({ path: path.join(root, 'scripts/lib/ekSure.mock.js') }))
    },
  },
]
await build({
  absWorkingDir: root,
  entryPoints: ['scripts/ek-sure-ui-entry.jsx'],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"development"', 'import.meta.env': '{}' },
  outfile: 'scripts/ek-sure-ui-bundle.js',
  plugins,
  logLevel: 'warning',
})

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'https://veli.ornek.com/',
  pretendToBeVisual: true,
})
globalThis.window = dom.window
globalThis.document = dom.window.document
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true, writable: true })
globalThis.localStorage = dom.window.localStorage
globalThis.HTMLElement = dom.window.HTMLElement
globalThis.Element = dom.window.Element
globalThis.Node = dom.window.Node
globalThis.getComputedStyle = dom.window.getComputedStyle
globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0)
globalThis.cancelAnimationFrame = (id) => clearTimeout(id)
const clipboard = []
Object.defineProperty(dom.window.navigator, 'clipboard', { value: { writeText: async (t) => clipboard.push(t) }, configurable: true })

const errors = []
const origError = console.error
console.error = (...args) => {
  const msg = args.map(String).join(' ')
  if (/act\(|not wrapped in act/i.test(msg)) return
  errors.push(msg)
}
dom.window.addEventListener('error', (e) => errors.push(e.error?.message || e.message))

new Function(readFileSync(path.join(root, 'scripts/ek-sure-ui-bundle.js'), 'utf8'))()

const wait = (ms = 60) => new Promise((r) => setTimeout(r, ms))
const ek = () => document.getElementById('aktif')
const hwSection = () => document.getElementById('aktif')
const goTab = async (id) => {
  document.getElementById(`tab-${id}`).click()
  await wait(150)
}
const text = (el = document.body) => el.textContent.replace(/\s+/g, ' ')
const mock = globalThis.__ekSureMock

function button(label, scope = document) {
  const b = [...scope.querySelectorAll('button, a')].find((x) => x.textContent.trim().includes(label))
  if (!b) throw new Error(`Düğme bulunamadı: ${label}`)
  return b
}
async function click(label, scope) {
  button(label, scope).click()
  await wait()
}
function setValue(el, value) {
  const proto = el.tagName === 'SELECT' ? dom.window.HTMLSelectElement.prototype : el.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value)
  el.dispatchEvent(new dom.window.Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
}
const input = (placeholderPart, scope = document) =>
  [...scope.querySelectorAll('input')].find((i) => (i.placeholder || '').includes(placeholderPart))

const t = createRunner('Ek Süre — arayüz testi (bulut modu)')
try {
  await wait(150)

  t.section('Bağlantı yokken')
  t.ok('Başlık ve açıklama görünür', text(ek()).includes('Ek Süre · Microsoft Family Safety') && text(ek()).includes('bir seferlik +1 saat'))
  t.ok('Önizleme uyarısı YOK (bulut modu)', !text(ek()).includes('Önizleme:'))
  t.ok('"Microsoft hesabını bağlayın" adımları görünür', text(ek()).includes('Microsoft hesabını bağlayın') && text(ek()).includes('aile düzenleyicisi'))
  const login = button('Microsoft ile giriş yap', ek())
  t.ok('Giriş bağlantısı Family Safety istemcisine gider, yeni sekmede açılır', login.href.startsWith('https://login.live.com/oauth20_authorize.srf') && login.href.includes('client_id=000000000004893A') && login.target === '_blank' && login.rel.includes('noopener'))
  t.ok('"Şimdi kontrol et" bağlantı yokken gizli', ![...ek().querySelectorAll('button')].some((b) => b.textContent.includes('Şimdi kontrol et')))
  await wait(50)
  t.ok('Sunucu kurulumu eksik olduğu için kurulum kartı otomatik açık', text(ek()).includes('Vercel\'e iki ortam değişkeni ekleyin'))
  const sqlBox = ek().querySelector('textarea')
  t.ok('Zamanlayıcı SQL\'i site adresi ve üretilen anahtarla dolu', Boolean(sqlBox) && /^-- zamanlayici https:\/\/veli\.ornek\.com [A-Za-z0-9]{40}$/.test(sqlBox.value), sqlBox?.value)
  await click('SQL\'i kopyala', ek())
  t.ok('"SQL\'i kopyala" panoya yazar', clipboard.at(-1) === sqlBox.value && text(ek()).includes('Kopyalandı ✓'))

  t.section('Microsoft bağlama')
  const urlInput = input('oauth20_desktop', ek())
  t.ok('"Bağla" düğmesi adres boşken pasif', button('Bağla', ek()).disabled === true)
  setValue(urlInput, 'https://login.live.com/oauth20_desktop.srf?lc=1055')
  await wait()
  await click('Bağla', ek())
  await wait()
  t.ok('Hatalı adres → anlaşılır hata', text(ek()).includes('Adreste "code=" bulunamadı'))
  setValue(urlInput, 'https://login.live.com/oauth20_desktop.srf?code=M.C5_BAY.abc&lc=1055')
  await wait()
  await click('Bağla', ek())
  await wait(120)
  t.ok('Doğru adres → bağlandı mesajı', text(ek()).includes('Microsoft hesabı bağlandı. Şimdi öğrenciyi eşleştirin.'))
  t.ok('Bağlı kartı ve "Bağlantıyı kaldır" görünür', text(ek()).includes('Microsoft hesabı bağlı') && text(ek()).includes('Bağlantıyı kaldır'))

  t.section('Öğrenci eşleştirme')
  await wait(80)
  t.ok('Eşleştirme kartı aile üyelerini listeler', text(ek()).includes('Bu öğrenci Family Safety\'de hangisi?') && text(ek()).includes('Ayşe Demir — aile düzenleyicisi'))
  const memberSelect = [...ek().querySelectorAll('select')].find((s) => [...s.options].some((o) => o.textContent.includes('Elif Demir')))
  setValue(memberSelect, '9007199254740993')
  await wait()
  await click('Eşleştir', ek())
  await wait(120)
  t.ok('Eşleştirildi, büyük kimlik bozulmadan gönderildi', mock.calls.some((c) => c[0] === 'fsLinkStudent' && c[2] === '9007199254740993') && text(ek()).includes('Elif Demir hesabıyla eşleşti'))
  t.ok('Kurallar kartı göründü; varsayılan 60 dk / günde 1', text(ek()).includes('Kurallar') && ek().querySelector('input[type=number]').value === '60')
  t.ok('"Şimdi kontrol et" artık görünür', text(ek()).includes('Şimdi kontrol et'))

  t.section('Kurallar')
  t.ok('Değişiklik yokken kaydet pasif', button('Kuralları kaydet', ek()).disabled === true)
  const [minutesInput, dailyInput] = ek().querySelectorAll('input[type=number]')
  setValue(minutesInput, '45')
  setValue(dailyInput, '2')
  await wait()
  await click('Yalnızca uygulama/oyun', ek())
  setValue(input('ör. minecraft', ek()), 'minecraft')
  await wait()
  await click('Kuralları kaydet', ek())
  await wait(120)
  const settingsCall = mock.calls.findLast((c) => c[0] === 'fsUpdateSettings')
  t.ok('Kurallar doğru değerlerle gönderildi', settingsCall && settingsCall[2].minutes === 45 && settingsCall[2].dailyMax === 2 && settingsCall[2].scope === 'uygulama' && settingsCall[2].appFilter === 'minecraft' && settingsCall[2].enabled === true, settingsCall)
  t.ok('Açıklama yeni süreyi gösterir (+45 dk, günde 2)', text(ek()).includes('bir seferlik +45 dk') && text(ek()).includes('günde en fazla 2 kez'))
  await click('Hepsi', ek())
  await wait()
  t.ok('"Hepsi" seçilince uygulama filtresi alanı açık kalır', Boolean(input('ör. minecraft', ek())))
  await click('Yalnızca ekran süresi', ek())
  await wait()
  t.ok('"Yalnızca ekran süresi"nde uygulama filtresi gizlenir', !input('ör. minecraft', ek()))
  setValue(minutesInput, '60')
  setValue(dailyInput, '1')
  await click('Hepsi', ek())
  setValue(input('ör. minecraft', ek()), '')
  await wait()
  await click('Kuralları kaydet', ek())
  await wait(120)

  t.section('Ödev teslimi → hak (Ödevler sekmesi)')
  await goTab('odevler')
  t.ok('Ödevler sekmesinde ek süre bilgisi satırı görünür', text(hwSection()).includes('Teslim edilen her ödev bir seferlik +1 saat ek süre hakkı kazandırır'))
  const hwSelect = hwSection().querySelector('select')
  setValue(hwSelect, 'teslim')
  await wait(200)
  t.ok('Teslim seçilince bilgilendirme çıkar', text(hwSection()).includes('“Üslü İfadeler s.24” teslim edildi → Elif için bir seferlik +1 saat ek süre hakkı tanımlandı'))
  t.ok('Ödevin yanında "hak hazır" etiketi görünür', text(hwSection()).includes('+1 saat · hak hazır'))
  await goTab('eksure')
  t.ok('Ek Süre sekmesi yeni hakkı gösterir (otomatik kayıttan sonra yenilendi)', text(ek()).includes('Üslü İfadeler s.24') && text(ek()).includes('Hazır'))

  t.section('Elle hak, iptal, şimdi kontrol et')
  await click('Elle hak ekle', ek())
  setValue(input('Açıklama', ek()), 'Hafta sonu ödülü')
  await wait()
  await click('Ekle', ek())
  await wait(120)
  t.ok('Elle eklenen hak listede', text(ek()).includes('Hafta sonu ödülü') && text(ek()).includes('elle eklendi'))
  const cancelBtn = [...ek().querySelectorAll('button[aria-label="Hakkı iptal et"]')][0]
  cancelBtn.click()
  await wait(120)
  t.ok('Hak iptal edildi', text(ek()).includes('Hak iptal edildi.') && text(ek()).includes('İptal'))
  await click('Şimdi kontrol et', ek())
  await wait(150)
  t.ok('"Şimdi kontrol et" sonucu gösterir', text(ek()).includes('1 istek onaylandı.'))
  t.ok('Kullanılan hak ve olay görünür', text(ek()).includes('Kullanıldı:') && text(ek()).includes('Minecraft') && text(ek()).includes('+60 dk onaylandı'))
  await goTab('odevler')
  t.ok('Ödevler sekmesinde etiket "kullanıldı" oldu', text(hwSection()).includes('+1 saat · kullanıldı'))
  setValue(hwSection().querySelector('select'), 'bekliyor') // sekme yeniden kuruldu → öğeyi tekrar bul
  await wait(150)
  setValue(hwSection().querySelector('select'), 'teslim')
  await wait(150)
  t.ok('Kullanılmış ödevi tekrar teslim edince "ikinci kez verilmez" uyarısı', text(hwSection()).includes('daha önce kullanılmıştı; ikinci kez verilmez'))

  t.section('Oturum süresi dolarsa')
  mock.state.connection.status = 'yeniden_giris'
  mock.state.connection.last_error = 'Microsoft oturumunun süresi dolmuş'
  await goTab('eksure')
  t.ok('"Microsoft oturumunu yenileyin" uyarısı ve giriş adımları görünür', text(ek()).includes('Microsoft oturumunu yenileyin') && text(ek()).includes('otomatik onaylar durdu'))

  t.ok('Konsolda React hatası yok', errors.length === 0, errors.slice(0, 3))
} catch (e) {
  t.ok('Beklenmeyen hata olmadan tamamlandı', false, e?.stack || String(e))
}
console.error = origError
process.exit(t.summary() === 0 ? 0 : 1)
