import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button, Modal } from '../ui.jsx'
import { uid, todayISO } from '../../lib/utils.js'

export function ExamModal({ subjects, onClose, onSave }) {
  const [type, setType] = useState('test')
  const [date, setDate] = useState(todayISO())
  const [rows, setRows] = useState([{ subject: subjects[0] || '', dogru: '', yanlis: '' }])

  const addRow = () => setRows((r) => [...r, { subject: subjects[0] || '', dogru: '', yanlis: '' }])
  const setRow = (i, patch) => setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)))
  const removeRow = (i) => setRows((r) => r.filter((_, idx) => idx !== i))

  const save = () => {
    const results = rows
      .filter((r) => r.subject.trim() && r.dogru !== '')
      .map((r) => ({
        subject: r.subject.trim(),
        dogru: Number(r.dogru) || 0,
        yanlis: Number(r.yanlis) || 0,
      }))
    if (!results.length) return
    onSave({ id: uid(), date, type, results })
  }

  return (
    <Modal title="Sınav Sonucu Ekle" onClose={onClose}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <label style={{ fontSize: 12.5, fontWeight: 600, color: '#6B7684', display: 'flex', flexDirection: 'column', gap: 5 }}>
          Tür
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="test">Test</option>
            <option value="deneme">Deneme</option>
          </select>
        </label>
        <label style={{ fontSize: 12.5, fontWeight: 600, color: '#6B7684', display: 'flex', flexDirection: 'column', gap: 5 }}>
          Tarih
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
        {rows.map((row, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 6, alignItems: 'center' }}>
            <input
              placeholder="Ders"
              value={row.subject}
              onChange={(e) => setRow(i, { subject: e.target.value })}
              list="subject-list"
            />
            <input
              placeholder="Doğru"
              type="number"
              min="0"
              value={row.dogru}
              onChange={(e) => setRow(i, { dogru: e.target.value })}
            />
            <input
              placeholder="Yanlış"
              type="number"
              min="0"
              value={row.yanlis}
              onChange={(e) => setRow(i, { yanlis: e.target.value })}
            />
            {rows.length > 1 && (
              <button
                onClick={() => removeRow(i)}
                aria-label="Satırı sil"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B7C1CC', padding: 4 }}
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        ))}
        <datalist id="subject-list">
          {subjects.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>

      {type === 'deneme' && (
        <Button size="sm" variant="ghost" icon={Plus} onClick={addRow} style={{ marginBottom: 14 }}>
          Ders Ekle
        </Button>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
        <Button variant="ghost" onClick={onClose}>
          Vazgeç
        </Button>
        <Button onClick={save}>Kaydet</Button>
      </div>
    </Modal>
  )
}
