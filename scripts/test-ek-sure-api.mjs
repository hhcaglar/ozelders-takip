// Ek Süre uçtan uca testi: Vercel fonksiyonları + gerçek PostgreSQL +
// sahte Supabase (RPC/Auth) + sahte Microsoft Family Safety.
// Çalıştırma:  npm install --no-save embedded-postgres pg && node scripts/test-ek-sure-api.mjs
import http from 'node:http'
import { randomUUID } from 'node:crypto'
import { startTestDb, createRunner } from './lib/test-db.mjs'
import { startMockMicrosoft, startMockSupabase, makeJwt } from './lib/mock-servers.mjs'

const SERVICE_KEY = 'test-service-role-key'
const CRON_SECRET = 'test-senkron-anahtari-0123456789'

const db = await startTestDb()
const ms = await startMockMicrosoft()
const sb = await startMockSupabase({ db, serviceKey: SERVICE_KEY })

process.env.VITE_SUPABASE_URL = sb.url
process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_KEY
process.env.AILE_SENKRON_ANAHTARI = CRON_SECRET
process.env.FS_LOGIN_BASE = ms.url
process.env.FS_API_BASE = `${ms.url}/api`

// Vercel fonksiyonlarını gerçek bir HTTP sunucusunda çalıştır
const routes = {
  '/api/aile-durum': (await import('../api/aile-durum.js')).default,
  '/api/aile-baglan': (await import('../api/aile-baglan.js')).default,
  '/api/aile-cocuklar': (await import('../api/aile-cocuklar.js')).default,
  '/api/aile-senkron': (await import('../api/aile-senkron.js')).default,
}
const app = http.createServer((req, res) => {
  const route = routes[new URL(req.url, 'http://x').pathname]
  if (!route) {
    res.statusCode = 404
    return res.end()
  }
  route(req, res)
})
await new Promise((r) => app.listen(0, '127.0.0.1', r))
const base = `http://127.0.0.1:${app.address().port}`

async function call(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  return { status: res.status, json: text ? JSON.parse(text) : null }
}

const t = createRunner('Ek Süre — uçtan uca (Vercel fonksiyonları + Microsoft taklidi)')
const TEACHER = randomUUID()
const PARENT = randomUUID()
const STUDENT = randomUUID()
const teacherJwt = makeJwt(TEACHER, { role: 'ogretmen' })
const parentJwt = makeJwt(PARENT, { role: 'veli' })
const CHILD = '9007199254740993' // 2^53 + 1 → JS sayısı olarak okunursa bozulur
const SIBLING = '777000111222333'

const hw = (id, status, title) => ({ id, title, subject: 'Matematik', dueDate: '2026-10-10', status })
const studentDoc = { id: STUDENT, name: 'Elif Demir', grade: '8. Sınıf', subjects: [], exams: [], weeklyPlan: [], homeworks: [hw('h1', 'bekliyor', 'Üslü İfadeler s.24'), hw('h2', 'bekliyor', 'Paragraf 20 soru'), hw('h3', 'bekliyor', 'Deneme analizi'), hw('h4', 'bekliyor', 'Geometri föyü')] }
async function save() {
  await db.as('authenticated', TEACHER, `insert into public.students (id, data) values ($1, $2) on conflict (id) do update set data = excluded.data`, [STUDENT, JSON.stringify(studentDoc)])
}
async function deliver(id) {
  studentDoc.homeworks.find((h) => h.id === id).status = 'teslim'
  await save()
}
const overview = async () => (await db.as('authenticated', TEACHER, 'select public.fs_overview($1) as r', [STUDENT])).rows[0].r
const cron = () => call('/api/aile-senkron', { method: 'POST', token: CRON_SECRET })

