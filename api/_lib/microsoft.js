// ------------------------------------------------------------
// Microsoft Family Safety istemcisi (sunucu tarafı)
//
// Microsoft, Family Safety için resmî bir API sunmuyor. Buradaki uç noktalar
// Family Safety Android uygulamasının kullandıklarıdır ve şu açık kaynak
// projelerden doğrulanmıştır:
//   • pantherale0/pyfamilysafety  (Home Assistant entegrasyonunun kütüphanesi)
//   • lifei/pyfamilysafety         (AppScreenTime onayı: "appName" alanı)
//   • ludufre/ms-family-safety     (istek kimliği her sorguda değişir)
//
// Önemli notlar:
//   • Ek süre ancak çocuğun "Daha fazla süre iste" isteği ONAYLANARAK verilebilir.
//   • "extension" milisaniyedir (60 dk = 3.600.000). pyfamilysafety'deki
//     "* 100" dönüşümü hatalıdır (60 dk yerine 6 dk verir) — burada doğru hesaplanır.
//   • Bekleyen isteğin "id" alanı her sorguda yenilenir; onay, istekleri getiren
//     sorgunun hemen ardından o sorgudaki id ile yapılmalıdır.
// ------------------------------------------------------------

export const MS_CLIENT_ID = '000000000004893A'
export const MS_SCOPE = 'service::familymobile.microsoft.com::MBI_SSL'
export const MS_REDIRECT_URL = 'https://login.live.com/oauth20_desktop.srf'

// Testlerde sahte sunucuya yönlendirmek için ortam değişkeniyle değiştirilebilir
const loginBase = () => (process.env.FS_LOGIN_BASE || 'https://login.live.com').replace(/\/$/, '')
const apiBase = () =>
  (process.env.FS_API_BASE || 'https://mobileaggregator.family.microsoft.com/api').replace(/\/$/, '')

// Family Safety uygulamasının gönderdiği kimlik bilgileri (bot korumasına takılmamak için)
const AUTH_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 13; Pixel 4 XL Build/TQ3A.230705.001.B4; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/115.0.5790.166 Mobile Safari/537.36'
const API_USER_AGENT = 'Family Safety-prod/(v 2.0.6.1139) Android/33 google/Pixel 4 XL'
const TIMEOUT_MS = 15000

export class MicrosoftError extends Error {
  constructor(message, { status = 0, code = '', reauth = false, detail = '' } = {}) {
    super(message)
    this.name = 'MicrosoftError'
    this.status = status
    this.code = code
    this.reauth = reauth // true → yenileme belirteci geçersiz, yeniden giriş gerekir
    this.detail = detail
  }
}

export function loginUrl() {
  const params = new URLSearchParams({
    cobrandid: 'b5d15d4b-695a-4cd5-93c6-13f551b310df',
    client_id: MS_CLIENT_ID,
    response_type: 'code',
    redirect_uri: MS_REDIRECT_URL,
    response_mode: 'query',
    scope: MS_SCOPE,
    lw: '1',
    fl: 'easi2',
    login_hint: '',
  })
  return `https://login.live.com/oauth20_authorize.srf?${params}`
}

/** Yapıştırılan yönlendirme adresinden (…oauth20_desktop.srf?code=…) kodu çıkarır. */
export function extractCode(input) {
  const text = String(input ?? '').trim()
  if (!text) throw new MicrosoftError('Adres boş. Giriş sonrası açılan sayfanın adresini yapıştırın.')
  if (/^https?:\/\//i.test(text)) {
    let url
    try {
      url = new URL(text)
    } catch {
      throw new MicrosoftError('Yapıştırılan adres okunamadı.')
    }
    const error = url.searchParams.get('error')
    if (error) {
      const description = url.searchParams.get('error_description') || error
      throw new MicrosoftError(`Microsoft girişi tamamlanmadı: ${description}`)
    }
    const code = url.searchParams.get('code')
    if (!code) {
      throw new MicrosoftError(
        'Adreste "code=" bulunamadı. Giriş tamamlandıktan sonra açılan BOŞ sayfanın adresini kopyalayın.'
      )
    }
    return code
  }
  // Yalnızca kodun kendisi yapıştırılmış olabilir (ör. M.C5_BAY.2.U.xxxx)
  if (/^[\w.!*$~-]{10,}$/.test(text)) return text
  throw new MicrosoftError('Geçersiz adres. Adres çubuğundaki adresin TAMAMINI kopyalayın.')
}

async function timedFetch(url, options) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } catch (e) {
    const reason = e?.name === 'AbortError' ? 'zaman aşımı' : e?.cause?.code || e?.message || 'bağlantı hatası'
    throw new MicrosoftError(`Microsoft sunucusuna ulaşılamadı (${reason})`)
  } finally {
    clearTimeout(timer)
  }
}

