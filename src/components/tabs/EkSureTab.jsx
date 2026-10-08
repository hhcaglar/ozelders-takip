import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Gamepad2,
  RefreshCw,
  LogIn,
  Link2,
  Unlink,
  Plus,
  X,
  CircleCheck,
  Clock,
  TriangleAlert,
  ExternalLink,
  Settings2,
  History,
  ShieldCheck,
} from 'lucide-react'
import { Card, Button, SectionHeader, Banner, StatBox, Chip, EmptyState } from '../ui.jsx'
import {
  ekSureAvailable,
  fsOverview,
  fsLinkStudent,
  fsUnlinkStudent,
  fsUpdateSettings,
  fsAddCredit,
  fsCancelCredit,
  fsDisconnect,
  connectMicrosoft,
  listFamilyMembers,
  syncNow,
} from '../../lib/ekSure.js'
import {
  MS_LOGIN_URL,
  CREDIT_STATUS,
  formatDateTime,
  timeAgo,
  minutesLabel,
  demoOverview,
} from '../../lib/ekSureKurulum.js'
import { EkSureKurulumKarti } from '../EkSureKurulumKarti.jsx'

const muted = { fontSize: 12.5, color: '#6B7684', lineHeight: 1.5 }

function CardTitle({ icon: Icon, color = 'var(--navy)', children, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14.5 }}>
        {Icon && <Icon size={17} color={color} />}
        {children}
      </div>
      {right}
    </div>
  )
}

function Toggle({ on, onChange, labelOn = 'Açık', labelOff = 'Kapalı' }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        border: 'none',
        background: 'none',
        cursor: 'pointer',
        padding: 0,
        fontWeight: 700,
        fontSize: 13,
        color: on ? 'var(--sage)' : '#8A94A0',
      }}
    >
      <span
        style={{
          width: 38,
          height: 22,
          borderRadius: 999,
          background: on ? 'var(--sage)' : '#C7CFD8',
          position: 'relative',
          transition: 'background .15s',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 3,
            left: on ? 19 : 3,
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: '#fff',
            transition: 'left .15s',
            boxShadow: '0 1px 3px rgba(0,0,0,.2)',
          }}
        />
      </span>
      {on ? labelOn : labelOff}
    </button>
  )
}

function StatusChip({ status }) {
  const meta = CREDIT_STATUS[status] || CREDIT_STATUS.hazir
  return (
    <span
      style={{
        background: meta.bg,
        color: meta.fg,
        fontSize: 11.5,
        fontWeight: 700,
        padding: '3px 9px',
        borderRadius: 999,
        whiteSpace: 'nowrap',
      }}
    >
      {meta.label}
    </span>
  )
}

