// ------------------------------------------------------------
// Ek süre senkronu: bekleyen Family Safety isteklerini, öğrencinin
// ödev hakları varsa otomatik onaylar.
//
// Her bağlantı (öğretmen) için:
//   1. Gerekirse Microsoft erişim belirtecini yeniler ve kaydeder.
//   2. Eşleşmiş çocukların bekleyen "daha fazla süre" isteklerini çeker.
//   3. Her istek için veritabanında hak AYIRIR (günlük sınır ve "bir kez"
//      kuralı veritabanında, kilitli olarak denetlenir), sonra onaylar.
//   4. Onay başarılıysa hak "kullanıldı" olur; başarısızsa geri verilir.
// ------------------------------------------------------------
import * as microsoft from './microsoft.js'

const REFRESH_MARGIN_MS = 2 * 60 * 1000

function describeRequest(r) {
  if (microsoft.isAppRequest(r)) return r.appName ? `"${r.appName}" uygulaması` : 'Uygulama süresi'
  return 'Ekran süresi'
}

function appMatches(appName, filter) {
  const terms = String(filter || '')
    .split(',')
    .map((t) => t.trim().toLocaleLowerCase('tr-TR'))
    .filter(Boolean)
  if (!terms.length) return true
  const name = String(appName || '').toLocaleLowerCase('tr-TR')
  return terms.some((t) => name.includes(t))
}

/** İstek, eşleşmenin kapsam/uygulama filtresine uyuyor mu? Uymuyorsa nedenini döner. */
export function scopeRejection(link, r) {
  const kind = microsoft.isAppRequest(r) ? 'uygulama' : 'cihaz'
  if (link.request_scope === 'cihaz' && kind !== 'cihaz') return 'yalnızca ekran süresi istekleri onaylanıyor'
  if (link.request_scope === 'uygulama' && kind !== 'uygulama') return 'yalnızca uygulama istekleri onaylanıyor'
  if (kind === 'uygulama' && !appMatches(r.appName, link.app_filter)) {
    return `uygulama filtresine (${link.app_filter}) uymuyor`
  }
  return null
}

async function ensureAccessToken({ db, ms, target, force = false }) {
  const expires = target.access_expires_at ? new Date(target.access_expires_at).getTime() : 0
  if (!force && target.access_token && expires - Date.now() > REFRESH_MARGIN_MS) {
    return target.access_token
  }
  const tokens = await ms.refreshTokens(target.refresh_token)
  await db.rpc('fs_save_tokens', {
    p_owner: target.owner_id,
    p_refresh_token: tokens.refreshToken,
    p_access_token: tokens.accessToken,
    p_expires_at: tokens.expiresAt.toISOString(),
  })
  target.refresh_token = tokens.refreshToken || target.refresh_token
  target.access_token = tokens.accessToken
  target.access_expires_at = tokens.expiresAt.toISOString()
  return tokens.accessToken
}

