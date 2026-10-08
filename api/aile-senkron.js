// POST /api/aile-senkron
//  • Zamanlayıcı (Supabase pg_cron, dakikada bir): Authorization: Bearer <AILE_SENKRON_ANAHTARI>
//    → tüm bağlantılar, yalnızca hakkı olan öğrenciler için Microsoft'a gidilir.
//  • Öğretmen ("Şimdi kontrol et" düğmesi): Authorization: Bearer <Supabase oturumu>
//    → yalnızca o öğretmenin bağlantısı, hak olmasa da kontrol edilir.
import { adminClient, database, handler, isCronRequest, requireTeacher } from './_lib/sunucu.js'
import { runSync } from './_lib/senkron.js'

export default handler(['POST'], async (req) => {
  const client = adminClient()
  const db = database(client)
  if (isCronRequest(req)) {
    return runSync({ db })
  }
  const user = await requireTeacher(req, client)
  return runSync({ db, owner: user.id, force: true })
})