function Step({ n, children }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <span
        style={{
          flexShrink: 0,
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: 'var(--navy)',
          color: '#fff',
          fontSize: 12,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 1,
        }}
      >
        {n}
      </span>
      <div style={{ fontSize: 13.5, lineHeight: 1.55, flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  )
}

// Microsoft bazen kodlu adresi saniyeden kısa sürede "?removed=true" yapar.
// Güvenilir yol: Geliştirici Araçları → Ağ sekmesinden isteği kopyalamak.
function CodeCaptureTip({ open, onToggle, highlight }) {
  return (
    <div style={{ marginTop: 10 }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--navy)', fontWeight: 700, fontSize: 12.5, textDecoration: 'underline' }}
      >
        Adres hemen “removed=true” oluyor mu? Kodu yakalamanın kesin yolu
      </button>
      {open && (
        <div
          style={{
            marginTop: 8,
            padding: '10px 12px',
            borderRadius: 10,
            background: highlight ? '#FFF7E6' : 'var(--paper)',
            border: `1px solid ${highlight ? '#F0D9A8' : 'var(--line)'}`,
            fontSize: 12.5,
            lineHeight: 1.6,
          }}
        >
          Microsoft, güvenlik için kodu adresten çok hızlı silebilir. O zaman bilgisayarda (Chrome / Edge):
          <ol style={{ margin: '6px 0 0', paddingLeft: 20 }}>
            <li>
              Giriş sekmesinde, şifreyi yazmadan <b>önce</b> klavyeden <b>F12</b>'ye basın (Mac: ⌥⌘I).
            </li>
            <li>
              Açılan panelde <b>Ağ (Network)</b> sekmesine geçin, <b>Günlüğü koru (Preserve log)</b> kutusunu işaretleyin.
            </li>
            <li>
              Girişi tamamlayın. Paneldeki filtre kutusuna <b>code=</b> yazın;{' '}
              <span style={{ fontFamily: 'ui-monospace, Menlo, Consolas, monospace' }}>oauth20_desktop.srf?code=…</span> satırı görünür.
            </li>
            <li>
              Satıra sağ tıklayın → <b>Kopyala → URL'yi kopyala</b> (Copy → Copy URL) ve buraya yapıştırın.
            </li>
          </ol>
          <div style={{ color: '#6B7684', marginTop: 4 }}>Telefonda bu panel yoktur; bu adımı bilgisayardan yapın.</div>
        </div>
      )}
    </div>
  )
}

// ------------------------------------------------------------
// Microsoft bağlantısı
// ------------------------------------------------------------
function ConnectionCard({ connection, busy, onConnect, onDisconnect }) {
  const [adres, setAdres] = useState('')
  const [tipOpen, setTipOpen] = useState(false)
  const expired = connection?.status === 'yeniden_giris'
  const removedPasted = /removed=true/i.test(adres) && !/[?&]code=/i.test(adres)
  useEffect(() => {
    if (removedPasted) setTipOpen(true)
  }, [removedPasted])

  if (connection && !expired) {
    return (
      <Card style={{ padding: 16 }}>
        <CardTitle
          icon={CircleCheck}
          color="var(--sage)"
          right={
            <Button size="sm" variant="ghost" icon={Unlink} onClick={onDisconnect} disabled={busy === 'disconnect'}>
              Bağlantıyı kaldır
            </Button>
          }
        >
          Microsoft hesabı bağlı
        </CardTitle>
        <div style={muted}>
          Son otomatik kontrol: <b>{timeAgo(connection.last_sync_at)}</b> · Bağlandığı tarih:{' '}
          {formatDateTime(connection.created_at)}
        </div>
        {connection.last_error && (
          <Banner tone="warn" style={{ marginTop: 10 }}>
            Son kontrolde sorun oluştu: {connection.last_error}
          </Banner>
        )}
      </Card>
    )
  }

  return (
    <Card style={{ padding: 16 }}>
      <CardTitle icon={LogIn}>{expired ? 'Microsoft oturumunu yenileyin' : 'Microsoft hesabını bağlayın'}</CardTitle>
      {expired && (
        <Banner tone="danger" style={{ marginBottom: 12 }}>
          Microsoft oturumunun süresi dolmuş, otomatik onaylar durdu. Aşağıdaki adımlarla yeniden giriş yapın; haklar
          kaybolmaz.
        </Banner>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Step n={1}>
          Family Safety'yi yönettiğiniz <b>(aile düzenleyicisi)</b> Microsoft hesabıyla giriş yapın.
          <div style={{ marginTop: 8 }}>
            <a
              href={MS_LOGIN_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="dt-btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '9px 14px',
                borderRadius: 10,
                background: 'linear-gradient(135deg, #27496F, #1E3A5F)',
                color: '#fff',
                fontWeight: 700,
                fontSize: 13.5,
                textDecoration: 'none',
              }}
            >
              <ExternalLink size={15} /> Microsoft ile giriş yap
            </a>
          </div>
        </Step>
        <Step n={2}>
          Giriş bitince <b>boş bir sayfa</b> açılır. Adres çubuğundaki adresin <b>tamamını</b> kopyalayın
          <span style={muted}> (login.live.com/oauth20_desktop.srf?code=… ile başlar)</span>.
        </Step>
        <Step n={3}>
          Adresi buraya yapıştırıp bağlayın:
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <input
              value={adres}
              onChange={(e) => setAdres(e.target.value)}
              placeholder="https://login.live.com/oauth20_desktop.srf?code=…"
              style={{ flex: 1, minWidth: 220, fontSize: 13 }}
              onKeyDown={(e) => e.key === 'Enter' && adres.trim() && onConnect(adres)}
            />
            <Button
              icon={Link2}
              disabled={!adres.trim() || removedPasted || busy === 'connect'}
              onClick={() => onConnect(adres)}
            >
              {busy === 'connect' ? 'Bağlanıyor…' : 'Bağla'}
            </Button>
          </div>
          {removedPasted && (
            <Banner tone="warn" style={{ marginTop: 8 }}>
              Bu adreste kod yok: Microsoft kodu silmiş (removed=true). Aşağıdaki adımlarla kodlu adresi yakalayın.
            </Banner>
          )}
          <CodeCaptureTip open={tipOpen} onToggle={() => setTipOpen((v) => !v)} highlight={removedPasted} />
        </Step>
      </div>
      <div style={{ ...muted, marginTop: 12, display: 'flex', gap: 6 }}>
        <ShieldCheck size={14} style={{ flexShrink: 0, marginTop: 2 }} />
        <span>
          Şifreniz DersTakip'e gelmez. Sunucuda yalnızca Family Safety'ye erişebilen bir anahtar saklanır ve tarayıcıya
          hiç gönderilmez; “Bağlantıyı kaldır” ile istediğiniz an silinir. Giriş kodu birkaç dakika geçerlidir, adresi
          hemen yapıştırın.
        </span>
      </div>
    </Card>
  )
}

// ------------------------------------------------------------
// Öğrenci ↔ Family Safety çocuğu eşleşmesi
// ------------------------------------------------------------
function LinkCard({ link, demoMembers, busy, onLink, onUnlink }) {
  const [editing, setEditing] = useState(!link)
  const [members, setMembers] = useState(demoMembers || null)
  const [selected, setSelected] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const fetchMembers = useCallback(async () => {
    if (demoMembers) return
    setLoading(true)
    setErr('')
    try {
      const res = await listFamilyMembers()
      setMembers(res.uyeler || [])
    } catch (e) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }, [demoMembers])

  useEffect(() => {
    if (editing && members === null) fetchMembers()
  }, [editing, members, fetchMembers])

  useEffect(() => {
    if (!link) setEditing(true)
  }, [link])

  if (link && !editing) {
    return (
      <Card style={{ padding: 16 }}>
        <CardTitle icon={Link2}>Family Safety eşleşmesi</CardTitle>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 13.5 }}>
            Bu öğrenci Family Safety'de <b>{link.ms_child_name || 'seçilen çocuk'}</b> hesabıyla eşleşti.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              Değiştir
            </Button>
            <Button size="sm" variant="ghost" icon={Unlink} disabled={busy === 'unlink'} onClick={onUnlink}>
              Kaldır
            </Button>
          </div>
        </div>
      </Card>
    )
  }

  const choose = () => {
    const member = (members || []).find((m) => m.id === selected)
    if (member) onLink(member).then((ok) => ok && setEditing(false))
  }

  return (
    <Card style={{ padding: 16 }}>
      <CardTitle icon={Link2}>Bu öğrenci Family Safety'de hangisi?</CardTitle>
      {loading && <div style={muted}>Aile üyeleri getiriliyor…</div>}
      {err && (
        <Banner tone="danger" style={{ marginBottom: 10 }}>
          {err}{' '}
          <button
            onClick={fetchMembers}
            style={{ background: 'none', border: 'none', color: 'inherit', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer', padding: 0, font: 'inherit' }}
          >
            Tekrar dene
          </button>
        </Banner>
      )}
      {members && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={selected} onChange={(e) => setSelected(e.target.value)} style={{ flex: 1, minWidth: 200 }}>
            <option value="">Aile üyesi seçin…</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {/admin/i.test(m.role) ? ' — aile düzenleyicisi' : m.monitored ? '' : ' (Family Safety kapalı)'}
              </option>
            ))}
          </select>
          <Button icon={Link2} disabled={!selected || busy === 'link'} onClick={choose}>
            Eşleştir
          </Button>
          {link && (
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Vazgeç
            </Button>
          )}
        </div>
      )}
      {members && members.length === 0 && (
        <div style={{ ...muted, marginTop: 8 }}>Bu Microsoft ailesinde üye bulunamadı.</div>
      )}
    </Card>
  )
}

