import { Suspense, lazy, useState } from 'react'
import { TrendingUp, TrendingDown, Minus, Plus, Trash2 } from 'lucide-react'
import { Card, Button, SectionHeader, EmptyState } from '../ui.jsx'
import { ExamModal } from './ExamModal.jsx'
import { netOf, examNet, formatDate } from '../../lib/utils.js'

// recharts yalnızca bu grafikte kullanıldığı için ayrı parçaya
// derlenir (code-splitting): ilk yükleme bundle'ı küçülür.
const NetChart = lazy(() => import('../NetChart.jsx'))

export function ExamsTab({ student, isTeacher, update }) {
  const [showModal, setShowModal] = useState(false)

  const removeExam = (examId) =>
    update((s) => ({ ...s, exams: s.exams.filter((e) => e.id !== examId) }))

  const chartData = student.exams
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => ({ date: formatDate(e.date), net: examNet(e) }))

  const sortedDesc = student.exams.slice().sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div>
      <SectionHeader
        icon={TrendingUp}
        right={
          isTeacher && (
            <Button size="sm" icon={Plus} onClick={() => setShowModal(true)}>
              Sonuç Ekle
            </Button>
          )
        }
      >
        Test &amp; Deneme Sonuçları
      </SectionHeader>

      {student.exams.length === 0 ? (
        <EmptyState text="Henüz sınav sonucu yok. Öğretmen girişiyle ilk sonucu ekleyebilirsin." />
      ) : (
        <>
          <Card style={{ marginBottom: 14 }}>
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: 0.4,
                color: '#8A94A0',
                marginBottom: 10,
              }}
            >
              NET GELİŞİMİ
            </div>
            <div style={{ width: '100%', height: 220 }}>
              <Suspense fallback={<div style={{ color: '#8A94A0', fontSize: 13 }}>Grafik yükleniyor…</div>}>
                <NetChart data={chartData} />
              </Suspense>
            </div>
          </Card>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sortedDesc.map((exam, idx) => {
              const net = examNet(exam)
              const prev = sortedDesc[idx + 1]
              const prevNet = prev ? examNet(prev) : null
              const trend = prevNet === null ? null : net > prevNet ? 'up' : net < prevNet ? 'down' : 'flat'
              return (
                <Card key={exam.id} style={{ padding: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span
                        style={{
                          background: exam.type === 'deneme' ? '#EAF0F7' : '#FFF4DC',
                          color: exam.type === 'deneme' ? 'var(--navy)' : '#8A5A00',
                          fontWeight: 700,
                          fontSize: 11.5,
                          padding: '3px 9px',
                          borderRadius: 999,
                        }}
                      >
                        {exam.type === 'deneme' ? 'Deneme' : 'Test'}
                      </span>
                      <span style={{ fontSize: 13, color: '#6B7684' }}>{formatDate(exam.date)}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span
                        style={{ display: 'flex', alignItems: 'center', gap: 5 }}
                        title={prevNet !== null ? `Önceki sınav: ${prevNet} net` : undefined}
                      >
                        <span style={{ fontFamily: 'Newsreader, serif', fontSize: 18, fontWeight: 700, color: 'var(--navy)' }}>
                          {net} net
                        </span>
                        {trend === 'up' && <TrendingUp size={16} color="var(--sage)" />}
                        {trend === 'down' && <TrendingDown size={16} color="var(--coral)" />}
                        {trend === 'flat' && <Minus size={16} color="#8A94A0" />}
                      </span>
                      {isTeacher && (
                        <button
                          onClick={() => removeExam(exam.id)}
                          title="Sonucu sil"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B7C1CC', padding: 2 }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', marginTop: 8, fontSize: 13, color: '#6B7684' }}>
                    {exam.results.map((r, i) => (
                      <span key={i}>
                        {r.subject}: <b style={{ color: 'var(--ink)' }}>{r.dogru}D / {r.yanlis}Y</b> ({netOf(r.dogru, r.yanlis)} net)
                      </span>
                    ))}
                  </div>
                </Card>
              )
            })}
          </div>
        </>
      )}

      {showModal && (
        <ExamModal
          subjects={student.subjects.map((s) => s.name)}
          onClose={() => setShowModal(false)}
          onSave={(exam) => {
            update((s) => ({ ...s, exams: [...s.exams, exam] }))
            setShowModal(false)
          }}
        />
      )}
    </div>
  )
}
