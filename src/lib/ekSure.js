// Ek Süre (Microsoft Family Safety) — tarayıcı tarafı istemci.
// Veritabanı işlemleri security definer RPC'lerle, Microsoft işlemleri
// Vercel sunucu fonksiyonlarıyla (/api/aile-*) yapılır. Microsoft belirteci
// tarayıcıya hiçbir zaman gelmez.
import { useEffect, useState } from 'react'
import { supabase, supabaseConfigured } from './supabaseClient.js'
import schedulerTemplate from '../../supabase/ek-sure-zamanlayici.sql?raw'
import { fillSchedulerSql } from './ekSureKurulum.js'

export const ekSureAvailable = supabaseConfigured

async function rpc(name, args) {
  const { data, error } = await supabase.rpc(name, args)
  if (error) {
    if (error.code === 'PGRST202' || /could not find the function/i.test(error.message || '')) {
      throw new Error('Veritabanı güncel değil: supabase/schema.sql dosyasını Supabase SQL Editor\'de yeniden çalıştırın.')
    }
    throw new Error(error.message || 'Veritabanı hatası')
  }
  return data
}

export const fsOverview = (studentId) => rpc('fs_overview', { p_student: studentId })
export const fsLinkStudent = (studentId, member) =>
  rpc('fs_link_student', { p_student: studentId, p_child_id: member.id, p_child_name: member.name })
export const fsUnlinkStudent = (studentId) => rpc('fs_unlink_student', { p_student: studentId })
export const fsUpdateSettings = (studentId, s) =>
  rpc('fs_update_settings', {
    p_student: studentId,
    p_enabled: s.enabled ?? null,
    p_minutes: s.minutes ?? null,
    p_daily_max: s.dailyMax ?? null,
    p_scope: s.scope ?? null,
    p_app_filter: s.appFilter ?? null,
  })
export const fsAddCredit = (studentId, note) => rpc('fs_add_credit', { p_student: studentId, p_note: note || null })
export const fsCancelCredit = (creditId) => rpc('fs_cancel_credit', { p_credit: creditId })
export const fsDisconnect = () => rpc('fs_disconnect', {})

async function api(path, { method = 'GET', body } = {}) {
  const { data } = await supabase.auth.getSession()
  const token = data?.session?.access_token
  let res
  try {
    res = await fetch(path, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new Error('Sunucuya ulaşılamadı — internet bağlantınızı kontrol edin.')
  }
  const json = await res.json().catch(() => null)
  if (!res.ok) {
    if (res.status === 404 && !json) {
      throw new Error('Sunucu fonksiyonları bulunamadı. Site Vercel\'de yayınlanıyor mu? (Yerel geliştirmede bu normaldir.)')
    }
    throw new Error(json?.hata || `Sunucu hatası (${res.status})`)
  }
  return json
}

export const connectMicrosoft = (adres) => api('/api/aile-baglan', { method: 'POST', body: { adres } })
export const listFamilyMembers = () => api('/api/aile-cocuklar')
export const syncNow = () => api('/api/aile-senkron', { method: 'POST', body: {} })

/** Sunucu kurulum durumu; fonksiyonlar yoksa null döner (hata fırlatmaz). */
export async function serverStatus() {
  try {
    const res = await fetch('/api/aile-durum', { headers: { Accept: 'application/json' } })
    if (!res.ok) return null
    const json = await res.json().catch(() => null)
    return json?.sunucu ? json : null
  } catch {
    return null
  }
}

export const schedulerSql = (siteUrl, secret) => fillSchedulerSql(schedulerTemplate, siteUrl, secret)

// Gizli anahtar, kurulum yarım kalırsa aynı değerle devam edilebilsin diye
// yalnızca öğretmenin kendi tarayıcısında saklanır.
const SECRET_KEY = 'ders-takip:senkron-anahtari'
export function loadSetupSecret() {
  try {
    return localStorage.getItem(SECRET_KEY) || ''
  } catch {
    return ''
  }
}
export function saveSetupSecret(value) {
  try {
    value ? localStorage.setItem(SECRET_KEY, value) : localStorage.removeItem(SECRET_KEY)
  } catch {
    /* önemsiz */
  }
}

/**
 * Ödevler sekmesi için hafif özet: öğrenci eşleşmiş mi, hangi ödevin hakkı var?
 * Otomatik kayıt bittikçe (saveVersion) yenilenir; hata olursa sessizce null kalır.
 */
export function useEkSureOzet(studentId, saveVersion, enabled) {
  const [overview, setOverview] = useState(null)
  useEffect(() => {
    if (!enabled || !studentId) {
      setOverview(null)
      return undefined
    }
    let cancelled = false
    fsOverview(studentId)
      .then((data) => !cancelled && setOverview(data))
      .catch(() => !cancelled && setOverview(null))
    return () => {
      cancelled = true
    }
  }, [studentId, saveVersion, enabled])
  return overview
}