// ------------------------------------------------------------
// Kurallar
// ------------------------------------------------------------
const SCOPES = [
  { id: 'hepsi', label: 'Hepsi' },
  { id: 'cihaz', label: 'Yalnızca ekran süresi' },
  { id: 'uygulama', label: 'Yalnızca uygulama/oyun' },
]

const formFromLink = (link) => ({
  enabled: link?.enabled ?? true,
  minutes: link?.minutes_per_credit ?? 60,
  dailyMax: link?.daily_max ?? 1,
  scope: link?.request_scope ?? 'hepsi',
  appFilter: link?.app_filter ?? '',
})

function RulesCard({ link, busy, onSave }) {
  const [form, setForm] = useState(() => formFromLink(link))
  const key = JSON.stringify(formFromLink(link))
  useEffect(() => setForm(JSON.parse(key)), [key])
  const dirty = JSON.stringify(form) !== key
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  const row = { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 13.5 }
  const num = { width: 82, padding: '8px 10px' }

  return (
    <Card style={{ padding: 16 }}>
      <CardTitle icon={Settings2}>Kurallar</CardTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={row}>
          <span style={{ minWidth: 190 }}>Otomatik onay</span>
          <Toggle on={form.enabled} onChange={(v) => set({ enabled: v })} />
        </div>
        <div style={row}>
          <span style={{ minWidth: 190 }}>Teslim edilen her ödev için</span>
          <input
            type="number"
            min={5}
            max={600}
            step={5}
            value={form.minutes}
            onChange={(e) => set({ minutes: Number(e.target.value) })}
            style={num}
          />
          <span>dakika ek süre (bir seferlik)</span>
        </div>
        <div style={row}>
          <span style={{ minWidth: 190 }}>Günde en fazla</span>
          <input
            type="number"
            min={0}
            max={10}
            value={form.dailyMax}
            onChange={(e) => set({ dailyMax: Number(e.target.value) })}
            style={num}
          />
          <span>kez onay</span>
          <span style={muted}>(0 = sınırsız · fazla haklar sonraki günlere kalır)</span>
        </div>
        <div style={{ ...row, alignItems: 'flex-start' }}>
          <span style={{ minWidth: 190, paddingTop: 7 }}>Onaylanacak istekler</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {SCOPES.map((s) => (
              <Chip key={s.id} active={form.scope === s.id} onClick={() => set({ scope: s.id })}>
                {s.label}
              </Chip>
            ))}
          </div>
        </div>
        {form.scope !== 'cihaz' && (
          <div style={{ ...row, alignItems: 'flex-start' }}>
            <span style={{ minWidth: 190, paddingTop: 9 }}>Uygulama filtresi (isteğe bağlı)</span>
            <div style={{ flex: 1, minWidth: 200 }}>
              <input
                value={form.appFilter}
                onChange={(e) => set({ appFilter: e.target.value })}
                placeholder="ör. minecraft"
                style={{ width: '100%', maxWidth: 320 }}
              />
              <div style={{ ...muted, marginTop: 4 }}>
                Boş bırakırsanız tüm uygulama istekleri onaylanır. Birden fazla için virgül kullanın: “minecraft, roblox”.
              </div>
            </div>
          </div>
        )}
        <div>
          <Button disabled={!dirty || busy === 'settings'} onClick={() => onSave(form)}>
            {busy === 'settings' ? 'Kaydediliyor…' : 'Kuralları kaydet'}
          </Button>
        </div>
      </div>
    </Card>
  )
}

