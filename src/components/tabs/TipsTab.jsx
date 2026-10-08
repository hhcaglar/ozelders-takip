import { Lightbulb, TriangleAlert, CircleCheck, Info } from 'lucide-react'
import { SectionHeader } from '../ui.jsx'
import { netOf, examNet, todayISO, formatDate, doneTopics, totalTopics, lastSortedExams } from '../../lib/utils.js'

// Öğrenci verisinden kural tabanlı öneriler üretir
export function buildSuggestions(student) {
  const tips = []

  student.subjects.forEach((subject) => {
    if (
      subject.topics.length > 0 &&
      subject.topics.filter((t) => t.done).length / subject.topics.length < 0.5
    ) {
      tips.push({
        type: 'warn',
        text: `${subject.name} dersinde konuların yarısından azı tamamlandı — tekrar planı oluştur.`,
      })
    }
  })

  student.homeworks
    .filter((h) => h.status !== 'teslim' && h.dueDate < todayISO())
    .forEach((h) => {
      tips.push({ type: 'danger', text: `"${h.title}" ödevinin teslim tarihi geçti (${formatDate(h.dueDate)}).` })
    })

  const exams = lastSortedExams(student)
  if (exams.length >= 2) {
    const last = examNet(exams[exams.length - 1])
    const prev = examNet(exams[exams.length - 2])
    if (last < prev) {
      tips.push({ type: 'warn', text: `Son sınavda net düşüşü var (${prev} → ${last}). Ek çalışma planlanmalı.` })
    } else {
      tips.push({ type: 'good', text: `Net gelişimi olumlu (${prev} → ${last}). Bu tempoyu korumak için pekiştirme önerilir.` })
    }
  } else if (exams.length === 0) {
    tips.push({ type: 'info', text: 'Henüz sınav sonucu girilmedi — gelişimi izlemek için ilk test/deneme sonucunu ekle.' })
  }

  if (tips.length === 0) {
    tips.push({ type: 'good', text: 'Şu an için dikkat gerektiren bir durum yok, öğrenci iyi gidiyor.' })
  }
  return tips
}

const ICONS = { warn: TriangleAlert, danger: TriangleAlert, good: CircleCheck, info: Info }
const COLORS = { warn: '#B8860B', danger: 'var(--coral)', good: 'var(--sage)', info: 'var(--navy)' }
const BGS = { warn: '#FFF7E6', danger: '#FBEAE6', good: '#EAF6EE', info: '#EAF0F7' }

export function TipsTab({ student }) {
  const tips = buildSuggestions(student)
  return (
    <div>
      <SectionHeader icon={Lightbulb}>Akıllı Öneriler</SectionHeader>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {tips.map((tip, i) => {
          const Icon = ICONS[tip.type]
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                background: BGS[tip.type],
                color: COLORS[tip.type],
                borderRadius: 10,
                padding: '11px 14px',
                fontSize: 13.5,
                lineHeight: 1.45,
              }}
            >
              <Icon size={17} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{tip.text}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
