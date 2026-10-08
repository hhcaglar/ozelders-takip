import { useEffect, useState } from 'react'
import { Server, ChevronDown, ChevronUp, Copy, RefreshCw, CircleCheck, CircleX, Hourglass } from 'lucide-react'
import { Card, Button, Banner } from './ui.jsx'
import { serverStatus, schedulerSql, loadSetupSecret, saveSetupSecret } from '../lib/ekSure.js'
import { generateSecret, timeAgo } from '../lib/ekSureKurulum.js'

const muted = { fontSize: 12.5, color: '#6B7684', lineHeight: 1.5 }
const mono = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' }
const code = {
  ...mono,
  fontSize: 12,
  background: 'var(--paper)',
  border: '1px solid var(--line)',
  borderRadius: 6,
  padding: '1px 6px',
}

function CheckItem({ state, children }) {
  const meta =
    state === 'ok'
      ? { Icon: CircleCheck, color: 'var(--sage)' }
      : state === 'bad'
        ? { Icon: CircleX, color: 'var(--coral)' }
        : { Icon: Hourglass, color: '#8A94A0' }
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: 13 }}>
      <meta.Icon size={15} color={meta.color} style={{ flexShrink: 0, marginTop: 2 }} />
      <span>{children}</span>
    </div>
  )
}

function SetupStep({ n, title, children }) {
  return (
    <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
      <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 6 }}>
        {n}) {title}
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.6 }}>{children}</div>
    </div>
  )
}

