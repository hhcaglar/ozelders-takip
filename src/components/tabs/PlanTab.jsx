import { useEffect } from 'react'
import { CalendarDays, CircleCheck, Circle } from 'lucide-react'
import { Card, SectionHeader } from '../ui.jsx'
import { uid, DAYS } from '../../lib/utils.js'

export function PlanTab({ student, isTeacher, update }) {
  // Haftalık plan boşsa 7 günlük iskelet oluştur (bir kez)
  useEffect(() => {
    if (!student.weeklyPlan.length) {
      update((s) => ({
        ...s,
        weeklyPlan: DAYS.map((day) => ({ id: uid(), day, task: '', done: false })),
      }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const plan = student.weeklyPlan.length
    ? student.weeklyPlan
    : DAYS.map((day) => ({ id: day, day, task: '', done: false }))

  const setTask = (id, task) =>
    update((s) => ({
      ...s,
      weeklyPlan: (s.weeklyPlan.length ? s.weeklyPlan : plan).map((p) => (p.id === id ? { ...p, task } : p)),
    }))

  const toggleDone = (id) =>
    update((s) => ({
      ...s,
      weeklyPlan: (s.weeklyPlan.length ? s.weeklyPlan : plan).map((p) =>
        p.id === id ? { ...p, done: !p.done } : p
      ),
    }))

  return (
    <div>
      <SectionHeader icon={CalendarDays}>Haftalık Çalışma Planı</SectionHeader>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
        {plan.map((day) => (
          <Card key={day.id} style={{ padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span
                style={{
                  fontWeight: 700,
                  fontSize: 13,
                  color: day.done ? 'var(--sage)' : 'var(--navy)',
                  textTransform: 'uppercase',
                  letterSpacing: 0.4,
                }}
              >
                {day.day}
              </span>
              <button
                onClick={() => isTeacher && toggleDone(day.id)}
                style={{ background: 'none', border: 'none', cursor: isTeacher ? 'pointer' : 'default', padding: 2 }}
                title={day.done ? 'Tamamlandı' : 'Tamamlanmadı'}
              >
                {day.done ? <CircleCheck size={16} color="var(--sage)" /> : <Circle size={16} color="#B7C1CC" />}
              </button>
            </div>
            {isTeacher ? (
              <textarea
                value={day.task}
                onChange={(e) => setTask(day.id, e.target.value)}
                placeholder="Görev ekle…"
                rows={3}
                style={{ resize: 'none', width: '100%' }}
              />
            ) : (
              <div style={{ minHeight: 40, fontSize: 13.5, color: day.task ? 'var(--ink)' : '#8A94A0' }}>
                {day.task || 'Görev yok'}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}
