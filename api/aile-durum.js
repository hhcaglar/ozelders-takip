// GET /api/aile-durum — sunucu kurulumunun hangi adımlarının tamam olduğunu söyler.
// Gizli değer DÖNMEZ; yalnızca var/yok bilgisi verir.
import { config, database, handler } from './_lib/sunucu.js'

export default handler(['GET'], async () => {
  const { supabaseUrl, serviceKey, cronSecret } = config()
  let veritabani = 'bilinmiyor'
  if (supabaseUrl && serviceKey) {
    try {
      // Var olmayan bir öğretmen için zararsız bir sorgu: anahtar + şema doğrulanır
      await database().rpc('fs_links_for_sync', { p_owner: '00000000-0000-0000-0000-000000000000' })
      veritabani = 'hazir'
    } catch (e) {
      veritabani = e?.status === 503 ? 'sema_eksik' : 'anahtar_hatali'
    }
  }
  return {
    sunucu: true,
    supabaseAdresi: Boolean(supabaseUrl),
    servisAnahtari: Boolean(serviceKey),
    senkronAnahtari: Boolean(cronSecret),
    veritabani,
  }
})
