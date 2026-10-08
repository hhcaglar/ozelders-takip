import { Phone, Trash2, Pencil } from 'lucide-react'
import { Button, StatBox } from './ui.jsx'
import { doneTopics, totalTopics, homeworkStats, lastNet } from '../lib/utils.js'

// Veli telefonu yalnızca yetkili (öğretmen) görünümünde tam gösterilir;
// bu bileşen zaten yalnızca oturum açılmışken render edilir.
export function StudentHeader({ student, isTeacher, onRemove, onEdit, showPhone = true }) {
  const total = totalTopics(student)
  const done = doneTopics(student)
  const hw = homeworkStats(student)
  const net = lastNet(student)

  return (
    <div
      style={{
        padding: '20px 24px 16px',
        borderBottom: '1px solid var(--line)',
        background: 'linear-gradient(180deg, #FFFFFF 0%, #F6F8FA 100%)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 16,
        flexWrap: 'wrap',
      }}
    >
      <div>
        <h1 style={{ fontFamily: 'Newsreader, serif', fontSize: 26, fontWeight: 700, margin: 0, color: 'var(--ink)' }}>
          {student.name}
        </h1>
        <div style={{ fontSize: 13, color: '#6B7684', marginTop: 3, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <span>{student.grade}</span>
          {student.parentName && <span>· Veli: {student.parentName}</span>}
          {student.parentPhone && showPhone && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <Phone size={12} /> {student.parentPhone}
            </span>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <StatBox label="İşlenen konu" value={`${done}/${total}`} />
        <StatBox label="Ödev tamamlama" value={hw.percent === null ? '-' : `%${hw.percent}`} />
        <StatBox label="Son sınav neti" value={net ?? '-'} accent />
        {isTeacher && (
          <>
            <Button variant="ghost" size="sm" icon={Pencil} onClick={onEdit} title="Öğrenci bilgilerini düzenle">
              Düzenle
            </Button>
            <Button variant="danger" size="sm" icon={Trash2} onClick={() => onRemove(student.id)}>
              Öğrenciyi sil
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