async function tokenRequest(params) {
  const body = new URLSearchParams({ client_id: MS_CLIENT_ID, scope: MS_SCOPE, ...params })
  const res = await timedFetch(`${loginBase()}/oauth20_token.srf`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': AUTH_USER_AGENT,
      'X-Requested-With': 'com.microsoft.familysafety',
    },
    body,
  })
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    /* HTML hata sayfası olabilir */
  }
  if (!res.ok || !json?.access_token) {
    const code = json?.error || `http_${res.status}`
    const reauth = ['invalid_grant', 'interaction_required', 'invalid_client', 'unauthorized_client'].includes(code)
    const message =
      params.grant_type === 'authorization_code'
        ? 'Giriş kodu geçersiz veya süresi dolmuş. Giriş adımını baştan yapıp yeni adresi hemen yapıştırın.'
        : reauth
          ? 'Microsoft oturumunun süresi dolmuş; yeniden giriş yapılmalı.'
          : `Microsoft oturumu yenilenemedi (${code}).`
    throw new MicrosoftError(message, {
      status: res.status,
      code,
      reauth: reauth && params.grant_type === 'refresh_token',
      detail: json?.error_description || text.slice(0, 300),
    })
  }
  return {
    accessToken: json.access_token,
    // Microsoft her yenilemede yeni bir yenileme belirteci döner; dönmezse eskisi geçerlidir
    refreshToken: json.refresh_token || params.refresh_token || '',
    expiresAt: new Date(Date.now() + (Number(json.expires_in) || 3600) * 1000),
    userId: json.user_id ? String(json.user_id) : '',
  }
}

export const exchangeCode = (code) =>
  tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: MS_REDIRECT_URL })

export const refreshTokens = (refreshToken) =>
  tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken })

// Büyük sayısal kimlikleri (puid / üye id) JSON.parse'ın hassasiyet kaybından korur
function parseJsonKeepingIds(text, keys) {
  const pattern = new RegExp(`"(${keys.join('|')})"\\s*:\\s*(-?\\d{15,})`, 'g')
  return JSON.parse(text.replace(pattern, '"$1":"$2"'))
}

async function apiRequest(accessToken, method, path, { body, idKeys = [] } = {}) {
  const res = await timedFetch(`${apiBase()}${path}`, {
    method,
    headers: {
      Authorization: `MSAuth1.0 usertoken="${accessToken}", type="MSACT"`,
      'User-Agent': API_USER_AGENT,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body == null ? undefined : JSON.stringify(body),
  })
  const text = res.status === 204 ? '' : await res.text()
  if (!res.ok) {
    throw new MicrosoftError(`Family Safety isteği başarısız (HTTP ${res.status})`, {
      status: res.status,
      code: `http_${res.status}`,
      detail: text.slice(0, 300),
    })
  }
  let json = null
  if (text) {
    try {
      json = idKeys.length ? parseJsonKeepingIds(text, idKeys) : JSON.parse(text)
    } catch {
      json = null
    }
  }
  return { status: res.status, json }
}

/** Ailedeki üyeler. Family Safety açık olanlar (çocuklar) önce gelir. */
export async function getFamilyMembers(accessToken) {
  const { json } = await apiRequest(accessToken, 'GET', '/v2/roster', { idKeys: ['id'] })
  const members = Array.isArray(json?.members) ? json.members : []
  const list = members.map((m) => {
    const first = m?.user?.firstName || ''
    const last = m?.user?.lastName || ''
    return {
      id: String(m?.id ?? ''),
      name: `${first} ${last}`.trim() || m?.user?.accountPrimaryAlias || 'İsimsiz üye',
      role: String(m?.role ?? ''),
      monitored: m?.isDigitalSafetyEnabled === true,
    }
  })
  return list.filter((m) => m.id).sort((a, b) => Number(b.monitored) - Number(a.monitored))
}

/** Bekleyen "daha fazla süre" istekleri (cihaz + uygulama). */
export async function getPendingRequests(accessToken) {
  const { json } = await apiRequest(accessToken, 'GET', '/v1/PendingRequests', { idKeys: ['puid'] })
  const list = Array.isArray(json?.pendingRequests) ? json.pendingRequests : []
  return list
    .filter((r) => r && r.puid != null && r.type)
    .filter((r) => r.type === 'DeviceScreenTime' || r.type === 'AppScreenTime')
    .map((r) => ({ ...r, puid: String(r.puid) }))
}

/**
 * Bir isteğin sorgular arasında DEĞİŞMEYEN anahtarı.
 * (Microsoft'un verdiği "id" her sorguda yenilenir, o yüzden kullanılamaz.)
 */
export function requestKey(r) {
  return [r.puid, r.type, r.platform, r.requestedTime, r.appName || '']
    .map((v) => String(v ?? '').trim().toLowerCase())
    .join('|')
}

export const isAppRequest = (r) => r?.type === 'AppScreenTime'

/** İsteği onaylar ve `minutes` dakika ek süre verir. */
export async function approveRequest(accessToken, r, minutes) {
  const body = {
    type: r.type,
    id: r.id,
    request: {
      appId: r.id,
      lockTime: r.lockTime ?? null,
      appName: r.appName ?? null,
      extension: Math.round(Number(minutes) * 60 * 1000), // milisaniye
      platform: r.platform ?? null,
      // Cihaz isteklerinde alan yoksa true gönderilir (pyfamilysafety ile aynı)
      isGlobal: r.isGlobal ?? (isAppRequest(r) ? null : true),
      requestedTime: r.requestedTime ?? null,
    },
  }
  const { status } = await apiRequest(
    accessToken,
    'POST',
    `/v1/pendingRequests/approve/${encodeURIComponent(r.puid)}`,
    { body }
  )
  return status
}
