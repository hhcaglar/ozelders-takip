// GET /api/aile-cocuklar — bağlı Microsoft ailesindeki üyeleri listeler (öğretmen oturumu gerekir).
import { adminClient, database, handler, requireTeacher, HttpError } from './_lib/sunucu.js'
import { getFamilyMembers, refreshTokens } from './_lib/microsoft.js'

export default handler(['GET'], async (req) => {
  const client = adminClient()
  const user = await requireTeacher(req, client)
  const db = database(client)

  const conn = await db.rpc('fs_get_connection', { p_owner: user.id })
  if (!conn) throw new HttpError(404, 'Önce Microsoft hesabını bağlayın.')
  if (conn.status !== 'ok') throw new HttpError(409, 'Microsoft oturumunun süresi dolmuş; yeniden giriş yapın.')

  let accessToken = conn.access_token
  const expires = conn.access_expires_at ? new Date(conn.access_expires_at).getTime() : 0
  if (!accessToken || expires - Date.now() < 2 * 60 * 1000) {
    try {
      const tokens = await refreshTokens(conn.refresh_token)
      accessToken = tokens.accessToken
      await db.rpc('fs_save_tokens', {
        p_owner: user.id,
        p_refresh_token: tokens.refreshToken,
        p_access_token: tokens.accessToken,
        p_expires_at: tokens.expiresAt.toISOString(),
      })
    } catch (e) {
      if (e?.reauth) {
        await db.rpc('fs_finish_sync', { p_owner: user.id, p_error: e.message, p_reauth: true })
      }
      throw e
    }
  }

  return { uyeler: await getFamilyMembers(accessToken) }
})
