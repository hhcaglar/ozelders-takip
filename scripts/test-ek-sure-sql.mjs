// Ek Süre (Family Safety) veritabanı testleri — gerçek PostgreSQL üzerinde.
// Çalıştırma:  npm install --no-save embedded-postgres pg && node scripts/test-ek-sure-sql.mjs
import { randomUUID } from 'node:crypto'
import { startTestDb, createRunner } from './lib/test-db.mjs'

const db = await startTestDb()
const t = createRunner('Ek Süre — veritabanı testleri')

const T1 = randomUUID() // öğretmen
const T2 = randomUUID() // başka öğretmen
const S1 = randomUUID() // T1'in öğrencisi
const S2 = randomUUID() // T2'nin öğrencisi

const hw = (id, status, title = id) => ({ id, title, subject: 'Matematik', dueDate: '2026-10-10', status })
const doc = (id, name, homeworks) => ({ id, name, grade: '8. Sınıf', subjects: [], exams: [], homeworks, weeklyPlan: [] })

// Öğretmen tarayıcısının otomatik kaydı (PostgREST upsert'i) ile aynı sorgu
async function saveStudent(uid, d) {
  await db.as(
    'authenticated',
    uid,
    `insert into public.students (id, parent_code, data) values ($1, $2, $3)
     on conflict (id) do update set parent_code = excluded.parent_code, data = excluded.data`,
    [d.id, null, JSON.stringify(d)]
  )
}
const rpc = async (role, uid, sql, params) => (await db.as(role, uid, sql, params)).rows[0]
// pg, bigint'i metin döndürür; RPC'lerin JSON'u ise sayı → karşılaştırma için sayıya çevir
const credits = async (studentId) =>
  (await db.pool.query('select * from public.fs_credits where student_id = $1 order by id', [studentId])).rows.map(
    (row) => ({ ...row, id: Number(row.id) })
  )