// ------------------------------------------------------------
// Haklar ve olaylar
// ------------------------------------------------------------
function creditDetail(c) {
  if (c.status === 'kullanildi') {
    const where = c.app_name ? ` · ${c.app_name}` : c.request_type === 'DeviceScreenTime' ? ' · ekran süresi' : ''
    return `Kullanıldı: ${formatDateTime(c.used_at)}${where}`
  }
  if (c.status === 'ayrildi') return 'Microsoft onayı bekleniyor…'
  return `Oluştu: ${formatDateTime(c.created_at)}`
}

function CreditsCard({ credits, busy, onAdd, onCancel }) {
  const [adding, setAdding] = useState(false)
  const [note, setNote] = useState('')
  const submit = async () => {
    const ok = await onAdd(note.trim())
    if (ok) {
      setNote('')
      setAdding(false)
    }
  }

  return (
    <Card style={{ padding: 16 }}>
      <CardTitle
        icon={Gamepad2}
        right={
          <Button size="sm" variant="ghost" icon={Plus} onClick={() => setAdding((v) => !v)}>
            Elle hak ekle
          </Button>
        }
      >
        Ek süre hakları
      </CardTitle>
      {adding && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Açıklama (ör. Hafta sonu ödülü)"
            style={{ flex: 1, minWidth: 200 }}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
          <Button icon={Plus} disabled={busy === 'add'} onClick={submit}>
            Ekle
          </Button>
        </div>
      )}
      {credits.length === 0 ? (
        <EmptyState text="Henüz hak yok. Ödevler sekmesinde bir ödevi “Teslim edildi” yaptığınızda burada görünür." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {credits.map((c) => (
            <div
              key={c.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 12px',
                border: '1px solid var(--line)',
                borderRadius: 10,
                opacity: c.status === 'iptal' ? 0.6 : 1,
              }}
            >
              <StatusChip status={c.status} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.title || 'Ödev'} <span style={{ fontWeight: 500, color: '#6B7684' }}>· {minutesLabel(c.minutes)}</span>
                  {!c.homework_id && <span style={{ fontWeight: 500, color: '#6B7684' }}> · elle eklendi</span>}
                </div>
                <div style={{ ...muted, fontSize: 12 }}>
                  {creditDetail(c)}
                  {c.note ? ` · ${c.note}` : ''}
                </div>
              </div>
              {c.status === 'hazir' && (
                <button
                  onClick={() => onCancel(c.id)}
                  title="Bu hakkı iptal et"
                  aria-label="Hakkı iptal et"
                  disabled={busy === `cancel-${c.id}`}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B7C1CC', padding: 2 }}
                >
                  <X size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

const EVENT_META = {
  onay: { icon: CircleCheck, color: 'var(--sage)' },
  bekletildi: { icon: Clock, color: '#B8860B' },
  hata: { icon: TriangleAlert, color: 'var(--coral)' },
  yeniden_giris: { icon: TriangleAlert, color: 'var(--coral)' },
  baglanti: { icon: Link2, color: 'var(--navy)' },
}

function EventsCard({ events }) {
  return (
    <Card style={{ padding: 16 }}>
      <CardTitle icon={History}>Son olaylar</CardTitle>
      {events.length === 0 ? (
        <div style={muted}>Henüz olay yok.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {events.map((e) => {
            const meta = EVENT_META[e.kind] || EVENT_META.baglanti
            const Icon = meta.icon
            return (
              <div key={e.id} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', fontSize: 13 }}>
                <Icon size={15} color={meta.color} style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ flex: 1, lineHeight: 1.45 }}>
                  {e.message}
                  <div style={{ fontSize: 11.5, color: '#8A94A0' }}>{formatDateTime(e.created_at)}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

// ------------------------------------------------------------
// Ana sekme
// ------------------------------------------------------------
export function EkSureTab({ student, saveVersion = 0 }) {
  const demo = !ekSureAvailable
  const [ov, setOv] = useState(() => (demo ? demoOverview(student) : null))
  const [loadError, setLoadError] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState('')
  // Öğrenciler arasında hızlı geçişte, öncekinin geç gelen yanıtı yazılmasın
  const currentId = useRef(student.id)
  currentId.current = student.id

  const load = useCallback(
    async (quiet = false) => {
      if (demo) return
      const id = student.id
      try {
        const data = await fsOverview(id)
        if (currentId.current !== id) return
        setOv(data)
        setLoadError('')
      } catch (e) {
        if (!quiet && currentId.current === id) setLoadError(e.message)
      }
    },
    [demo, student.id]
  )

  // Öğrenci değişince ya da otomatik kayıt bitince (yeni hak oluşmuş olabilir) yenile
  useEffect(() => {
    if (!demo) {
      setOv(null)
      setError('')
      setNotice('')
    }
  }, [demo, student.id])
  useEffect(() => {
    load()
  }, [load, saveVersion])
  useEffect(() => {
    if (demo) setOv(demoOverview(student))
  }, [demo, student])
  // Açıkken 30 sn'de bir sessizce yenile (onaylar canlı görünsün)
  useEffect(() => {
    if (demo) return undefined
    const timer = setInterval(() => load(true), 30000)
    return () => clearInterval(timer)
  }, [demo, load])

  const run = async (key, fn, success) => {
    if (demo) {
      setNotice('Önizleme modunda işlem yapılmaz. Supabase bağlı (yayındaki) sürümde gerçekten çalışır.')
      return false
    }
    setBusy(key)
    setError('')
    setNotice('')
    try {
      const result = await fn()
      if (result && typeof result === 'object' && Array.isArray(result.credits)) setOv(result)
      else await load(true)
      if (success) setNotice(typeof success === 'function' ? success(result) : success)
      return true
    } catch (e) {
      setError(e.message)
      return false
    } finally {
      setBusy('')
    }
  }

  if (!ov) {
    return (
      <div>
        <SectionHeader icon={Gamepad2}>Ek Süre · Microsoft Family Safety</SectionHeader>
        {loadError ? <Banner tone="danger">{loadError}</Banner> : <div style={muted}>Yükleniyor…</div>}
      </div>
    )
  }

  const connected = ov.connection && ov.connection.status === 'ok'
  const link = ov.link
  const minutes = link?.minutes_per_credit ?? 60
  const dailyMax = link?.daily_max ?? 1
  const firstName = (student.name || 'Öğrenci').split(' ')[0]

  return (
    <div>
      <SectionHeader
        icon={Gamepad2}
        right={
          connected && link ? (
            <Button
              size="sm"
              variant="ghost"
              icon={RefreshCw}
              disabled={busy === 'sync'}
              onClick={() =>
                run('sync', syncNow, (r) =>
                  r?.hatalar?.length
                    ? `Kontrol edildi ama sorun var: ${r.hatalar[0]}`
                    : r?.onaylanan
                      ? `${r.onaylanan} istek onaylandı.`
                      : r?.bekletilen
                        ? `${r.bekletilen} istek size bırakıldı (nedeni “Son olaylar”da).`
                        : 'Kontrol edildi: onaylanacak bekleyen istek yok.'
                )
              }
            >
              {busy === 'sync' ? 'Kontrol ediliyor…' : 'Şimdi kontrol et'}
            </Button>
          ) : null
        }
      >
        Ek Süre · Microsoft Family Safety
      </SectionHeader>

      {demo && (
        <Banner tone="warn" style={{ marginBottom: 14 }}>
          <b>Önizleme:</b> Bu sekme Supabase'e bağlı (yayındaki) sürümde çalışır. Aşağıdaki bilgiler örnektir; hiçbir şey
          kaydedilmez ve Microsoft'a bağlanılmaz.
        </Banner>
      )}

      <Banner tone="info" style={{ marginBottom: 14 }}>
        Bir ödevi <b>“Teslim edildi”</b> yaptığınızda {firstName} için <b>bir seferlik +{minutesLabel(minutes)}</b> ek süre
        hakkı oluşur. Bilgisayarda süresi bitince <b>“Daha fazla süre iste”</b> dediğinde sistem isteği 1–2 dakika içinde
        kendiliğinden onaylar{dailyMax > 0 ? <> (günde en fazla <b>{dailyMax}</b> kez)</> : null}. Hak yoksa istek size
        bırakılır, siz karar verirsiniz.
      </Banner>

      {loadError && (
        <Banner tone="danger" style={{ marginBottom: 12 }}>
          {loadError}
        </Banner>
      )}
      {error && (
        <Banner tone="danger" style={{ marginBottom: 12 }}>
          {error}
        </Banner>
      )}
      {notice && (
        <Banner tone="good" icon={CircleCheck} style={{ marginBottom: 12 }}>
          {notice}
        </Banner>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <StatBox label="Kullanılabilir hak" value={ov.available} accent />
        <StatBox label="Bugün onaylanan" value={`${ov.used_today}/${dailyMax > 0 ? dailyMax : '∞'}`} />
        <StatBox label="Toplam kullanılan" value={ov.used_total} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 760 }}>
        <ConnectionCard
          connection={ov.connection}
          busy={busy}
          onConnect={(adres) =>
            run('connect', () => connectMicrosoft(adres), 'Microsoft hesabı bağlandı. Şimdi öğrenciyi eşleştirin.')
          }
          onDisconnect={() => run('disconnect', fsDisconnect, 'Microsoft bağlantısı kaldırıldı.')}
        />

        {connected && (
          <LinkCard
            link={link}
            demoMembers={ov.demoMembers}
            busy={busy}
            onLink={(member) =>
              run('link', () => fsLinkStudent(student.id, member), `${student.name}, “${member.name}” ile eşleştirildi.`)
            }
            onUnlink={() => run('unlink', () => fsUnlinkStudent(student.id), 'Eşleşme kaldırıldı.')}
          />
        )}

        {link && (
          <RulesCard
            link={link}
            busy={busy}
            onSave={(form) => run('settings', () => fsUpdateSettings(student.id, form), 'Kurallar kaydedildi.')}
          />
        )}

        <CreditsCard
          credits={ov.credits || []}
          busy={busy}
          onAdd={(note) => run('add', () => fsAddCredit(student.id, note), 'Hak eklendi.')}
          onCancel={(id) => run(`cancel-${id}`, () => fsCancelCredit(id), 'Hak iptal edildi.')}
        />

        <EventsCard events={ov.events || []} />

        <EkSureKurulumKarti demo={demo} connection={ov.connection} waiting={ov.waiting_total} />
      </div>
    </div>
  )
}
