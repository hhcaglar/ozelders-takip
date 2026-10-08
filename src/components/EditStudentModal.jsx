import { useState } from 'react'
import { Button, Modal } from './ui.jsx'

// Öğrenci bilgilerini düzenle (yalnızca öğretmen)
export function EditStudentModal({ student, onClose, onSave }) {
  const [name, setName] = useState(student.name)
  const [grade, setGrade] = useState(student.grade || '')
  const [parentName, setParentName] = useState(student.parentName || '')
  const [parentPhone, setParentPhone] = useState(student.parentPhone || '')

  const submit = () => {
    if (!name.trim()) return
    onSave({
      name: name.trim(),
      grade: grade.trim(),
      parentName: parentName.trim(),
      parentPhone: parentPhone.trim(),
    })
  }

  return (
    <Modal title="Öğrenci Bilgilerini Düzenle" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <label style={labelStyle}>
          Öğrenci adı
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label style={labelStyle}>
          Sınıf
          <input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="örn. 8. Sınıf" />
        </label>
        <label style={labelStyle}>
          Veli adı
          <input value={parentName} onChange={(e) => setParentName(e.target.value)} />
        </label>
        <label style={labelStyle}>
          Veli telefonu
          <input
            value={parentPhone}
            onChange={(e) => setParentPhone(e.target.value)}
            placeholder="90XXXXXXXXXX"
            inputMode="tel"
          />
        </label>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
        <Button variant="ghost" onClick={onClose}>
          Vazgeç
        </Button>
        <Button onClick={submit}>Kaydet</Button>
      </div>
    </Modal>
  )
}

const labelStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 5,
  fontSize: 12.5,
  fontWeight: 600,
  color: '#6B7684',
}
