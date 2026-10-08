import { LayoutDashboard, ChevronRight, ClipboardList } from 'lucide-react'
import { Card, SectionHeader, EmptyState, StatBox } from '../ui.jsx'
import {
  doneTopics,
  totalTopics,
  homeworkStats,
  lastNet,
  lastSortedExams,
  examNet,
  todayISO,
  formatDate,
  initialsOf,
  avatarColorOf,
} from '../../lib/utils.js'
import { fontSerif } from '../../lib/theme.js'

function Bar({ label, done, total, color }) {
  const percent = total ? Math.round((done / total) * 100) : 0
  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 11.5,
          color: '#6B7684',
          marginBottom: 4,
        }}
      >
        <span style={{ fontWeight: 700 }}>{label}</span>
        <span>
          {done}/{total}
        </span>
      </div>
      <div style={{ height: 7, background: 'var(--paper)', borderRadius: 999, overflow: 'hidden' }}>
        <div
          style={{ height: '100%', width: `${percent}%`, background: color, borderRadius: 999, transition: 'width .2s' }}
        />
      </div>
    </div>
  )
}

// Tüm öğrencilerden toplanan uyarılar (geciken ödev, net düşüşü, yarım kalan ders)
function collectAlerts(students) {
  const today = todayISO()
  const alerts = []
  students.forEach((s) => {
    s.homeworks
      .filter((h) => h.status !== 'teslim' && h.dueDate < today)
      .forEach((h) =>
        alerts.push({
          id: h.id,
          studentId: s.id,
          tone: 'danger',
          text: `${s.name}: "${h.title}" ödevinin teslim tarihi geçti (${formatDate(h.dueDate)})`,
        })
      )
    const exams = lastSortedExams(s)
    if (exams.length >= 2) {
      const a = examNet(exams[exams.length - 1])
      const b = examNet(exams[exams.length - 2])
      if (a < b)
        alerts.push({ id: `net-${s.id}`, studentId: s.id, tone: 'warn', text: `${s.name}: sınav neti düştü (${b} → ${a})` })
    }
    s.subjects.forEach((sub) => {
      if (sub.topics.length > 0 && sub.topics.filter((t) => t.done).length / sub.topics.length < 0.5) {
        alerts.push({
          id: `sub-${s.id}-${sub.id}`,
          studentId: s.id,
          tone: 'info',
          text: `${s.name}: ${sub.name} konularının yarısından azı tamamlandı`,
        })
      }
    })
  })
  return alerts
}

const TONE = {
  danger: { bg: '#FBEAE6', fg: '#B23A22' },
  warn: { bg: '#FFF7E6', fg: '#8A5A00' },
  info: { bg: '#EAF0F7', fg: 'var(--navy)' },
}

export function OverviewTab({ students, onOpenStudent }) {
  if (!students.length) {
    return <EmptyState text="Henüz öğrenci yok. Kenar çubuğundaki + ile ilk öğrencini ekle." />
  }

  const agg = students.reduce(
    (acc, s) => {
      acc.topics += totalTopics(s)
      acc.topicsDone += doneTopics(s)
      const hw = homeworkStats(s)
      acc.hw += hw.total
      acc.hwDone += hw.delivered
      const net = lastNet(s)
      if (net !== null) acc.nets.push(net)
      return acc
    },
    { topics: 0, topicsDone: 0, hw: 0, hwDone: 0, nets: [] }
  )
  const avgNet = agg.nets.length
    ? Math.round((agg.nets.reduce((a, b) => a + b, 0) / agg.nets.length) * 10) / 10
    : null

  const shownAlerts = collectAlerts(students).slice(0, 8)

  return (
    <div>
      <SectionHeader icon={LayoutDashboard}>Genel Bakış</SectionHeader>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
        <StatBox label="Toplam öğrenci" value={students.length} />
        <StatBox
          label="Konu ilerlemesi"
          value={agg.topics ? `%${Math.round((agg.topicsDone / agg.topics) * 100)}` : '-'}
        />
        <StatBox label="Ödev teslimi" value={agg.hw ? `%${Math.round((agg.hwDone / agg.hw) * 100)}` : '-'} />
        <StatBox label="Ort. son net" value={avgNet ?? '-'} accent />
      </div>

      {shownAlerts.length > 0 && (
        <Card style={{ marginBottom: 18, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10, fontSize: 13, fontWeight: 700 }}>
            <ClipboardList size={15} color="var(--coral)" /> Dikkat gerektirenler
            <span style={{ fontWeight: 600, color: '#8A94A0', fontSize: 11.5 }}>(tüm öğrenciler)</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {shownAlerts.map((a) => (
              <button
                key={a.id}
                onClick={() => onOpenStudent(a.studentId)}
                className="dt-side-btn-light"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  background: TONE[a.tone].bg,
                  color: TONE[a.tone].fg,
                  border: 'none',
                  borderRadius: 9,
                  padding: '9px 12px',
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                }}
              >
                <span>{a.text}</span>
                <ChevronRight size={14} style={{ flexShrink: 0 }} />
              </button>
            ))}
          </div>
        </Card>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 14 }}>
        {students.map((s) => {
          const tTopics = totalTopics(s)
          const dTopics = doneTopics(s)
          const hw = homeworkStats(s)
          const net = lastNet(s)
          return (
            <Card key={s.id} style={{ cursor: 'pointer' }}>
              <div
                onClick={() => onOpenStudent(s.id)}
                style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: avatarColorOf(s.name),
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: 16,
                      fontFamily: fontSerif,
                      boxShadow: '0 4px 10px rgba(30,58,95,.2)',
                      flexShrink: 0,
                    }}
                  >
                    {initialsOf(s.name)}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 15,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {s.name}
                    </div>
                    <div style={{ fontSize: 12, color: '#8A94A0' }}>{s.grade || '—'}</div>
                  </div>
                  {net !== null && (
                    <span
                      style={{
                        background: '#FFF4DC',
                        color: '#8A5A00',
                        fontWeight: 800,
                        fontSize: 12.5,
                        padding: '4px 9px',
                        borderRadius: 999,
                        flexShrink: 0,
                      }}
                    >
                      {net} net
                    </span>
                  )}
                </div>
                <Bar label="Konular" done={dTopics} total={tTopics} color="linear-gradient(90deg,#4CA06F,#3F8F5F)" />
                <Bar
                  label="Ödevler"
                  done={hw.delivered}
                  total={hw.total}
                  color="linear-gradient(90deg,#F0B429,#E3A008)"
                />
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    color: 'var(--navy)',
                    fontWeight: 700,
                    fontSize: 12.5,
                  }}
                >
                  Öğrenciyi aç <ChevronRight size={14} />
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