export function EkSureKurulumKarti({ demo, connection, waiting = 0 }) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState(undefined) // undefined: yükleniyor · null: fonksiyonlara ulaşılamadı
  const [secret, setSecret] = useState(() => loadSetupSecret())
  const [copied, setCopied] = useState('')

  useEffect(() => {
    if (!secret) {
      const fresh = generateSecret()
      setSecret(fresh)
      saveSetupSecret(fresh)
    }
  }, [secret])

  useEffect(() => {
    let cancelled = false
    serverStatus().then((s) => {
      if (cancelled) return
      setStatus(s)
      const incomplete = !s || !s.servisAnahtari || !s.senkronAnahtari || s.veritabani !== 'hazir'
      if (!demo && incomplete) setOpen(true)
    })
    return () => {
      cancelled = true
    }
  }, [demo])

  const copy = async (key, text) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied(''), 1800)
    } catch {
      /* pano izni yok — kullanıcı elle seçebilir */
    }
  }

  const regenerate = () => {
    const fresh = generateSecret()
    setSecret(fresh)
    saveSetupSecret(fresh)
  }

  const siteUrl = globalThis.window?.location?.origin || globalThis.location?.origin || 'https://siteniz.com'
  const sql = secret ? schedulerSql(siteUrl, secret) : ''
  const lastSync = connection?.last_sync_at
  const stale =
    waiting > 0 &&
    connection?.status === 'ok' &&
    (!lastSync || Date.now() - new Date(lastSync).getTime() > 5 * 60 * 1000)

  const s = status
  const dbState = !s ? 'unknown' : s.veritabani === 'hazir' ? 'ok' : s.servisAnahtari ? 'bad' : 'unknown'

  return (
    <Card style={{ padding: 16 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          fontWeight: 700,
          fontSize: 14.5,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Server size={17} color="var(--navy)" /> Sunucu kurulumu <span style={{ ...muted, fontWeight: 500 }}>(bir kez yapılır)</span>
        </span>
        {open ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
      </button>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
        <CheckItem state={dbState}>
          Veritabanı fonksiyonları
          {s?.veritabani === 'sema_eksik' && ' — schema.sql yeniden çalıştırılmalı'}
          {s?.veritabani === 'anahtar_hatali' && ' — sunucu anahtarı hatalı görünüyor'}
        </CheckItem>
        <CheckItem state={!s ? 'unknown' : s.servisAnahtari ? 'ok' : 'bad'}>
          Sunucu anahtarı (<span style={code}>SUPABASE_SERVICE_ROLE_KEY</span>)
        </CheckItem>
        <CheckItem state={!s ? 'unknown' : s.senkronAnahtari ? 'ok' : 'bad'}>
          Zamanlayıcı anahtarı (<span style={code}>AILE_SENKRON_ANAHTARI</span>)
        </CheckItem>
        <CheckItem state={stale ? 'bad' : lastSync ? 'ok' : 'unknown'}>
          Otomatik kontrol: {lastSync ? `son çalışma ${timeAgo(lastSync)}` : 'henüz çalışmadı'}
          {stale && ' — bekleyen hak var ama 5 dakikadır kontrol yapılmadı; 3. adımı kontrol edin'}
        </CheckItem>
        {s === null && !demo && (
          <div style={{ ...muted, marginTop: 2 }}>
            Sunucu fonksiyonlarına ulaşılamadı. Site Vercel'de yayınlandıktan sonra burası otomatik dolar.
          </div>
        )}
      </div>

      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
          <SetupStep n={1} title="Veritabanını güncelleyin">
            Supabase → <b>SQL Editor</b> → <span style={code}>supabase/schema.sql</span> dosyasının tamamını yapıştırıp{' '}
            <b>Run</b>. Mevcut öğrenci verilerinize dokunmaz; yalnızca yeni tabloları ve fonksiyonları ekler.
          </SetupStep>

          <SetupStep n={2} title="Vercel'e iki ortam değişkeni ekleyin">
            Vercel → projeniz → <b>Settings → Environment Variables</b>:
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '8px 0' }}>
              <div>
                <span style={code}>SUPABASE_SERVICE_ROLE_KEY</span> → Supabase → <b>Project Settings → API Keys</b> →{' '}
                <b>service_role</b> (yeni arayüzde <b>secret</b>) anahtarı.
                <div style={{ ...muted, color: '#B23A22' }}>
                  ⚠️ Bu gizli anahtar yalnızca sunucuda kalır. Adı asla <span style={code}>VITE_</span> ile başlamamalı
                  (öyle olursa tarayıcıya gömülür).
                </div>
              </div>
              <div>
                <span style={code}>AILE_SENKRON_ANAHTARI</span> → şu değer:
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 5 }}>
                  <span style={{ ...code, fontSize: 12.5, padding: '6px 9px', wordBreak: 'break-all' }}>{secret}</span>
                  <Button size="sm" variant="ghost" icon={Copy} onClick={() => copy('secret', secret)}>
                    {copied === 'secret' ? 'Kopyalandı ✓' : 'Kopyala'}
                  </Button>
                  <Button size="sm" variant="ghost" icon={RefreshCw} onClick={regenerate} title="Yeni anahtar üret">
                    Yeni üret
                  </Button>
                </div>
                <div style={muted}>Yeni üretirseniz hem Vercel'deki değeri hem 3. adımdaki SQL'i tekrar uygulayın.</div>
              </div>
            </div>
            Kaydettikten sonra <b>Deployments</b> → son deploy → <b>⋯ → Redeploy</b>.
          </SetupStep>

          <SetupStep n={3} title="Zamanlayıcıyı kurun (dakikada bir kontrol)">
            Supabase → <b>SQL Editor</b>'de aşağıdaki SQL'i çalıştırın. Site adresiniz (
            <span style={code}>{siteUrl}</span>) ve anahtarınız içine yazıldı.
            <textarea
              readOnly
              value={sql}
              rows={9}
              onFocus={(e) => e.target.select()}
              style={{ ...mono, width: '100%', fontSize: 11.5, marginTop: 8, lineHeight: 1.45, resize: 'vertical' }}
            />
            <div style={{ marginTop: 6 }}>
              <Button size="sm" icon={Copy} onClick={() => copy('sql', sql)}>
                {copied === 'sql' ? 'Kopyalandı ✓' : "SQL'i kopyala"}
              </Button>
            </div>
            <div style={{ ...muted, marginTop: 6 }}>
              Kullanılmamış hak yokken Microsoft'a hiç gidilmez; yalnızca her gece 04:00'te oturumu taze tutmak için bir
              kontrol yapılır.
            </div>
          </SetupStep>

          <SetupStep n={4} title="Deneyin">
            Bir ödevi “Teslim edildi” yapın, çocuğun bilgisayarında süre bitince <b>“Daha fazla süre iste”</b>ye basın. 1–2
            dakika içinde onaylanmalı. Hemen denemek için yukarıdaki <b>“Şimdi kontrol et”</b> düğmesini kullanabilirsiniz.
          </SetupStep>

          {demo && (
            <Banner tone="warn">Önizleme modundasınız: bu adımlar yayındaki (Supabase bağlı) sitede uygulanır.</Banner>
          )}
        </div>
      )}
    </Card>
  )
}
