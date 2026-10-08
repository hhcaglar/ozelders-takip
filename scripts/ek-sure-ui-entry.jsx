// Arayüz testi düzeneği: Ek Süre ve Ödevler sekmeleri bulut modunda, sahte API ile.
import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { EkSureTab } from '../src/components/tabs/EkSureTab.jsx'
import { HomeworksTab } from '../src/components/tabs/HomeworksTab.jsx'

function Harness() {
  const [student, setStudent] = useState({
    id: 'ogrenci-1',
    name: 'Elif Demir',
    subjects: [],
    homeworks: [
      { id: 'h1', title: 'Üslü İfadeler s.24', subject: 'Matematik', dueDate: '2026-10-10', status: 'bekliyor' },
      { id: 'h2', title: 'Paragraf 20 soru', subject: 'Türkçe', dueDate: '2026-10-11', status: 'bekliyor' },
    ],
  })
  const [saveVersion, setSaveVersion] = useState(0)

  // Otomatik kayıt + veritabanı tetikleyicisinin taklidi
  const update = (updater) => {
    setStudent((prev) => {
      const next = updater(prev)
      const mock = globalThis.__ekSureMock
      for (const hw of next.homeworks) {
        const before = prev.homeworks.find((h) => h.id === hw.id)
        if (hw.status === 'teslim' && before?.status !== 'teslim' && mock.state.link?.enabled) {
          if (!mock.state.credits.some((c) => c.homework_id === hw.id)) {
            mock.state.credits.push({ id: mock.state.nextId++, homework_id: hw.id, title: hw.title, minutes: mock.state.link.minutes_per_credit, status: 'hazir', created_at: new Date().toISOString() })
          }
        }
      }
      setTimeout(() => setSaveVersion((v) => v + 1), 20)
      return next
    })
  }

  // App.jsx'teki gibi: aynı anda tek sekme görünür, geçişte sekme yeniden kurulur
  const [tab, setTab] = useState('eksure')
  return (
    <div>
      <nav>
        <button id="tab-eksure" onClick={() => setTab('eksure')}>SEKME Ek Süre</button>
        <button id="tab-odevler" onClick={() => setTab('odevler')}>SEKME Ödevler</button>
      </nav>
      <section id="aktif">
        {tab === 'eksure' && <EkSureTab student={student} saveVersion={saveVersion} />}
        {tab === 'odevler' && <HomeworksTab student={student} isTeacher update={update} saveVersion={saveVersion} />}
      </section>
    </div>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Harness />
  </StrictMode>
)
