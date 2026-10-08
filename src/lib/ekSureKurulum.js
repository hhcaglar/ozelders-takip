// Ek Süre (Microsoft Family Safety) için saf yardımcılar.
// Bu dosya tarayıcıya özgü hiçbir şey içe aktarmaz; Node testlerinde de kullanılır.

const LOGIN_PARAMS = new URLSearchParams({
  cobrandid: 'b5d15d4b-695a-4cd5-93c6-13f551b310df',
  client_id: '000000000004893A',
  response_type: 'code',
  redirect_uri: 'https://login.live.com/oauth20_desktop.srf',
  response_mode: 'query',
  scope: 'service::familymobile.microsoft.com::MBI_SSL',
  lw: '1',
  fl: 'easi2',
  login_hint: '',
})

/** Family Safety uygulamasının giriş sayfası (yalnızca Family Safety yetkisi istenir). */
export const MS_LOGIN_URL = `https://login.live.com/oauth20_authorize.srf?${LOGIN_PARAMS}`

/** Zamanlayıcı ile Vercel arasında paylaşılan gizli anahtar (yalnızca harf ve rakam). */
export function generateSecret(length = 40) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const bytes = new Uint8Array(length)
  globalThis.crypto.getRandomValues(bytes)
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join('')
}

const sqlString = (value) => String(value).replace(/'/g, "''")

/** supabase/ek-sure-zamanlayici.sql şablonunu site adresi ve anahtarla doldurur. */
export function fillSchedulerSql(template, siteUrl, secret) {
  const url = String(siteUrl || '').trim().replace(/\/+$/, '')
  return template
    .replace("'__SITE_ADRESI__'", `'${sqlString(url)}'`)
    .replace("'__GIZLI_ANAHTAR__'", `'${sqlString(secret)}'`)
}

// ---------------- Biçimlendirme ----------------

export const CREDIT_STATUS = {
  hazir: { label: 'Hazır', bg: '#FFF4DC', fg: '#8A5A00' },
  ayrildi: { label: 'Onaylanıyor…', bg: '#EAF0F7', fg: '#1E3A5F' },
  kullanildi: { label: 'Kullanıldı', bg: '#E5F4EA', fg: '#1F7A44' },
  iptal: { label: 'İptal', bg: '#F1F3F5', fg: '#6B7684' },
}

export function formatDateTime(iso) {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

/** "az önce", "5 dk önce", "3 sa önce", "2 gün önce" */
export function timeAgo(iso, now = Date.now()) {
  if (!iso) return 'hiç'
  const diff = Math.max(0, now - new Date(iso).getTime())
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'az önce'
  if (min < 60) return `${min} dk önce`
  const hours = Math.floor(min / 60)
  if (hours < 24) return `${hours} sa önce`
  return `${Math.floor(hours / 24)} gün önce`
}

export const minutesLabel = (m) => (m % 60 === 0 ? `${m / 60} saat` : `${m} dk`)

// ---------------- Önizleme (yerel mod) ----------------

/**
 * Supabase bağlı değilken (yerel mod) sekmenin nasıl görüneceğini göstermek
 * için örnek veri üretir. Hiçbir şey kaydedilmez, Microsoft'a gidilmez.
 */
export function demoOverview(student, now = new Date()) {
  const delivered = (student?.homeworks || []).filter((h) => h.status === 'teslim')
  const iso = (minutesAgo) => new Date(now.getTime() - minutesAgo * 60000).toISOString()
  const credits = delivered.map((h, i) => ({
    id: i + 1,
    homework_id: h.id,
    title: h.title,
    minutes: 60,
    status: i === 0 ? 'kullanildi' : 'hazir',
    note: null,
    request_type: i === 0 ? 'AppScreenTime' : null,
    app_name: i === 0 ? 'Minecraft' : null,
    created_at: iso(60 * 26 + i),
    reserved_at: i === 0 ? iso(60 * 20) : null,
    used_at: i === 0 ? iso(60 * 20) : null,
  }))
  const firstName = (student?.name || 'Öğrenci').split(' ')[0]
  return {
    demo: true,
    connection: { ms_user_id: 'ornek', status: 'ok', last_error: null, last_sync_at: iso(1), created_at: iso(60 * 24 * 5) },
    link: {
      ms_child_id: 'ornek-cocuk',
      ms_child_name: student?.name || 'Öğrenci',
      enabled: true,
      minutes_per_credit: 60,
      daily_max: 1,
      request_scope: 'hepsi',
      app_filter: '',
    },
    credits: credits.reverse(),
    by_homework: Object.fromEntries(credits.map((c) => [c.homework_id, { status: c.status, minutes: c.minutes }])),
    available: credits.filter((c) => c.status === 'hazir').length,
    used_today: 0,
    used_total: credits.filter((c) => c.status === 'kullanildi').length,
    waiting_total: credits.filter((c) => c.status === 'hazir').length,
    events: [
      ...(credits.some((c) => c.status === 'kullanildi')
        ? [{ id: 2, kind: 'onay', message: `"Minecraft" uygulaması için +60 dk onaylandı — hak: ${delivered[0]?.title || 'ödev'}`, created_at: iso(60 * 20), student_id: student?.id }]
        : []),
      { id: 1, kind: 'baglanti', message: 'Microsoft hesabı bağlandı', created_at: iso(60 * 24 * 5), student_id: null },
    ],
    demoMembers: [
      { id: 'ornek-cocuk', name: student?.name || firstName, role: 'User', monitored: true },
      { id: 'ornek-ebeveyn', name: 'Ebeveyn', role: 'Admin', monitored: false },
    ],
    server_time: now.toISOString(),
  }
}
