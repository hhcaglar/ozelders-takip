import { useState } from 'react'
import { Button, Modal } from './ui.jsx'

export function AddStudentModal({ onClose, onAdd }) {
  const [name, setName] = useState('')
  const [grade, setGrade] = useState('')
  const [parentName, setParentName] = useState('')
  const [parentPhone, setParentPhone] = useState('')

  const submit = () => {
    if (!name.trim()) return
    onAdd({
      name: name.trim(),
      grade: grade.trim(),
      parentName: parentName.trim(),
      parentPhone: parentPhone.trim(),
    })
  }

  return (
    <Modal title="Yeni Öğrenci Ekle" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input placeholder="Öğrenci adı" value={name} onChange={(e) => setName(e.target.value)} />
        <input placeholder="Sınıf (örn. 8. Sınıf)" value={grade} onChange={(e) => setGrade(e.target.value)} />
        <input placeholder="Veli adı" value={parentName} onChange={(e) => setParentName(e.target.value)} />
        <input
          placeholder="Veli telefonu (90XXXXXXXXXX)"
          value={parentPhone}
          onChange={(e) => setParentPhone(e.target.value)}
          inputMode="tel"
        />
        <p style={{ margin: 0, fontSize: 12, color: '#8A94A0', lineHeight: 1.4 }}>
          Öğrenci eklendiğinde otomatik bir <b>veli erişim kodu</b> üretilir. Kodu Rapor sekmesinden
          veli ile paylaşabilirsin.
        </p>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
        <Button variant="ghost" onClick={onClose}>
          Vazgeç
        </Button>
        <Button onClick={submit}>Ekle</Button>
      </div>
    </Modal>
  )
}
