import { useState } from 'react'
import { KeyRound, Unlink, LogOut } from 'lucide-react'
import { Button, Banner, Modal, ConfirmDialog } from './ui.jsx'
import { useAuth } from '../lib/auth.jsx'

// Hesap ayarları: şifre değiştir, (veli) bağlantıyı kes, çıkış yap
export function SettingsModal({ onClose }) {
  const { accountEmail, isParentAccount, changePassword, parentUnlink, signOut } = useAuth()
  const [pw1, setPw1] = useState('')
  const [pw2, setPw2] = useState('')
  const [msg, setMsg] = useState(null) // {tone, text}
  const [busy, setBusy] = useState(false)
  const [confirmUnlink, setConfirmUnlink] = useState(false)

  const savePassword = async () => {
    setMsg(null)
    if (pw1.length < 6) return setMsg({ tone: 'danger', text: 'Şifre en az 6 karakter olmalı.' })
    if (pw1 !== pw2) return setMsg({ tone: 'danger', text: 'Şifreler eşleşmiyor.' })
    setBusy(true)
    try {
      await changePassword(pw1)
      setPw1('')
      setPw2('')
      setMsg({ tone: 'good', text: 'Şifren güncellendi ✓' })
    } catch (e) {
      setMsg({ tone: 'danger', text: e?.message || 'Şifre değiştirilemedi.' })
    } finally {
      setBusy(false)
    }
  }

  const doUnlink = async () => {
    setConfirmUnlink(false)
    setBusy(true)
    try {
      await parentUnlink()
      // App otomatik kod bağlama ekranına geçer
    } catch (e) {
      setMsg({ tone: 'danger', text: e?.message || 'Bağlantı kesilemedi.' })
      setBusy(false)
    }
  }

  return (
    <>
      <Modal title="Hesap Ayarları" onClose={onClose}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div
            style={{
              background: 'var(--paper)',
              border: '1px solid var(--line)',
              borderRadius: 10,
              padding: '10px 14px',
              fontSize: 13,
            }}
          >
            <b>{accountEmail || 'Hesap'}</b>
            <div style={{ color: '#6B7684', fontSize: 12, marginTop: 2 }}>
              {isParentAccount ? 'Veli hesabı' : 'Öğretmen hesabı'}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 700 }}>
              <KeyRound size={15} color="var(--navy)" /> Şifre değiştir
            </div>
            <input
              type="password"
              placeholder="Yeni şifre"
              value={pw1}
              onChange={(e) => setPw1(e.target.value)}
              autoComplete="new-password"
            />
            <input
              type="password"
              placeholder="Yeni şifre (tekrar)"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              autoComplete="new-password"
            />
            <Button onClick={savePassword} disabled={busy} size="sm">
              Şifreyi Güncelle
            </Button>
          </div>

          {isParentAccount && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 700, color: 'var(--coral)' }}>
                <Unlink size={15} /> Öğrenci bağlantısı
              </div>
              <Button variant="danger" size="sm" icon={Unlink} onClick={() => setConfirmUnlink(true)}>
                Bu öğrenciyle bağlantıyı kes
              </Button>
            </div>
          )}

          <Button variant="ghost" icon={LogOut} onClick={signOut}>
            Oturumu kapat
          </Button>

          {msg && <Banner tone={msg.tone}>{msg.text}</Banner>}
        </div>
      </Modal>

      {confirmUnlink && (
        <ConfirmDialog
          title="Bağlantıyı kes"
          message="Bu öğrencinin verilerini bir daha göremezsin. Kodu tekrar alırsan yeniden bağlanabilirsin. Emin misin?"
          confirmLabel="Evet, kes"
          danger
          onConfirm={doUnlink}
          onCancel={() => setConfirmUnlink(false)}
        />
      )}
    </>
  )
}
