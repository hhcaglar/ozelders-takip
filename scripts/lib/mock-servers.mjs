// Test için sahte Microsoft Family Safety ve sahte Supabase (PostgREST RPC + Auth) sunucuları.
import http from 'node:http'
import { randomUUID } from 'node:crypto'

function listen(server) {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)))
}

async function readBody(req) {
  const chunks = []
  for await (const c of req) chunks.push(c)
  return Buffer.concat(chunks).toString('utf8')
}

function sendJson(res, status, obj, rawText) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(rawText ?? JSON.stringify(obj))
}

// ------------------------------------------------------------
// Sahte Microsoft — gerçek API'nin bilinen tuhaflıklarını taklit eder:
//  • bekleyen isteklerin id'si HER sorguda değişir
//  • puid JSON'da büyük SAYI olarak gelir (2^53 üstü hassasiyet testi)
//  • giriş kodu tek kullanımlıktır, yenileme belirteci her seferinde döner
// ------------------------------------------------------------
export async function startMockMicrosoft() {
  const state = {
    codes: new Set(['KOD-IYI']),
    refreshTokens: new Set(),
    accessTokens: new Set(),
    rejectRefresh: false,
    failApprove: false,
    members: [
      { id: '9007199254740993', firstName: 'Elif', lastName: 'Demir', role: 'User', monitored: true },
      { id: '1055519684390826', firstName: 'Ayşe', lastName: 'Demir', role: 'Admin', monitored: false },
      { id: '777000111222333', firstName: 'Can', lastName: 'Demir', role: 'User', monitored: true },
    ],
    pending: [], // { key, puid, type, platform, requestedTime, lockTime, appName?, isGlobal?, currentId }
    approvals: [],
    calls: { token: 0, refresh: 0, roster: 0, pending: 0, approve: 0 },
    errors: [],
  }
  let counter = 0
  const issue = () => {
    counter++
    const at = `AT-${counter}`
    const rt = `RT-${counter}`
    state.accessTokens.add(at)
    state.refreshTokens.add(rt)
    return { access_token: at, refresh_token: rt, expires_in: 3600, token_type: 'bearer', user_id: 'ebeveyn-123' }
  }
  const authOk = (req) => {
    const m = /^MSAuth1\.0 usertoken="([^"]+)", type="MSACT"$/.exec(req.headers.authorization || '')
    return m && state.accessTokens.has(m[1])
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://ms')
    const body = await readBody(req)
    try {
      if (req.method === 'POST' && url.pathname === '/oauth20_token.srf') {
        state.calls.token++
        const f = new URLSearchParams(body)
        if (f.get('client_id') !== '000000000004893A' || f.get('scope') !== 'service::familymobile.microsoft.com::MBI_SSL') {
          return sendJson(res, 400, { error: 'invalid_client' })
        }
        if (f.get('grant_type') === 'authorization_code') {
          if (f.get('redirect_uri') !== 'https://login.live.com/oauth20_desktop.srf' || !state.codes.has(f.get('code'))) {
            return sendJson(res, 400, { error: 'invalid_grant', error_description: 'The provided value for the code is not valid.' })
          }
          state.codes.delete(f.get('code')) // tek kullanımlık
          return sendJson(res, 200, issue())
        }
        if (f.get('grant_type') === 'refresh_token') {
          state.calls.refresh++
          if (state.rejectRefresh || !state.refreshTokens.has(f.get('refresh_token'))) {
            return sendJson(res, 400, { error: 'invalid_grant', error_description: 'The refresh token has expired.' })
          }
          return sendJson(res, 200, issue())
        }
        return sendJson(res, 400, { error: 'unsupported_grant_type' })
      }

      if (!url.pathname.startsWith('/api/')) return sendJson(res, 404, {})
      if (!authOk(req)) return sendJson(res, 401, { message: 'Unauthorized' })
      if (req.headers['user-agent']?.startsWith('Family Safety-prod/') !== true) {
        state.errors.push('API User-Agent yanlış')
      }

      if (req.method === 'GET' && url.pathname === '/api/v2/roster') {
        state.calls.roster++
        // id'ler bilerek tırnaksız (sayı) yazılır
        const members = state.members
          .map(
            (m) =>
              `{"id":${m.id},"role":"${m.role}","isDigitalSafetyEnabled":${m.monitored},"profilePicUrl":"",` +
              `"user":{"firstName":"${m.firstName}","lastName":"${m.lastName}","accountPrimaryAlias":"x@y.com"}}`
          )
          .join(',')
        return sendJson(res, 200, null, `{"members":[${members}]}`)
      }

      if (req.method === 'GET' && url.pathname === '/api/v1/PendingRequests') {
        state.calls.pending++
        const items = state.pending.map((p) => {
          p.currentId = `istek-${randomUUID()}` // her sorguda YENİ id
          const extra = {}
          if (p.appName !== undefined) extra.appName = p.appName
          if (p.isGlobal !== undefined) extra.isGlobal = p.isGlobal
          const json = JSON.stringify({
            id: p.currentId,
            puid: '__PUID__',
            type: p.type,
            platform: p.platform,
            requestedTime: p.requestedTime,
            lockTime: p.lockTime,
            ...extra,
          })
          return json.replace('"__PUID__"', String(p.puid)) // puid sayı olarak
        })
        return sendJson(res, 200, null, `{"pendingRequests":[${items.join(',')}]}`)
      }

      const approve = /^\/api\/v1\/pendingRequests\/approve\/([^/]+)$/.exec(url.pathname)
      if (req.method === 'POST' && approve) {
        state.calls.approve++
        if (state.failApprove) return sendJson(res, 500, { message: 'Something went wrong in the Aggregator service' })
        const b = JSON.parse(body)
        const p = state.pending.find((x) => x.currentId === b.id)
        if (!p) return sendJson(res, 404, { message: 'Request not found (eski id kullanıldı)' })
        const problems = []
        if (decodeURIComponent(approve[1]) !== String(p.puid)) problems.push('URL puid yanlış')
        if (b.type !== p.type) problems.push('type yanlış')
        if (b.request?.appId !== b.id) problems.push('appId istek id olmalı')
        if (typeof b.request?.extension !== 'number') problems.push('extension sayı olmalı')
        if (p.type === 'AppScreenTime' && b.request?.appName !== p.appName) problems.push('appName eksik/yanlış')
        if (b.request?.requestedTime !== p.requestedTime || b.request?.lockTime !== p.lockTime) problems.push('zaman alanları yanlış')
        if (b.request?.platform !== p.platform) problems.push('platform yanlış')
        if (problems.length) return sendJson(res, 400, { message: problems.join(', ') })
        state.approvals.push({ key: p.key, body: b })
        state.pending = state.pending.filter((x) => x !== p)
        res.statusCode = 204
        return res.end()
      }
      return sendJson(res, 404, {})
    } catch (e) {
      state.errors.push(String(e))
      return sendJson(res, 500, { message: String(e) })
    }
  })

  const port = await listen(server)
  return {
    state,
    url: `http://127.0.0.1:${port}`,
    addRequest(r) {
      state.pending.push({ key: r.key || randomUUID(), lockTime: '2026-10-08T19:00:00+03:00', platform: 'Windows', ...r })
    },
    expireAccessTokens() {
      state.accessTokens.clear()
    },
    close: () => new Promise((r) => server.close(r)),
  }
}

