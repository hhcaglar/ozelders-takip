// Ortak yardımcılar

export const DAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']

export function uid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  // Eski tarayıcılar için yedek
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

// Sınav neti: doğru - yanlış/4, tek ondalığa yuvarlanır
export const round1 = (n) => Math.round(n * 10) / 10
export const netOf = (dogru, yanlis) => round1(Math.max(0, dogru - yanlis / 4))

export const examNet = (exam) =>
  round1(exam.results.reduce((sum, r) => sum + netOf(r.dogru, r.yanlis), 0))

export const todayISO = () => new Date().toISOString().slice(0, 10)

export const formatDate = (iso) =>
  iso
    ? new Date(`${iso}T00:00:00`).toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: 'short',
      })
    : '-'

// Veli erişim kodu: okunması kolay, karışan karakterlerden arınmış 8 karakter
export function generateParentCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = new Uint8Array(8)
  globalThis.crypto?.getRandomValues
    ? crypto.getRandomValues(bytes)
    : bytes.forEach((_, i) => (bytes[i] = Math.floor(Math.random() * 256)))
  const chars = [...bytes].map((b) => alphabet[b % alphabet.length])
  return `${chars.slice(0, 4).join('')}-${chars.slice(4).join('')}`
}

export const waNumber = (phone) => (phone || '').replace(/\D/g, '')

export const totalTopics = (student) =>
  student.subjects.reduce((n, s) => n + s.topics.length, 0)

export const doneTopics = (student) =>
  student.subjects.reduce(
    (n, s) => n + s.topics.filter((t) => t.done).length,
    0
  )

export const lastSortedExams = (student) =>
  student.exams.slice().sort((a, b) => a.date.localeCompare(b.date))

export const lastNet = (student) => {
  const exams = lastSortedExams(student)
  return exams.length ? examNet(exams[exams.length - 1]) : null
}

export const homeworkStats = (student) => {
  const total = student.homeworks.length
  const delivered = student.homeworks.filter((h) => h.status === 'teslim').length
  return { total, delivered, percent: total ? Math.round((delivered / total) * 100) : null }
}

// İsimden baş harfler (örn. "Elif Demir" -> "ED")
export function initialsOf(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return parts.slice(0, 2).map((p) => p[0]?.toLocaleUpperCase('tr-TR') || '').join('')
}

const AVATAR_COLORS = ['#1E3A5F', '#3F8F5F', '#B8860B', '#D64933', '#6B4FA1', '#2C7A9E']

// İsimden deterministik renk (her öğrenci kendi rengine sahip)
export function avatarColorOf(name = '') {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 997
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}
