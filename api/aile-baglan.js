// POST /api/aile-baglan  { adres }  — öğretmen oturumu gerekir.
// Microsoft girişinden sonra açılan boş sayfanın adresindeki kodu belirtece
// çevirir, belirteci veritabanına (yalnızca sunucunun okuyabildiği tabloya)
// kaydeder ve ailedeki üyeleri döner.
import { adminClient, database, handler, readJson, requireTeacher, HttpError } from './_lib/sunucu.js'
import { exchangeCode, extractCode, getFamilyMembers } from './_lib/microsoft.js'

export default handler(['POST'], async (req) => {
  const client = adminClient()
  const user = await requireTeacher(req, client)
  const body = await readJson(req)
  const code = extractCode(body?.adres)

  const tokens = await exchangeCode(code)
  let members
  try {
    members = await getFamilyMembers(tokens.accessToken)
  } catch (e) {
    throw new HttpError(
      502,
      `Microsoft hesabı doğrulandı ama aile listesi alınamadı (${e?.message || 'hata'}). ` +
        'Family Safety\'yi yöneten (aile düzenleyicisi) hesapla giriş yaptığınızdan emin olun.'
    )
  }

  await database(client).rpc('fs_save_connection', {
    p_owner: user.id,
    p_ms_user_id: tokens.userId,
    p_refresh_token: tokens.refreshToken,
    p_access_token: tokens.accessToken,
    p_expires_at: tokens.expiresAt.toISOString(),
  })

  return { ok: true, uyeler: members }
})