// ------------------------------------------------------------
// Sahte Supabase: /auth/v1/user ve /rest/v1/rpc/:fn
// Her RPC, isteğin anahtarına göre gerçek PostgreSQL rolüyle çalışır
// (service_role / authenticated / anon) — yetki hataları da gerçektir.
// ------------------------------------------------------------
export function makeJwt(sub, meta = {}) {
  const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${enc({ alg: 'none' })}.${enc({ sub, role: 'authenticated', user_metadata: meta })}.test`
}

function decodeJwt(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
    return payload?.sub ? payload : null
  } catch {
    return null
  }
}

export async function startMockSupabase({ db, serviceKey }) {
  const calls = []
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://sb')
    const bearer = (req.headers.authorization || '').replace(/^Bearer /, '')
    const apikey = req.headers.apikey || ''
    const body = await readBody(req)

    if (req.method === 'GET' && url.pathname === '/auth/v1/user') {
      const p = decodeJwt(bearer)
      if (!p) return sendJson(res, 401, { code: 401, msg: 'invalid JWT' })
      return sendJson(res, 200, { id: p.sub, aud: 'authenticated', role: 'authenticated', email: `${p.sub}@ornek.com`, user_metadata: p.user_metadata || {}, app_metadata: {} })
    }

    const m = /^\/rest\/v1\/rpc\/([a-z_0-9]+)$/.exec(url.pathname)
    if (req.method === 'POST' && m) {
      const fn = m[1]
      let role = 'anon'
      let uid = null
      if (bearer === serviceKey || (!bearer && apikey === serviceKey)) role = 'service_role'
      else if (decodeJwt(bearer)) {
        role = 'authenticated'
        uid = decodeJwt(bearer).sub
      }
      calls.push({ fn, role })
      const args = body ? JSON.parse(body) : {}
      const names = Object.keys(args)
      const sql = `select public.${fn}(${names.map((n, i) => `${n} => $${i + 1}`).join(', ')}) as r`
      try {
        const result = await db.as(role, uid, sql, names.map((n) => args[n]))
        const value = result.rows[0]?.r
        if (value === '' || value === undefined) {
          res.statusCode = 204
          return res.end()
        }
        return sendJson(res, 200, value)
      } catch (e) {
        if (e.code === '42883') return sendJson(res, 404, { code: 'PGRST202', message: `Could not find the function public.${fn}` })
        const status = e.code === '42501' ? (role === 'anon' ? 401 : 403) : 400
        return sendJson(res, status, { code: e.code, message: e.message, details: null, hint: null })
      }
    }
    return sendJson(res, 404, { message: 'mock: bilinmeyen yol' })
  })
  const port = await listen(server)
  return { url: `http://127.0.0.1:${port}`, calls, close: () => new Promise((r) => server.close(r)) }
}