try {
  await db.pool.query(`insert into auth.users (id, email) values ($1, 'ogretmen@ornek.com'), ($2, 'veli@ornek.com')`, [TEACHER, PARENT])
  await save()

  t.section('Sunucu durumu ve yetki')
  let r = await call('/api/aile-durum')
  t.ok('Durum: anahtarlar tanımlı, veritabanı hazır', r.status === 200 && r.json.servisAnahtari && r.json.senkronAnahtari && r.json.veritabani === 'hazir', r.json)
  r = await call('/api/aile-baglan', { method: 'POST', body: { adres: 'x' } })
  t.ok('Oturumsuz bağlanma isteği reddedilir (401)', r.status === 401)
  r = await call('/api/aile-baglan', { method: 'POST', token: parentJwt, body: { adres: 'x' } })
  t.ok('Veli hesabı Microsoft bağlayamaz (403)', r.status === 403)
  r = await call('/api/aile-senkron', { method: 'POST', token: 'yanlis-anahtar' })
  t.ok('Yanlış zamanlayıcı anahtarı reddedilir (401)', r.status === 401)
  r = await call('/api/aile-senkron')
  t.ok('GET ile senkron çağrılamaz (405)', r.status === 405)

  t.section('Microsoft hesabını bağlama')
  r = await call('/api/aile-baglan', { method: 'POST', token: teacherJwt, body: { adres: 'https://login.live.com/oauth20_desktop.srf?lc=1055' } })
  t.ok('Kodsuz adres anlaşılır hatayla reddedilir', r.status === 400 && /code=/.test(r.json.hata), r.json)
  r = await call('/api/aile-baglan', { method: 'POST', token: teacherJwt, body: { adres: 'https://login.live.com/oauth20_desktop.srf?error=access_denied&error_description=Kullanici%20iptal%20etti' } })
  t.ok('İptal edilen giriş anlaşılır hatayla reddedilir', r.status === 400 && /iptal/i.test(r.json.hata), r.json)
  r = await call('/api/aile-baglan', { method: 'POST', token: teacherJwt, body: { adres: 'https://login.live.com/oauth20_desktop.srf?removed=true' } })
  t.ok('"removed=true" adresi → kodu yakalama talimatı', r.status === 400 && /removed=true/.test(r.json.hata) && /Ağ sekmesinden/.test(r.json.hata), r.json)
  ms.state.codes.add('M.C5_BAY.2.U.abc$$')
  r = await call('/api/aile-baglan', { method: 'POST', token: teacherJwt, body: { adres: 'https://login.live.com/oauth20_desktop.srf?code=M.C5_BAY.2.U.abc%24%24&lc=1033' } })
  t.ok('Kodunda %24%24 ($$) olan adres doğru çözülür', r.status === 200, r.json)
  ms.state.codes.add('M.C5_BAY.2.U.def$$')
  r = await call('/api/aile-baglan', { method: 'POST', token: teacherJwt, body: { adres: '"M.C5_BAY.2.U.def%24%24"' } })
  t.ok('Yalnızca kod (tırnaklı, %24 kodlu) yapıştırılsa da çalışır', r.status === 200, r.json)
  r = await call('/api/aile-baglan', { method: 'POST', token: teacherJwt, body: { adres: 'https://login.live.com/oauth20_desktop.srf?code=KOD-YANLIS&lc=1055' } })
  t.ok('Geçersiz kod → "süresi dolmuş" mesajı', r.status === 400 && /süresi dolmuş/.test(r.json.hata), r.json)
  r = await call('/api/aile-baglan', { method: 'POST', token: teacherJwt, body: { adres: '  https://login.live.com/oauth20_desktop.srf?code=KOD-IYI&lc=1055  ' } })
  t.ok('Geçerli adresle bağlanıldı', r.status === 200 && r.json.ok, r.json)
  t.ok('Aile üyeleri döndü, izlenen çocuklar önce', r.json.uyeler?.length === 3 && r.json.uyeler[0].monitored && !r.json.uyeler[2].monitored, r.json.uyeler)
  t.ok('Büyük kimlik (2^53+1) hassasiyet kaybı olmadan korundu', r.json.uyeler?.some((u) => u.id === CHILD && u.name === 'Elif Demir'), r.json.uyeler)
  r = await call('/api/aile-baglan', { method: 'POST', token: teacherJwt, body: { adres: 'https://login.live.com/oauth20_desktop.srf?code=KOD-IYI' } })
  t.ok('Aynı kod ikinci kez kullanılamaz', r.status === 400)
  let ov = await overview()
  t.ok('Öğretmen arayüzü bağlantıyı görüyor (belirteç olmadan)', ov.connection?.status === 'ok' && !JSON.stringify(ov).includes('RT-'))

  r = await call('/api/aile-cocuklar', { token: teacherJwt })
  t.ok('Üye listesi kayıtlı belirteçle alınır (yeniden yenilemeden)', r.status === 200 && r.json.uyeler.length === 3 && ms.state.calls.refresh === 0, { status: r.status, refresh: ms.state.calls.refresh })

  await db.as('authenticated', TEACHER, `select public.fs_link_student($1, $2, 'Elif Demir')`, [STUDENT, CHILD])

  t.section('Hak yokken Microsoft\'a gidilmez')
  ms.addRequest({ puid: CHILD, type: 'DeviceScreenTime', requestedTime: '2026-10-08T19:30:00+03:00' })
  const before = ms.state.calls.pending
  r = await cron()
  t.ok('Zamanlayıcı çalıştı ama bekleyen istekler sorgulanmadı', r.status === 200 && ms.state.calls.pending === before && ms.state.approvals.length === 0, r.json)

  t.section('Ödev teslim → çocuk süre ister → otomatik +60 dk')
  await deliver('h1')
  ov = await overview()
  t.ok('Ödev teslim edilince 1 hak oluştu', ov.available === 1)
  ms.addRequest({ puid: CHILD, type: 'AppScreenTime', appName: 'Minecraft', isGlobal: false, requestedTime: '2026-10-08T19:35:00+03:00' })
  ms.addRequest({ puid: SIBLING, type: 'DeviceScreenTime', requestedTime: '2026-10-08T19:36:00+03:00' })
  r = await cron()
  t.ok('Senkron 1 isteği onayladı', r.status === 200 && r.json.onaylanan === 1, r.json)
  const first = ms.state.approvals[0]?.body
  t.ok('Onay süresi tam 60 dk (3.600.000 ms) — ×100 hatası yok', first?.request?.extension === 3600000, first)
  t.ok('Cihaz isteğinde isGlobal=true gönderildi', first?.type === 'DeviceScreenTime' && first?.request?.isGlobal === true)
  t.ok('Onay, değişen id\'nin EN GÜNCEL hâliyle yapıldı', Boolean(first) && ms.state.errors.length === 0, ms.state.errors)
  ov = await overview()
  t.ok('Hak "kullanıldı" oldu', ov.available === 0 && ov.used_today === 1 && ov.credits[0].status === 'kullanildi' && ov.credits[0].request_type === 'DeviceScreenTime')
  t.ok('Olay günlüğüne onay yazıldı', ov.events.some((e) => e.kind === 'onay' && /\+60 dk/.test(e.message)))
  t.ok('Kardeşin (eşleşmemiş) isteğine dokunulmadı', ms.state.pending.some((p) => p.puid === SIBLING))

  t.section('Günde en fazla 1 saat')
  await deliver('h2')
  r = await cron()
  t.ok('Aynı gün ikinci istek onaylanmadı (hak olsa da)', r.json.onaylanan === 0 && r.json.bekletilen === 1, r.json)
  ov = await overview()
  t.ok('Bekletme nedeni olay günlüğünde', ov.events.some((e) => e.kind === 'bekletildi' && /bugünkü ek süre hakkı kullanıldı/.test(e.message)))
  t.ok('Hak yarına kaldı (hâlâ 1 hazır)', ov.available === 1)
  await cron()
  const waitEvents = (await db.pool.query(`select count(*)::int n from public.fs_events where kind = 'bekletildi'`)).rows[0].n
  t.ok('Tekrarlanan senkron aynı olayı ikinci kez yazmaz', waitEvents === 1, waitEvents)

  t.section('Ertesi gün: uygulama (Minecraft) isteği')
  await db.pool.query(`update public.fs_credits set used_at = used_at - interval '1 day', reserved_at = reserved_at - interval '1 day' where status = 'kullanildi'`)
  r = await cron()
  t.ok('Ertesi gün bekleyen Minecraft isteği onaylandı', r.json.onaylanan === 1, r.json)
  const second = ms.state.approvals[1]?.body
  t.ok('Uygulama onayında appName gönderildi', second?.type === 'AppScreenTime' && second?.request?.appName === 'Minecraft', second)
  t.ok('Uygulama onayında isGlobal istekten aynen aktarıldı (false)', second?.request?.isGlobal === false)

  t.section('Eşzamanlı çağrılar çift onay yapmaz')
  await db.as('authenticated', TEACHER, 'select public.fs_update_settings($1, p_daily_max => 0)', [STUDENT])
  await deliver('h3')
  await deliver('h4')
  ms.addRequest({ puid: CHILD, type: 'DeviceScreenTime', requestedTime: '2026-10-09T18:00:00+03:00' })
  ms.addRequest({ puid: CHILD, type: 'DeviceScreenTime', requestedTime: '2026-10-09T18:05:00+03:00' })
  const approvalsBefore = ms.state.approvals.length
  const results = await Promise.all([cron(), cron(), cron()])
  const total = results.reduce((n, x) => n + (x.json?.onaylanan || 0), 0)
  t.ok('3 eşzamanlı çağrı → tam 2 onay (her istek bir kez)', total === 2 && ms.state.approvals.length - approvalsBefore === 2, { total, results: results.map((x) => x.json) })
  ov = await overview()
  t.ok('2 hak kullanıldı, açıkta ayrılmış hak kalmadı', ov.credits.filter((c) => c.status === 'kullanildi').length === 4 && !ov.credits.some((c) => c.status === 'ayrildi'))

  t.section('Belirteç yenileme')
  await db.pool.query(`update public.fs_connections set access_expires_at = now() - interval '1 minute'`)
  const rtBefore = (await db.pool.query('select refresh_token from public.fs_connections')).rows[0].refresh_token
  r = await call('/api/aile-senkron', { method: 'POST', token: teacherJwt })
  const rtAfter = (await db.pool.query('select refresh_token from public.fs_connections')).rows[0].refresh_token
  t.ok('"Şimdi kontrol et" çalıştı ve ayrıntı döndü', r.status === 200 && Array.isArray(r.json.ayrinti), r.json)
  t.ok('Süresi dolan erişim belirteci yenilendi, dönen yeni yenileme belirteci kaydedildi', rtAfter !== rtBefore && ms.state.calls.refresh >= 1, { rtBefore, rtAfter })

  ms.expireAccessTokens() // Microsoft belirteci erken geçersiz kıldı
  await db.as('authenticated', TEACHER, `select public.fs_add_credit($1, 'Ödül')`, [STUDENT])
  ms.addRequest({ puid: CHILD, type: 'DeviceScreenTime', requestedTime: '2026-10-09T20:00:00+03:00' })
  r = await cron()
  t.ok('401 alınca belirteç yenilenip istek yeniden denendi', r.json.onaylanan === 1 && r.json.hatalar.length === 0, r.json)

  t.section('Hatalar')
  ms.state.failApprove = true
  await db.as('authenticated', TEACHER, `select public.fs_add_credit($1, 'Ödül 2')`, [STUDENT])
  ms.addRequest({ puid: CHILD, type: 'DeviceScreenTime', requestedTime: '2026-10-09T21:00:00+03:00' })
  r = await cron()
  ov = await overview()
  t.ok('Microsoft onayı reddederse hak geri verilir', r.json.onaylanan === 0 && ov.available === 1 && ov.events.some((e) => e.kind === 'hata' && /hak geri verildi/.test(e.message)), r.json)
  ms.state.failApprove = false
  r = await cron()
  t.ok('Microsoft düzelince bir sonraki senkronda onaylanır', r.json.onaylanan === 1, r.json)

  await db.as('authenticated', TEACHER, `select public.fs_update_settings($1, p_scope => 'uygulama', p_app_filter => 'roblox')`, [STUDENT])
  await db.as('authenticated', TEACHER, `select public.fs_add_credit($1, 'Ödül 3')`, [STUDENT])
  ms.addRequest({ puid: CHILD, type: 'AppScreenTime', appName: 'Minecraft', isGlobal: false, requestedTime: '2026-10-09T22:00:00+03:00' })
  ms.addRequest({ puid: CHILD, type: 'DeviceScreenTime', requestedTime: '2026-10-09T22:01:00+03:00' })
  r = await cron()
  ov = await overview()
  t.ok('Filtreye uymayan istekler onaylanmaz, nedeni yazılır', r.json.onaylanan === 0 && ov.events.some((e) => /filtresine \(roblox\)/.test(e.message)) && ov.events.some((e) => /yalnızca uygulama/.test(e.message)), r.json)
  await db.as('authenticated', TEACHER, `select public.fs_update_settings($1, p_app_filter => 'minecraft, roblox')`, [STUDENT])
  r = await cron()
  t.ok('Virgülle çoklu filtre: "minecraft" eşleşince onaylanır', r.json.onaylanan === 1 && ms.state.approvals.at(-1).body.request.appName === 'Minecraft', r.json)

  ms.state.rejectRefresh = true
  await db.pool.query(`update public.fs_connections set access_expires_at = now() - interval '1 minute'`)
  r = await call('/api/aile-senkron', { method: 'POST', token: teacherJwt })
  ov = await overview()
  t.ok('Yenileme belirteci geçersizse bağlantı "yeniden giriş" durumuna geçer', ov.connection.status === 'yeniden_giris' && ov.events.some((e) => e.kind === 'yeniden_giris'), { conn: ov.connection, json: r.json })
  const pendingCalls = ms.state.calls.pending
  await cron()
  t.ok('Yeniden giriş bekleyen bağlantı zamanlayıcıda atlanır', ms.state.calls.pending === pendingCalls)
  r = await call('/api/aile-cocuklar', { token: teacherJwt })
  t.ok('Üye listesi yeniden giriş ister (409)', r.status === 409, r)

  ms.state.rejectRefresh = false
  ms.state.codes.add('KOD-IKINCI')
  r = await call('/api/aile-baglan', { method: 'POST', token: teacherJwt, body: { adres: 'https://login.live.com/oauth20_desktop.srf?code=KOD-IKINCI' } })
  ov = await overview()
  t.ok('Yeniden giriş yapınca bağlantı tekrar "ok"', r.status === 200 && ov.connection.status === 'ok')

  t.section('Kurulum eksikse')
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
  r = await call('/api/aile-durum')
  t.ok('Servis anahtarı yoksa durum bunu bildirir', r.status === 200 && r.json.servisAnahtari === false && r.json.veritabani === 'bilinmiyor', r.json)
  r = await cron()
  t.ok('Servis anahtarı yoksa senkron 503 + açıklama döner', r.status === 503 && /SUPABASE_SERVICE_ROLE_KEY/.test(r.json.hata), r.json)
  process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_KEY
  t.ok('Sahte Microsoft beklenmeyen bir istek almadı', ms.state.errors.length === 0, ms.state.errors)
} catch (e) {
  t.ok('Beklenmeyen hata olmadan tamamlandı', false, e?.stack || String(e))
} finally {
  await new Promise((r) => app.close(r))
  await ms.close()
  await sb.close()
  await db.stop()
}

process.exit(t.summary() === 0 ? 0 : 1)
