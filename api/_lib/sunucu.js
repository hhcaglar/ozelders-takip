// Vercel sunucu fonksiyonları için ortak yardımcılar
import { createClient } from '@supabase/supabase-js'

export function config() {
  return {
    supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
    // Eski "service_role" (eyJ…) ya da yeni "secret" (sb_secret_…) anahtarı.
    // ASLA VITE_ ile başlayan bir değişkene koymayın — tarayıcıya gömülür.
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '',
    cronSecret: process.env.AILE_SENKRON_ANAHTARI || '',
  }
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

let cachedAdmin = null
let cachedKey = ''

export function adminClient() {
  const { supabaseUrl, serviceKey } = config()
  if (!supabaseUrl || !serviceKey) {
    throw new HttpError(
      503,
      'Sunucu ayarları eksik: Vercel\'de SUPABASE_SERVICE_ROLE_KEY ortam değişkeni tanımlı değil.'
    )
  }
  const key = `${supabaseUrl}|${serviceKey}`
  if (!cachedAdmin || cachedKey !== key) {
    cachedAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
    cachedKey = key
  }
  return cachedAdmin
}

/** Supabase RPC çağrısı (service_role) — hata varsa fırlatır. */
export function database(client = adminClient()) {
  return {
    async rpc(name, args = {}) {
      const { data, error } = await client.rpc(name, args)
      if (error) {
        const missing = error.code === 'PGRST202' || /could not find the function/i.test(error.message || '')
        throw new HttpError(
          missing ? 503 : 500,
          missing
            ? 'Veritabanında Ek Süre fonksiyonları yok: supabase/schema.sql dosyasını SQL Editor\'de yeniden çalıştırın.'
            : `Veritabanı hatası (${name}): ${error.message}`
        )
      }
      return data
    },
  }
}

function bearer(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || ''
  return header.startsWith('Bearer ') ? header.slice(7).trim() : ''
}

/** İstek, giriş yapmış bir ÖĞRETMEN oturumuyla mı geldi? Kullanıcıyı döner. */
export async function requireTeacher(req, client = adminClient()) {
  const jwt = bearer(req)
  if (!jwt) throw new HttpError(401, 'Oturum bulunamadı — lütfen yeniden giriş yapın.')
  const { data, error } = await client.auth.getUser(jwt)
  const user = data?.user
  if (error || !user) throw new HttpError(401, 'Oturumun süresi dolmuş — lütfen yeniden giriş yapın.')
  if (user.user_metadata?.role === 'veli') {
    throw new HttpError(403, 'Bu işlem yalnızca öğretmen hesabıyla yapılabilir.')
  }
  return user
}

/** Zamanlayıcı (pg_cron) çağrısı mı? Gizli anahtar sabit sürede karşılaştırılır. */
export function isCronRequest(req) {
  const { cronSecret } = config()
  const token = bearer(req)
  if (!cronSecret || !token || token.length !== cronSecret.length) return false
  let diff = 0
  for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ cronSecret.charCodeAt(i)
  return diff === 0
}

export async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body || '{}')
    } catch {
      throw new HttpError(400, 'Geçersiz istek gövdesi.')
    }
  }
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const text = Buffer.concat(chunks).toString('utf8')
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    throw new HttpError(400, 'Geçersiz istek gövdesi.')
  }
}

export function send(res, status, payload) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(payload))
}

/** Ortak hata yakalayıcı: beklenen hatalar Türkçe mesajla, diğerleri genel mesajla döner. */
export function handler(methods, fn) {
  return async (req, res) => {
    try {
      if (!methods.includes(req.method)) {
        res.setHeader('Allow', methods.join(', '))
        return send(res, 405, { hata: 'Bu yöntem desteklenmiyor.' })
      }
      const out = await fn(req, res)
      if (!res.writableEnded) send(res, 200, out ?? { ok: true })
    } catch (e) {
      const status = e instanceof HttpError ? e.status : e?.name === 'MicrosoftError' ? 400 : 500
      if (status >= 500) console.error('[aile]', e)
      send(res, status, {
        hata: e?.message || 'Beklenmeyen bir hata oluştu.',
        ...(e?.name === 'MicrosoftError' && e.code ? { kod: e.code } : {}),
      })
    }
  }
}