try {
  await db.pool.query(`insert into auth.users (id, email) values ($1, 't1@ornek.com'), ($2, 't2@ornek.com')`, [T1, T2])

  t.section('Kurulum ve izolasyon')
  let s1 = doc(S1, 'Elif Demir', [hw('h1', 'bekliyor', 'Üslü İfadeler s.24'), hw('h2', 'bekliyor', 'Paragraf 20 soru'), hw('h3', 'teslim', 'Eski ödev')])
  await saveStudent(T1, s1)
  await saveStudent(T2, doc(S2, 'Kerem Aydın', [hw('k1', 'bekliyor')]))
  t.ok('Şema iki kez çalıştırılabildi (idempotent)', true)

  let ov = (await rpc('authenticated', T1, 'select public.fs_overview($1) as r', [S1])).r
  t.ok('Yeni öğrencide bağlantı ve eşleşme yok', ov.connection === null && ov.link === null && ov.available === 0)
  await t.throws('Başka öğretmen bu öğrencinin durumunu göremez', () => db.as('authenticated', T2, 'select public.fs_overview($1)', [S1]), /yetkiniz yok/)
  await t.throws('Girişsiz (anon) kullanıcı RPC çağıramaz', () => db.as('anon', null, 'select public.fs_overview($1)', [S1]), /permission denied/)

  t.section('Microsoft belirteci gizliliği')
  await rpc('service_role', null, `select public.fs_save_connection($1, 'ms-ebeveyn-1', 'RT-GIZLI-1', 'AT-1', now() + interval '1 hour')`, [T1])
  await t.throws('Öğretmen tarayıcısı belirteç tablosunu okuyamaz', () => db.as('authenticated', T1, 'select refresh_token from public.fs_connections'), /permission denied/)
  await t.throws('Anon belirteç tablosunu okuyamaz', () => db.as('anon', null, 'select * from public.fs_connections'), /permission denied/)
  ov = (await rpc('authenticated', T1, 'select public.fs_overview($1) as r', [S1])).r
  t.ok('Genel bakış bağlantıyı gösterir', ov.connection?.status === 'ok' && ov.connection?.ms_user_id === 'ms-ebeveyn-1')
  t.ok('Genel bakış belirteç SIZDIRMAZ', !JSON.stringify(ov).includes('RT-GIZLI') && !JSON.stringify(ov).includes('AT-1'))
  await t.throws('Öğretmen sunucu RPC\'sini çağıramaz (fs_claim_sync)', () => db.as('authenticated', T1, 'select public.fs_claim_sync()'), /permission denied/)
  await t.throws('Öğretmen hak ayıramaz (fs_reserve_credit)', () => db.as('authenticated', T1, `select public.fs_reserve_credit($1, '1', 'k')`, [T1]), /permission denied/)
  await t.throws('Öğretmen haklar tablosuna doğrudan yazamaz', () => db.as('authenticated', T1, `insert into public.fs_credits (student_id, owner_id, title) values ($1, $2, 'hile')`, [S1, T1]), /permission denied/)

  t.section('Eşleşme yokken ödev teslimi')
  s1.homeworks[1].status = 'teslim' // h2
  await saveStudent(T1, s1)
  t.ok('Family Safety eşleşmesi yokken hak oluşmaz', (await credits(S1)).length === 0)
  s1.homeworks[1].status = 'bekliyor'
  await saveStudent(T1, s1)

  t.section('Eşleştirme')
  ov = (await rpc('authenticated', T1, `select public.fs_link_student($1, '1055519684390826', 'Elif') as r`, [S1])).r
  t.ok('Öğrenci çocuğa bağlandı, varsayılanlar: 60 dk, günde 1', ov.link?.ms_child_id === '1055519684390826' && ov.link.minutes_per_credit === 60 && ov.link.daily_max === 1 && ov.link.enabled === true)
  await t.throws('Aynı çocuk ikinci öğrenciye bağlanamaz', async () => {
    const S3 = randomUUID()
    await saveStudent(T1, doc(S3, 'Üçüncü', []))
    await db.as('authenticated', T1, `select public.fs_link_student($1, '1055519684390826', 'Elif')`, [S3])
  }, /başka bir öğrenciye bağlı/)
  await t.throws('Başka öğretmen bu öğrenciyi eşleştiremez', () => db.as('authenticated', T2, `select public.fs_link_student($1, '999', 'X')`, [S1]), /yetkiniz yok/)

  t.section('Tetikleyici: ödev teslim → bir seferlik hak')
  s1.homeworks[0].status = 'teslim' // h1
  await saveStudent(T1, s1)
  let c = await credits(S1)
  t.ok('h1 teslim edilince 1 hak oluştu (60 dk, hazır)', c.length === 1 && c[0].homework_id === 'h1' && c[0].minutes === 60 && c[0].status === 'hazir')
  t.ok('Hak başlığı ödev başlığından gelir', c[0].title === 'Üslü İfadeler s.24')
  t.ok('Daha önce teslim olan h3 için geriye dönük hak oluşmaz', !c.some((x) => x.homework_id === 'h3'))

  await saveStudent(T1, s1) // aynı belge tekrar kaydedilir (otomatik kayıt)
  t.ok('Aynı belgenin tekrar kaydı yeni hak açmaz', (await credits(S1)).length === 1)

  s1.homeworks[0].status = 'bekliyor'
  await saveStudent(T1, s1)
  c = await credits(S1)
  t.ok('Teslimden geri alınca kullanılmamış hak iptal edilir', c.length === 1 && c[0].status === 'iptal')

  s1.homeworks[0].status = 'teslim'
  await saveStudent(T1, s1)
  c = await credits(S1)
  t.ok('Tekrar teslim → AYNI hak geri gelir (ikinci hak açılmaz)', c.length === 1 && c[0].status === 'hazir')

  s1.homeworks[0].status = 'gecikti'
  await saveStudent(T1, s1)
  s1.homeworks[0].status = 'teslim'
  await saveStudent(T1, s1)
  t.ok('teslim → gecikti → teslim döngüsü de tek hak bırakır', (await credits(S1)).filter((x) => x.homework_id === 'h1').length === 1)

  s1.homeworks[1].status = 'teslim' // h2
  s1.homeworks.push(hw('h4', 'teslim', 'Aynı kayıtta iki ödev'))
  await saveStudent(T1, s1)
  c = await credits(S1)
  t.ok('Aynı kayıtta birden çok teslim → her ödeve bir hak (toplam 3)', c.length === 3 && c.every((x) => x.status === 'hazir'))

  s1.homeworks = s1.homeworks.filter((h) => h.id !== 'h4')
  await saveStudent(T1, s1)
  t.ok('Teslim edilmiş ödev silinirse hakkı DURUR', (await credits(S1)).find((x) => x.homework_id === 'h4')?.status === 'hazir')

  ov = (await rpc('authenticated', T1, 'select public.fs_overview($1) as r', [S1])).r
  t.ok('Genel bakış: 3 kullanılabilir hak, ödev haritası dolu', ov.available === 3 && ov.by_homework?.h1?.status === 'hazir' && ov.by_homework?.h2?.minutes === 60)

  t.section('Senkron: kilit, eşleşmeler, hak ayırma')
  let claimed = (await rpc('service_role', null, 'select public.fs_claim_sync() as r')).r
  t.ok('İşi olan bağlantı kilitlendi ve belirteç sunucuya döndü', claimed.length === 1 && claimed[0].owner_id === T1 && claimed[0].refresh_token === 'RT-GIZLI-1' && claimed[0].needs_work === true)
  let claimed2 = (await rpc('service_role', null, 'select public.fs_claim_sync() as r')).r
  t.ok('Kilitliyken ikinci çağrı aynı bağlantıyı ALMAZ (çift onay önlenir)', claimed2.length === 0)

  const links = (await rpc('service_role', null, 'select public.fs_links_for_sync($1) as r', [T1])).r
  t.ok('Eşleşme listesi: çocuk kimliği, öğrenci adı, hak sayısı', links.length === 1 && links[0].ms_child_id === '1055519684390826' && links[0].student_name === 'Elif Demir' && links[0].available === 3)

  const CHILD = '1055519684390826'
  let r = (await rpc('service_role', null, `select public.fs_reserve_credit($1, $2, 'istek-A', 'DeviceScreenTime', null) as r`, [T1, CHILD])).r
  t.ok('İstek A için en eski hak ayrıldı', r.result === 'ok' && r.minutes === 60 && r.title === 'Üslü İfadeler s.24')
  const creditA = r.credit_id
  r = (await rpc('service_role', null, `select public.fs_reserve_credit($1, $2, 'istek-A', 'DeviceScreenTime', null) as r`, [T1, CHILD])).r
  t.ok('Yarım kalan istek yeniden gelirse AYNI hak döner (retry)', r.result === 'ok' && r.retry === true && r.credit_id === creditA)
  await rpc('service_role', null, 'select public.fs_finish_credit($1, true)', [creditA])
  r = (await rpc('service_role', null, `select public.fs_reserve_credit($1, $2, 'istek-A', 'DeviceScreenTime', null) as r`, [T1, CHILD])).r
  t.ok('Onaylanmış istek tekrar listelenirse ikinci kez onaylanmaz', r.result === 'already_used')

  r = (await rpc('service_role', null, `select public.fs_reserve_credit($1, $2, 'istek-B', 'AppScreenTime', 'Minecraft') as r`, [T1, CHILD])).r
  t.ok('GÜNDE EN FAZLA 1: aynı gün ikinci istek bekletilir', r.result === 'daily_limit' && r.used_today === 1)

  ov = (await rpc('authenticated', T1, 'select public.fs_overview($1) as r', [S1])).r
  t.ok('Genel bakış: bugün 1 kullanıldı, 2 hak kaldı', ov.used_today === 1 && ov.available === 2 && ov.used_total === 1)

  await rpc('authenticated', T1, 'select public.fs_update_settings($1, p_daily_max => 2)', [S1])
  r = (await rpc('service_role', null, `select public.fs_reserve_credit($1, $2, 'istek-B', 'AppScreenTime', 'Minecraft') as r`, [T1, CHILD])).r
  t.ok('Günlük sınır 2 yapılınca ikinci istek için hak ayrılır', r.result === 'ok')
  await rpc('service_role', null, `select public.fs_finish_credit($1, false, 'Microsoft 500')`, [r.credit_id])
  c = await credits(S1)
  const failedCredit = c.find((x) => x.id === r.credit_id)
  t.ok('Onay başarısız olursa hak geri verilir (hazır + not)', failedCredit.status === 'hazir' && failedCredit.request_key === null && /500/.test(failedCredit.note))

  r = (await rpc('service_role', null, `select public.fs_reserve_credit($1, $2, 'istek-C', 'AppScreenTime', 'Minecraft') as r`, [T1, CHILD])).r
  await db.pool.query(`update public.fs_credits set reserved_at = now() - interval '11 minutes' where id = $1`, [r.credit_id])
  let n = (await rpc('service_role', null, `select public.fs_reconcile($1, array['baska-istek']) as r`, [T1])).r
  t.ok('Sonucu yazılamamış ayrılmış hak, istek kaybolunca kullanılmış sayılır', n === 1 && (await credits(S1)).find((x) => x.id === r.credit_id).status === 'kullanildi')

  r = (await rpc('service_role', null, `select public.fs_reserve_credit($1, '000', 'x', null, null) as r`, [T1])).r
  t.ok('Eşleşmemiş çocuk → not_linked', r.result === 'not_linked')
  r = (await rpc('service_role', null, `select public.fs_reserve_credit($1, $2, 'istek-D', null, null) as r`, [T1, CHILD])).r
  t.ok('Günlük sınır (2) dolunca → daily_limit', r.result === 'daily_limit')

  t.section('Ayarlar, elle hak, iptal')
  ov = (await rpc('authenticated', T1, `select public.fs_update_settings($1, p_minutes => 45, p_scope => 'uygulama', p_app_filter => '  minecraft ') as r`, [S1])).r
  t.ok('Süre 45 dk, kapsam uygulama, filtre kırpıldı', ov.link.minutes_per_credit === 45 && ov.link.request_scope === 'uygulama' && ov.link.app_filter === 'minecraft')
  t.ok('Kullanılmamış haklar yeni süreyi aldı', (await credits(S1)).filter((x) => x.status === 'hazir').every((x) => x.minutes === 45))
  t.ok('Kullanılmış hakların süresi değişmedi', (await credits(S1)).filter((x) => x.status === 'kullanildi').every((x) => x.minutes === 60))
  await t.throws('Geçersiz kapsam reddedilir', () => db.as('authenticated', T1, `select public.fs_update_settings($1, p_scope => 'hepsi-degil')`, [S1]), /Geçersiz/)
  ov = (await rpc('authenticated', T1, `select public.fs_update_settings($1, p_minutes => 9999, p_daily_max => -5) as r`, [S1])).r
  t.ok('Sınır dışı değerler kırpılır (600 dk, 0 = sınırsız)', ov.link.minutes_per_credit === 600 && ov.link.daily_max === 0)
  await rpc('authenticated', T1, `select public.fs_update_settings($1, p_minutes => 60, p_daily_max => 1, p_scope => 'hepsi', p_app_filter => '')`, [S1])

  ov = (await rpc('authenticated', T1, `select public.fs_add_credit($1, 'Hafta sonu ödülü') as r`, [S1])).r
  const manual = ov.credits.find((x) => x.title === 'Hafta sonu ödülü')
  t.ok('Elle hak eklendi (ödevsiz, 60 dk)', manual && manual.homework_id === null && manual.minutes === 60 && manual.status === 'hazir')
  t.ok('Genel bakış istek anahtarlarını göstermez', !JSON.stringify(ov.credits).includes('istek-'))
  await t.throws('Başka öğretmen bu hakkı iptal edemez', () => db.as('authenticated', T2, 'select public.fs_cancel_credit($1)', [manual.id]), /yetkiniz yok/)
  ov = (await rpc('authenticated', T1, 'select public.fs_cancel_credit($1) as r', [manual.id])).r
  t.ok('Öğretmen hazır hakkı iptal edebilir', ov.credits.find((x) => x.id === manual.id).status === 'iptal')
  ov = (await rpc('authenticated', T1, 'select public.fs_cancel_credit($1) as r', [creditA])).r
  t.ok('Kullanılmış hak iptal edilemez (değişmez)', ov.credits.find((x) => x.id === creditA).status === 'kullanildi')

  await rpc('authenticated', T1, 'select public.fs_update_settings($1, p_enabled => false)', [S1])
  r = (await rpc('service_role', null, `select public.fs_reserve_credit($1, $2, 'istek-E', null, null) as r`, [T1, CHILD])).r
  t.ok('Otomatik onay kapalıyken → disabled', r.result === 'disabled')
  s1.homeworks.push(hw('h5', 'teslim', 'Kapalıyken teslim'))
  await saveStudent(T1, s1)
  t.ok('Kapalıyken teslim edilen ödeve hak oluşmaz', !(await credits(S1)).some((x) => x.homework_id === 'h5'))
  const linksOff = (await rpc('service_role', null, 'select public.fs_links_for_sync($1) as r', [T1])).r
  t.ok('Kapalı eşleşme senkron listesinde yer almaz', linksOff.length === 0)
  await rpc('authenticated', T1, 'select public.fs_update_settings($1, p_enabled => true)', [S1])

  t.section('Olay günlüğü')
  await rpc('service_role', null, `select public.fs_log($1, $2, 'onay', 'mesaj', 'anahtar-1')`, [T1, S1])
  await rpc('service_role', null, `select public.fs_log($1, $2, 'onay', 'mesaj', 'anahtar-1')`, [T1, S1])
  await rpc('service_role', null, `select public.fs_log($1, null, 'hata', 'Aynı hata', null)`, [T1])
  await rpc('service_role', null, `select public.fs_log($1, null, 'hata', 'Aynı hata', null)`, [T1])
  const ev = (await db.pool.query(`select kind, count(*)::int n from public.fs_events where owner_id = $1 and kind in ('onay','hata') group by kind`, [T1])).rows
  t.ok('Aynı istek için olay bir kez yazılır', ev.find((x) => x.kind === 'onay')?.n === 1)
  t.ok('Aynı hata saatte bir kez yazılır', ev.find((x) => x.kind === 'hata')?.n === 1)
  ov = (await rpc('authenticated', T1, 'select public.fs_overview($1) as r', [S1])).r
  t.ok('Olaylar genel bakışta görünür', ov.events.some((e) => e.kind === 'baglanti') && ov.events.some((e) => e.kind === 'onay'))
  const evT2 = (await db.as('authenticated', T2, 'select count(*)::int n from public.fs_events')).rows[0].n
  t.ok('Başka öğretmen bu olayları göremez (RLS)', evT2 === 0)
  const crT2 = (await db.as('authenticated', T2, 'select count(*)::int n from public.fs_credits')).rows[0].n
  t.ok('Başka öğretmen bu hakları göremez (RLS)', crT2 === 0)

  t.section('Oturum süresi dolması ve bağlantıyı kesme')
  await rpc('service_role', null, `select public.fs_finish_sync($1, 'invalid_grant', true)`, [T1])
  ov = (await rpc('authenticated', T1, 'select public.fs_overview($1) as r', [S1])).r
  t.ok('Belirteç geçersizse durum "yeniden_giris" olur', ov.connection.status === 'yeniden_giris' && ov.events.some((e) => e.kind === 'yeniden_giris'))
  claimed = (await rpc('service_role', null, 'select public.fs_claim_sync() as r')).r
  t.ok('Yeniden giriş bekleyen bağlantı senkrona alınmaz', claimed.length === 0)
  await rpc('service_role', null, `select public.fs_save_connection($1, 'ms-ebeveyn-1', 'RT-YENI', 'AT-2', now() + interval '1 hour')`, [T1])
  claimed = (await rpc('service_role', null, 'select public.fs_claim_sync() as r')).r
  t.ok('Yeniden bağlanınca senkron devam eder (kilit sıfırlandı)', claimed.length === 1 && claimed[0].refresh_token === 'RT-YENI')
  await rpc('service_role', null, 'select public.fs_save_tokens($1, $2, $3, now())', [T1, 'RT-DONDU', 'AT-3'])
  await rpc('service_role', null, 'select public.fs_finish_sync($1)', [T1])
  const conn = (await db.pool.query('select * from public.fs_connections where owner_id = $1', [T1])).rows[0]
  t.ok('Yenilenen belirteç kaydedildi, kilit kalktı, son senkron yazıldı', conn.refresh_token === 'RT-DONDU' && conn.sync_lock_until === null && conn.last_sync_at !== null)
  claimed = (await rpc('service_role', null, `select public.fs_claim_sync() as r`)).r
  t.ok('Az önce senkron olduysa ve iş varsa yine alınır', claimed.length === 1)
  await rpc('service_role', null, 'select public.fs_finish_sync($1)', [T1])
  await db.pool.query(`update public.fs_credits set status = 'iptal' where owner_id = $1 and status = 'hazir'`, [T1])
  claimed = (await rpc('service_role', null, `select public.fs_claim_sync() as r`)).r
  t.ok('Hak yoksa ve yakında senkron olduysa Microsoft\'a hiç gidilmez', claimed.length === 0)
  claimed = (await rpc('service_role', null, `select public.fs_claim_sync($1, true) as r`, [T1])).r
  t.ok('"Şimdi kontrol et" (force) her durumda çalışır', claimed.length === 1)
  await rpc('service_role', null, 'select public.fs_finish_sync($1)', [T1])

  await rpc('authenticated', T1, 'select public.fs_disconnect()')
  const left = (await db.pool.query('select count(*)::int n from public.fs_connections where owner_id = $1', [T1])).rows[0].n
  t.ok('Bağlantıyı kes → belirteç silinir', left === 0)
  ov = (await rpc('authenticated', T1, 'select public.fs_overview($1) as r', [S1])).r
  t.ok('Eşleşme ve geçmiş korunur', ov.link !== null && ov.credits.length > 0)

  t.section('Temizlik / bütünlük')
  await db.as('authenticated', T1, 'delete from public.students where id = $1', [S1])
  const orphan = (await db.pool.query(`select (select count(*) from public.fs_credits where student_id = $1)::int c, (select count(*) from public.fs_links where student_id = $1)::int l`, [S1])).rows[0]
  t.ok('Öğrenci silinince hakları ve eşleşmesi de silinir', orphan.c === 0 && orphan.l === 0)
  await saveStudent(T1, { id: randomUUID(), name: 'Bozuk belge', homeworks: null })
  t.ok('homeworks alanı bozuk/eksik belgeler tetikleyiciyi çökertmez', true)
} catch (e) {
  t.ok('Beklenmeyen hata olmadan tamamlandı', false, e?.stack || String(e))
} finally {
  await db.stop()
}

process.exit(t.summary() === 0 ? 0 : 1)
