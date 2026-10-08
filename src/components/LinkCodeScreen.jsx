import { useState } from 'react'
import { GraduationCap, Link2, LogOut } from 'lucide-react'
import { Button, Banner } from './ui.jsx'
import { fontSerif } from '../lib/theme.js'
import { useAuth } from '../lib/auth.jsx'

// Kayıtlı veli hesabı açılmış ama henüz erişim kodu bağlanmamış
// (ya da bağlantı kesilmiş) → kod girme ekranı
export function LinkCodeScreen() {
  const { parentLink, signOut } = useAuth()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setError('')
    setBusy(true)
    try {
      await parentLink(code)
      // bağlanınca App otomatik veli görünümüne geçer
    } catch (e) {
      setError(
        /geçersiz/i.test(e?.message || '')
          ? 'Bu kod geçersiz. Öğretmeninden aldığın kodu kontrol et.'
          : e?.message || 'Bağlanamadı, tekrar dene.'
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="dt-login-bg"
      style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          background: 'var(--paper-card)',
          border: '1px solid var(--line)',
          borderRadius: 16,
          padding: 28,
          boxShadow: '0 12px 40px rgba(30,58,95,0.10)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <GraduationCap size={26} color="var(--amber)" />
          <span style={{ fontFamily: fontSerif, fontSize: 22, fontWeight: 700 }}>DersTakip</span>
        </div>
        <p style={{ margin: '0 0 18px', fontSize: 13.5, color: '#6B7684' }}>
          Çocuğunun bilgi sistemine bağlanmak için öğretmeninden aldığın <b>erişim kodunu</b> gir.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
        >
          <input
            placeholder="Erişim kodu (örn. ABCD-1234)"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            style={{ letterSpacing: 1 }}
          />
          <Button type="submit" icon={Link2} disabled={busy}>
            {busy ? 'Bağlanıyor…' : 'Çocuğuma Bağlan'}
          </Button>
          <Button
            variant="ghost"
            icon={LogOut}
            onClick={signOut}
            style={{ color: '#8A94A0' }}
          >
            Hesaptan çıkış yap
          </Button>
        </form>
        {error && (
          <Banner tone="danger" style={{ marginTop: 14 }}>
            {error}
          </Banner>
        )}
      </div>
    </div>
  )
}
