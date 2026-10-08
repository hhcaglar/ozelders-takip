import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase, supabaseConfigured } from './supabaseClient.js'
import { loadParentCode, saveParentCode } from './localBackend.js'

// ------------------------------------------------------------
// Kimlik doğrulama v3:
//  - Öğretmen: e-posta/şifre (Supabase Auth), students satırlarının sahibi
//  - Veli hesabı: kayıt (ad + e-posta + şifre + erişim kodu) → auth.users
//    içinde role='veli' metadata'sıyla işaretlenir; parent_users tablosu
//    üzerinden RLS ile yalnızca kendi çocuğunu okur
//  - Veli hızlı giriş: hesapsız erişim kodu (salt-okunur RPC)
//  - Yerel mod (Supabase yok): veriler yalnızca bu tarayıcıda
// ------------------------------------------------------------

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [authReady, setAuthReady] = useState(!supabaseConfigured)
  const [parentCode, setParentCode] = useState(() => loadParentCode())
  // undefined = bilinmiyor/yükleniyor · null = bağlı öğrenci yok · obje = bağlı
  const [linkedStudent, setLinkedStudent] = useState(undefined)

  const refreshParentLink = useCallback(async (s) => {
    if (!s || s.user?.user_metadata?.role !== 'veli') {
      setLinkedStudent(undefined)
      return
    }
    try {
      const { data, error } = await supabase.rpc('parent_get_me')
      setLinkedStudent(error ? null : data ?? null)
    } catch {
      setLinkedStudent(null)
    }
  }, [])

  useEffect(() => {
    if (!supabaseConfigured) return
    let sub
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      setAuthReady(true)
      await refreshParentLink(data.session)
      const listener = supabase.auth.onAuthStateChange((_event, s) => {
        setSession(s)
        refreshParentLink(s)
      })
      sub = listener.data.subscription
    })
    return () => sub?.unsubscribe()
  }, [supabaseConfigured, refreshParentLink])

  // --- Öğretmen ---
  const signIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])

  const signUp = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { role: 'ogretmen' } },
    })
    if (error) throw error
  }, [])

  // --- Veli hesabı ---
  const parentSignUp = useCallback(async (fullName, email, password, code) => {
    const normalized = code.trim().toUpperCase()
    if (!fullName.trim()) throw new Error('Adınızı girin.')
    if (!email.trim()) throw new Error('E-posta gerekli.')
    if (password.length < 6) throw new Error('Şifre en az 6 karakter olmalı.')
    if (!normalized) throw new Error('Erişim kodu gerekli.')

    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { role: 'veli', full_name: fullName.trim() } },
    })
    if (error) throw error

    // E-posta onayı kapalıysa oturum hemen açılmıştır → kodu şimdi bağla
    const { data: sess } = await supabase.auth.getSession()
    if (sess.data.session) {
      const { error: linkError } = await supabase.rpc('parent_link', { p_code: normalized })
      if (linkError) {
        await supabase.auth.signOut()
        throw new Error('Erişim kodu geçersiz — hesap oluşturulmadı. Kodu kontrol edip tekrar deneyin.')
      }
      return 'Hesabın oluşturuldu ve öğrencin bağlandı!'
    }
    return 'Hesabın oluşturuldu. E-posta doğrulaması gerekiyorsa kutunu kontrol et, sonra giriş yapıp kodu bağla.'
  }, [])

  const parentAccountSignIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])

  const parentLink = useCallback(async (code) => {
    const normalized = code.trim().toUpperCase()
    if (!normalized) throw new Error('Erişim kodu boş olamaz.')
    const { data, error } = await supabase.rpc('parent_link', { p_code: normalized })
    if (error) throw error
    setLinkedStudent(data ?? null)
    return data
  }, [])

  const parentUnlink = useCallback(async () => {
    const { error } = await supabase.rpc('parent_unlink')
    if (error) throw error
    setLinkedStudent(null)
  }, [])

  // --- Hızlı (hesapsız) veli girişi ---
  const parentLogin = useCallback(async (code) => {
    const normalized = code.trim().toUpperCase()
    if (!normalized) throw new Error('Erişim kodu boş olamaz.')
    setParentCode(normalized)
    saveParentCode(normalized)
    return normalized
  }, [])

  const parentLogout = useCallback(() => {
    setParentCode('')
    saveParentCode('')
  }, [])

  const changePassword = useCallback(async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    if (supabaseConfigured) await supabase.auth.signOut()
    setLinkedStudent(undefined)
  }, [])

  const isParentAccount = session?.user?.user_metadata?.role === 'veli'

  const value = {
    supabaseConfigured,
    authReady,
    session,
    isAuthed: Boolean(session),
    isLocalMode: !supabaseConfigured,
    accountEmail: session?.user?.email || '',
    // Öğretmen / veli hesabı ayrımı
    isParentAccount,
    linkedStudent,
    parentSignUp,
    parentAccountSignIn,
    parentLink,
    parentUnlink,
    changePassword,
    // Hızlı kod girişi
    parentCode,
    isParent: Boolean(parentCode),
    parentLogin,
    parentLogout,
    signIn,
    signUp,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth, AuthProvider içinde kullanılmalı')
  return ctx
}