async function syncConnection({ db, ms, target }) {
  const owner = target.owner_id
  const report = { owner, approved: [], waiting: [], error: null }
  let reauth = false

  try {
    let accessToken = await ensureAccessToken({ db, ms, target })

    const links = (await db.rpc('fs_links_for_sync', { p_owner: owner })) || []
    // Hakkı olan çocuk yoksa Microsoft'a istek atmaya gerek yok (yalnızca belirteç tazelendi)
    if (!links.some((l) => Number(l.available) > 0)) return report

    let pending
    try {
      pending = await ms.getPendingRequests(accessToken)
    } catch (e) {
      if (e?.status !== 401) throw e
      accessToken = await ensureAccessToken({ db, ms, target, force: true })
      pending = await ms.getPendingRequests(accessToken)
    }

    const byChild = new Map(links.map((l) => [String(l.ms_child_id), l]))
    const pendingKeys = []

    for (const request of pending) {
      const link = byChild.get(String(request.puid))
      if (!link) continue // eşleşmemiş aile üyesi (ör. kardeş) — dokunulmaz
      const key = ms.requestKey(request)
      pendingKeys.push(key)
      const what = describeRequest(request)

      const rejection = scopeRejection(link, request)
      if (rejection) {
        report.waiting.push({ student: link.student_name, what, reason: 'kapsam' })
        await db.rpc('fs_log', {
          p_owner: owner,
          p_student: link.student_id,
          p_kind: 'bekletildi',
          p_message: `${what} isteği size bırakıldı: ${rejection}.`,
          p_request_key: key,
        })
        continue
      }

      const reservation = await db.rpc('fs_reserve_credit', {
        p_owner: owner,
        p_child_id: String(request.puid),
        p_request_key: key,
        p_request_type: request.type,
        p_app_name: request.appName ?? null,
      })

      if (reservation?.result === 'ok') {
        try {
          await ms.approveRequest(accessToken, request, reservation.minutes)
          await db.rpc('fs_finish_credit', { p_credit: reservation.credit_id, p_success: true })
          report.approved.push({ student: link.student_name, what, minutes: reservation.minutes })
          await db.rpc('fs_log', {
            p_owner: owner,
            p_student: reservation.student_id,
            p_kind: 'onay',
            p_message: `${what} için +${reservation.minutes} dk onaylandı — hak: ${reservation.title || 'ödev'}`,
            p_request_key: key,
          })
        } catch (e) {
          await db.rpc('fs_finish_credit', {
            p_credit: reservation.credit_id,
            p_success: false,
            p_error: e?.message || 'Onay başarısız',
          })
          await db.rpc('fs_log', {
            p_owner: owner,
            p_student: reservation.student_id,
            p_kind: 'hata',
            p_message: `${what} isteği onaylanamadı, hak geri verildi: ${e?.message || 'bilinmeyen hata'}`,
            p_request_key: null,
          })
          if (e?.status === 401) throw e
        }
      } else if (reservation?.result === 'daily_limit') {
        report.waiting.push({ student: link.student_name, what, reason: 'gunluk_sinir' })
        await db.rpc('fs_log', {
          p_owner: owner,
          p_student: reservation.student_id,
          p_kind: 'bekletildi',
          p_message: `${what} isteği geldi ama bugünkü ek süre hakkı kullanıldı (günde en fazla ${reservation.daily_max}). İstek size bırakıldı; kalan haklar yarın kullanılabilir.`,
          p_request_key: key,
        })
      } else if (reservation?.result === 'no_credit') {
        report.waiting.push({ student: link.student_name, what, reason: 'hak_yok' })
        await db.rpc('fs_log', {
          p_owner: owner,
          p_student: reservation.student_id,
          p_kind: 'bekletildi',
          p_message: `${what} isteği geldi ama kullanılabilir ek süre hakkı yok. İstek size bırakıldı.`,
          p_request_key: key,
        })
      }
      // already_used / disabled / not_linked → sessizce geç
    }

    await db.rpc('fs_reconcile', { p_owner: owner, p_pending_keys: pendingKeys })
  } catch (e) {
    reauth = Boolean(e?.reauth)
    report.error = e?.message || 'Bilinmeyen hata'
  } finally {
    await db.rpc('fs_finish_sync', { p_owner: owner, p_error: report.error, p_reauth: reauth }).catch(() => {})
  }
  return report
}

/**
 * Senkronu çalıştırır.
 * @param owner  yalnızca bu öğretmen (null = tüm bağlantılar, zamanlayıcı çağrısı)
 * @param force  hak olmasa bile kontrol et ("Şimdi kontrol et" düğmesi)
 */
export async function runSync({ db, ms = microsoft, owner = null, force = false }) {
  const targets = (await db.rpc('fs_claim_sync', { p_owner: owner, p_force: force })) || []
  const reports = []
  for (const target of targets) {
    reports.push(await syncConnection({ db, ms, target }))
  }
  return {
    baglanti: reports.length,
    onaylanan: reports.reduce((n, r) => n + r.approved.length, 0),
    bekletilen: reports.reduce((n, r) => n + r.waiting.length, 0),
    hatalar: reports.filter((r) => r.error).map((r) => r.error),
    ayrinti: owner ? reports : undefined,
  }
}
