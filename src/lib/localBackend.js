// Yerel (tarayıcı) depolama — Supabase yapılandırılmadığında tam işler.
// Anahtar adı v2: window.storage kullanan eski sürümden ayrışır.
const KEY = 'ders-takip:data-v2'

function safeGet() {
  try {
    return globalThis.localStorage?.getItem(KEY) ?? null
  } catch {
    return null // gizli pencere / depolama kapalı
  }
}

function safeSet(value) {
  try {
    globalThis.localStorage?.setItem(KEY, value)
    return true
  } catch {
    return false
  }
}

export const localBackend = {
  label: 'Yerel depolama',

  async loadAll() {
    const raw = safeGet()
    if (!raw) return null // ilk çalıştırma — demo veriye düşülür
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed.students) ? parsed.students : []
    } catch {
      return []
    }
  },

  async saveStudent(doc) {
    return safeSetFor(doc)
  },

  async deleteStudent(id) {
    const students = (await localBackend.loadAll()) || []
    return safeSet(JSON.stringify({ students: students.filter((s) => s.id !== id) }))
  },

  async replaceAll(students) {
    return safeSet(JSON.stringify({ students }))
  },
}

async function safeSetFor(doc) {
  const students = (await localBackend.loadAll()) || []
  const next = students.some((s) => s.id === doc.id)
    ? students.map((s) => (s.id === doc.id ? doc : s))
    : [...students, doc]
  return safeSet(JSON.stringify({ students: next }))
}

// Uygulama içi tercihler (rol, seçili öğrenci) — kritik veri değil
const UI_KEY = 'ders-takip:ui-v1'

export function loadUiPrefs() {
  try {
    return JSON.parse(localStorage.getItem(UI_KEY) || '{}')
  } catch {
    return {}
  }
}

export function saveUiPrefs(prefs) {
  try {
    localStorage.setItem(UI_KEY, JSON.stringify(prefs))
  } catch {
    /* önemsiz */
  }
}

export function loadParentCode() {
  try {
    return localStorage.getItem('ders-takip:parent-code') || ''
  } catch {
    return ''
  }
}

export function saveParentCode(code) {
  try {
    code ? localStorage.setItem('ders-takip:parent-code', code)
         : localStorage.removeItem('ders-takip:parent-code')
  } catch {
    /* önemsiz */
  }
}
