import { useEffect, useState } from 'react'
import { ClipboardList, Plus, Trash2, Gamepad2 } from 'lucide-react'
import { Card, Button, SectionHeader, EmptyState, StatusPill, Chip, Banner } from '../ui.jsx'
import { uid, todayISO, formatDate } from '../../lib/utils.js'
import { ekSureAvailable, useEkSureOzet } from '../../lib/ekSure.js'
import { minutesLabel } from '../../lib/ekSureKurulum.js'

const FILTERS = [
  { id: 'tumu', label: 'Tümü' },
  { id: 'bekliyor', label: 'Bekleyen' },
  { id: 'geciken', label: 'Geciken' },
  { id: 'teslim', label: 'Teslim' },
]

// Teslim edilen ödevin ek süre hakkı durumu (Microsoft Family Safety)
const CREDIT_CHIP = {
  hazir: { label: 'hak hazır', bg: '#FFF4DC', fg: '#8A5A00' },
  ayrildi: { label: 'onaylanıyor', bg: '#EAF0F7', fg: '#1E3A5F' },
  kullanildi: { label: 'kullanıldı', bg: '#E5F4EA', fg: '#1F7A44' },
}

function CreditChip({ credit }) {
  const meta = CREDIT_CHIP[credit?.status]
  if (!meta) return null
  return (
    <span
      title="Bu ödev için tanımlanan bir seferlik ek süre hakkı (Ek Süre sekmesi)"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        background: meta.bg,
        color: meta.fg,
        fontSize: 11,
        fontWeight: 700,
        padding: '2px 8px',
        borderRadius: 999,
        whiteSpace: 'nowrap',
      }}
    >
      <Gamepad2 size={12} /> +{minutesLabel(credit.minutes)} · {meta.label}
    </span>
  )
}

export function HomeworksTab({ student, isTeacher, update, saveVersion = 0 }) {
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState(student.subjects[0]?.name || '')
  const [dueDate, setDueDate] = useState(todayISO())
  const [filter, setFilter] = useState('tumu')
  const [flash, setFlash] = useState('')

  const ek = useEkSureOzet(student.id, saveVersion, isTeacher && ekSureAvailable)
  const ekActive = Boolean(ek?.link?.enabled)

  useEffect(() => {
    if (!flash) return undefined
    const timer = setTimeout(() => setFlash(''), 7000)
    return () => clearTimeout(timer)
  }, [flash])

  const isOverdue = (hw) => hw.status !== 'teslim' && hw.dueDate < todayISO()

  const addHomework = () => {
    const t = title.trim()
    if (!t) return
    update((s) => ({
      ...s,
      homeworks: [
        ...s.homeworks,
        { id: uid(), title: t, subject: subject || 'Genel', dueDate, status: 'bekliyor' },
      ],
    }))
    setTitle('')
  }

  const setStatus = (id, status) => {
    const hw = student.homeworks.find((h) => h.id === id)
    if (ekActive && hw && status === 'teslim' && hw.status !== 'teslim') {
      const existing = ek.by_homework?.[id]
      const firstName = (student.name || 'Öğrenci').split(' ')[0]
      setFlash(
        existing?.status === 'kullanildi'
          ? `“${hw.title}” için ek süre hakkı daha önce kullanılmıştı; ikinci kez verilmez.`
          : `“${hw.title}” teslim edildi → ${firstName} için bir seferlik +${minutesLabel(ek.link.minutes_per_credit)} ek süre hakkı tanımlandı. Bilgisayardan süre istediğinde otomatik onaylanacak.`
      )
    }
    update((s) => ({
      ...s,
      homeworks: s.homeworks.map((h) => (h.id === id ? { ...h, status } : h)),
    }))
  }

  const remove = (id) =>
    update((s) => ({ ...s, homeworks: s.homeworks.filter((h) => h.id !== id) }))

  const sorted = student.homeworks.slice().sort((a, b) => a.dueDate.localeCompare(b.dueDate))

  const visible =
    filter === 'tumu'
      ? sorted
      : filter === 'geciken'
        ? sorted.filter((hw) => isOverdue(hw) || hw.status === 'gecikti')
        : sorted.filter((hw) => hw.status === filter)

  return (
    <div>
      <SectionHeader icon={ClipboardList}>Ödev Yönetimi</SectionHeader>

      {ekActive && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#6B7684', marginBottom: 10 }}>
          <Gamepad2 size={14} color="var(--navy)" />
          Teslim edilen her ödev bir seferlik +{minutesLabel(ek.link.minutes_per_credit)} ek süre hakkı kazandırır
          {ek.available > 0 ? ` · şu an ${ek.available} hak hazır` : ''}.
        </div>
      )}

      {flash && (
        <Banner tone="good" icon={Gamepad2} style={{ marginBottom: 12 }}>
          {flash}
        </Banner>
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {FILTERS.map((f) => (
          <Chip key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.label}
          </Chip>
        ))}
      </div>

      {visible.length === 0 && (
        <EmptyState text={filter === 'tumu' ? 'Henüz ödev atanmamış.' : 'Bu filtrede ödev yok.'} />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        {visible.map((hw) => {
          const overdue = isOverdue(hw)
          const credit = ek?.by_homework?.[hw.id]
          return (
            <Card key={hw.id} style={{ padding: 14, borderLeft: overdue ? '3px solid var(--coral)' : undefined }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{hw.title}</div>
                  <div style={{ fontSize: 12.5, color: '#6B7684', marginTop: 3, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span>
                      {hw.subject} · Teslim: {formatDate(hw.dueDate)}
                    </span>
                    {credit && <CreditChip credit={credit} />}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {isTeacher ? (
                    <select value={hw.status} onChange={(e) => setStatus(hw.id, e.target.value)}>
                      <option value="bekliyor">Bekliyor</option>
                      <option value="teslim">Teslim edildi</option>
                      <option value="gecikti">Gecikti</option>
                    </select>
                  ) : (
                    <StatusPill status={hw.status} />
                  )}
                  {isTeacher && (
                    <button
                      onClick={() => remove(hw.id)}
                      title="Ödevi sil"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B7C1CC', padding: 2 }}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {isTeacher && (
        <Card style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <input
            placeholder="Ödev başlığı…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addHomework()}
            style={{ flex: 2, minWidth: 160 }}
          />
          {student.subjects.length > 0 && (
            <select value={subject} onChange={(e) => setSubject(e.target.value)} style={{ flex: 1, minWidth: 110 }}>
              {student.subjects.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          <Button icon={Plus} onClick={addHomework}>
            Ödev Ekle
          </Button>
        </Card>
      )}
    </div>
  )
}
