// Arayüz testi için src/lib/ekSure.js'in bellek içi taklidi (bulut modu).
import { useEffect, useState } from 'react'

const members = [
  { id: '9007199254740993', name: 'Elif Demir', role: 'User', monitored: true },
  { id: '1055519684390826', name: 'Ayşe Demir', role: 'Admin', monitored: false },
]

const state = {
  connection: null,
  link: null,
  credits: [],
  events: [],
  nextId: 1,
  server: { sunucu: true, servisAnahtari: true, senkronAnahtari: false, veritabani: 'hazir' },
}
const calls = []
globalThis.__ekSureMock = { state, calls }

const now = () => new Date().toISOString()
function build() {
  const byHomework = {}
  for (const c of state.credits) if (c.homework_id) byHomework[c.homework_id] = { status: c.status, minutes: c.minutes }
  return {
    connection: state.connection,
    link: state.link,
    credits: [...state.credits].reverse(),
    by_homework: byHomework,
    available: state.credits.filter((c) => c.status === 'hazir').length,
    used_today: state.credits.filter((c) => c.status === 'kullanildi').length,
    used_total: state.credits.filter((c) => c.status === 'kullanildi').length,
    waiting_total: state.credits.filter((c) => c.status === 'hazir').length,
    events: [...state.events].reverse(),
    server_time: now(),
  }
}
const delay = () => new Promise((r) => setTimeout(r, 5))

export const ekSureAvailable = true

export async function fsOverview(studentId) {
  calls.push(['fsOverview', studentId])
  await delay()
  return build()
}
export async function connectMicrosoft(adres) {
  calls.push(['connectMicrosoft', adres])
  await delay()
  if (!String(adres).includes('code=')) throw new Error('Adreste "code=" bulunamadı.')
  state.connection = { ms_user_id: 'ebeveyn', status: 'ok', last_error: null, last_sync_at: null, created_at: now() }
  state.events.push({ id: state.nextId++, kind: 'baglanti', message: 'Microsoft hesabı bağlandı', created_at: now() })
  return { ok: true, uyeler: members }
}
export async function listFamilyMembers() {
  calls.push(['listFamilyMembers'])
  await delay()
  return { uyeler: members }
}
export async function fsLinkStudent(studentId, member) {
  calls.push(['fsLinkStudent', studentId, member.id])
  await delay()
  state.link = { ms_child_id: member.id, ms_child_name: member.name, enabled: true, minutes_per_credit: 60, daily_max: 1, request_scope: 'hepsi', app_filter: '' }
  return build()
}
export async function fsUnlinkStudent(studentId) {
  calls.push(['fsUnlinkStudent', studentId])
  state.link = null
  return build()
}
export async function fsUpdateSettings(studentId, s) {
  calls.push(['fsUpdateSettings', studentId, s])
  await delay()
  state.link = { ...state.link, enabled: s.enabled, minutes_per_credit: s.minutes, daily_max: s.dailyMax, request_scope: s.scope, app_filter: s.appFilter }
  return build()
}
export async function fsAddCredit(studentId, note) {
  calls.push(['fsAddCredit', studentId, note])
  await delay()
  state.credits.push({ id: state.nextId++, homework_id: null, title: note || 'Elle eklenen hak', minutes: state.link?.minutes_per_credit ?? 60, status: 'hazir', created_at: now() })
  return build()
}
export async function fsCancelCredit(id) {
  calls.push(['fsCancelCredit', id])
  await delay()
  const c = state.credits.find((x) => x.id === id)
  if (c && c.status === 'hazir') Object.assign(c, { status: 'iptal', note: 'Öğretmen iptal etti' })
  return build()
}
export async function fsDisconnect() {
  calls.push(['fsDisconnect'])
  state.connection = null
}
export async function syncNow() {
  calls.push(['syncNow'])
  await delay()
  const c = state.credits.find((x) => x.status === 'hazir')
  if (!c) return { baglanti: 1, onaylanan: 0, bekletilen: 0, hatalar: [] }
  Object.assign(c, { status: 'kullanildi', used_at: now(), app_name: 'Minecraft', request_type: 'AppScreenTime' })
  state.connection.last_sync_at = now()
  state.events.push({ id: state.nextId++, kind: 'onay', message: `"Minecraft" uygulaması için +${c.minutes} dk onaylandı — hak: ${c.title}`, created_at: now() })
  return { baglanti: 1, onaylanan: 1, bekletilen: 0, hatalar: [] }
}
export async function serverStatus() {
  calls.push(['serverStatus'])
  return state.server
}
export const schedulerSql = (siteUrl, secret) => `-- zamanlayici ${siteUrl} ${secret}`
let secretStore = ''
export const loadSetupSecret = () => secretStore
export const saveSetupSecret = (v) => {
  secretStore = v
}

export function useEkSureOzet(studentId, saveVersion, enabled) {
  const [overview, setOverview] = useState(null)
  useEffect(() => {
    if (!enabled) return undefined
    let cancelled = false
    fsOverview(studentId).then((d) => !cancelled && setOverview(d))
    return () => {
      cancelled = true
    }
  }, [studentId, saveVersion, enabled])
  return overview
}
