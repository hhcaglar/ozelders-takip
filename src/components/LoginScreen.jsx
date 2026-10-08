import { useState } from 'react'
import { GraduationCap, LogIn, UserPlus, KeyRound, UserRoundPlus } from 'lucide-react'
import { Button, Banner } from './ui.jsx'
import { fontSans, fontSerif } from '../lib/theme.js'
import { useAuth } from '../lib/auth.jsx'

const TABS = [
  { id: 'ogretmen', label: 'Öğretmen' },
  { id: 'veli-giris', label: 'Veli Giriş' },
  { id: 'veli-kayit', label: 'Veli Kayıt' },
]

export function LoginScreen() {
  const { signIn, signUp, parentAccountSignIn, parentSignUp } = useAuth()
  const [tab, setTab] = useState('ogretmen')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  const run = async (fn) => {
    setError('')
    setInfo('')
    setBusy(true)
    try {
      const msg = await fn()
      if (typeof msg === 'string' && msg) setInfo(msg)
    } catch (e) {
      setError(translateError(e))
    } finally {
      setBusy(false)
    }
  }

  const switchTab = (id) => {
    setTab(id)
    setError('')
    setInfo('')
  }

  const forms = {
    ogretmen: (
      <Form
        email={email} setEmail={setEmail}
        password={password} setPassword={setPassword}
        busy={busy}
        onSubmit={() => run(async () => {
          if (!email.trim() || !password) throw new Error('E-posta ve şifre gerekli.')
          await signIn(email.trim(), password)
        })}
        primaryLabel="Giriş Yap"
        primaryIcon={LogIn}
        secondaryLabel="Hesap Oluştur (ilk kurulum)"
        secondaryIcon={UserPlus}
        onSecondary={() => run(async () => {
          if (!email.trim() || password.length < 6)
            throw new Error('E-posta ve en az 6 karakterli şifre gerekli.')
          await signUp(email.trim(), password)
          return 'Hesap oluşturuldu. E-posta doğrulaması gerekiyorsa kutunu kontrol et.'
        })}
        hint="Yalnızca öğretmen hesapları öğrenci ekleyebilir ve düzenleyebilir."
      />
    ),
    'veli-giris': (
      <Form
        email={email} setEmail={setEmail}
        password={password} setPassword={setPassword}
        busy={busy}
        onSubmit={() => run(async () => {
          if (!email.trim() || !password) throw new Error('E-posta ve şifre gerekli.')
          await parentAccountSignIn(email.trim(), password)
        })}
        primaryLabel="Veli Girişi"
        primaryIcon={LogIn}
        hint="Kayıtlıysan e-posta ve şifrenle gir. Hesabın yoksa sağdaki Kayıt sekmesini kullan."
      />
    ),
    'veli-kayit': (
      <form
        onSubmit={(e) => {
          e.preventDefault()
          run(() => parentSignUp(fullName, email, password, code))
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
      >
        <input
          placeholder="Adın"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          autoComplete="name"
        />
        <input
          type="email"
          placeholder="E-posta"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
        />
        <input
          type="password"
          placeholder="Şifre (en az 6 karakter)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
        <input
          placeholder="Öğretmeninden aldığın erişim kodu (örn. ABCD-1234)"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          style={{ letterSpacing: 1 }}
        />
        <Button type="submit" icon={UserRoundPlus} disabled={busy}>
          {busy ? 'Hesap oluşturuluyor…' : 'Hesabımı Oluştur'}
        </Button>
        <p style={{ margin: 0, fontSize: 12, color: '#8A94A0', lineHeight: 1.5 }}>
          Hesabın, erişim koduyla doğrulanan <b>yalnızca kendi çocuğuna</b> bağlanır.
          Verileri salt-okunur takip edersin.
        </p>
      </form>
    ),
  }

  return (
    <div
      className="dt-login-bg"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 410,
          background: 'var(--paper-card)',
          border: '1px solid var(--line)',
          borderRadius: 16,
          padding: 28,
          boxShadow: '0 12px 40px rgba(30,58,95,0.10)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <GraduationCap size={28} color="var(--amber)" />
          <span style={{ fontFamily: fontSerif, fontSize: 25, fontWeight: 700, color: 'var(--ink)' }}>
            DersTakip
          </span>
        </div>
        <p style={{ margin: '0 0 18px', fontSize: 13.5, color: '#6B7684' }}>
          Öğrenci takip paneline hoş geldin
        </p>

        <div
          style={{
            display: 'flex',
            background: 'var(--paper)',
            border: '1px solid var(--line)',
            borderRadius: 9,
            padding: 3,
            marginBottom: 18,
          }}
        >
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => switchTab(id)}
              style={{
                flex: 1,
                padding: '7px 4px',
                borderRadius: 7,
                border: 'none',
                cursor: 'pointer',
                fontSize: 12.5,
                fontWeight: 700,
                fontFamily: fontSans,
                background: tab === id ? 'var(--navy)' : 'transparent',
                color: tab === id ? '#fff' : '#6B7684',
                transition: 'background .15s',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {forms[tab]}

        {error && (
          <Banner tone="danger" style={{ marginTop: 14 }}>
            {error}
          </Banner>
        )}
        {info && (
          <Banner tone="good" style={{ marginTop: 14 }}>
            {info}
          </Banner>
        )}

        <div style={{ marginTop: 20, textAlign: 'center', fontSize: 11, color: '#B7C1CC' }}>
          DersTakip v3
        </div>
      </div>
    </div>
  )
}

function Form({
  email, setEmail,
  password, setPassword,
  busy,
  onSubmit,
  primaryLabel, primaryIcon,
  secondaryLabel, secondaryIcon, onSecondary,
  hint,
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
      style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
    >
      <input
        type="email"
        placeholder="E-posta"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="username"
      />
      <input
        type="password"
        placeholder="Şifre"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
      />
      <Button type="submit" icon={primaryIcon} disabled={busy}>
        {busy ? 'İşleniyor…' : primaryLabel}
      </Button>
      {secondaryLabel && (
        <Button variant="ghost" icon={secondaryIcon} disabled={busy} onClick={onSecondary}>
          {secondaryLabel}
        </Button>
      )}
      <p style={{ margin: 0, fontSize: 12, color: '#8A94A0', lineHeight: 1.5 }}>{hint}</p>
    </form>
  )
}

function translateError(e) {
  const msg = e?.message || String(e)
  if (/Invalid login/i.test(msg)) return 'E-posta veya şifre hatalı.'
  if (/already registered|already exists/i.test(msg))
    return 'Bu e-posta zaten kayıtlı — giriş yapmayı dene.'
  if (/rate limit/i.test(msg)) return 'Çok fazla deneme yaptın, biraz bekleyip tekrar dene.'
  if (/email_address_invalid/i.test(msg)) return 'Geçerli bir e-posta adresi gir.'
  if (/Failed to fetch|NetworkError/i.test(msg))
    return 'Sunucuya ulaşılamadı — internet bağlantını kontrol et.'
  return msg
}
