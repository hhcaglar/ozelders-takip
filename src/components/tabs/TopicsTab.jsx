import { useState } from 'react'
import { BookOpen, Plus, Trash2, X } from 'lucide-react'
import { Card, Button, SectionHeader, EmptyState, CheckToggle } from '../ui.jsx'
import { uid } from '../../lib/utils.js'

export function TopicsTab({ student, isTeacher, update }) {
  const [newSubject, setNewSubject] = useState('')
  const [topicDrafts, setTopicDrafts] = useState({})

  const addSubject = () => {
    const name = newSubject.trim()
    if (!name) return
    update((s) => ({
      ...s,
      subjects: [...s.subjects, { id: uid(), name, topics: [] }],
    }))
    setNewSubject('')
  }

  const removeSubject = (subjectId) =>
    update((s) => ({ ...s, subjects: s.subjects.filter((x) => x.id !== subjectId) }))

  const addTopic = (subjectId) => {
    const name = (topicDrafts[subjectId] || '').trim()
    if (!name) return
    update((s) => ({
      ...s,
      subjects: s.subjects.map((sub) =>
        sub.id === subjectId
          ? { ...sub, topics: [...sub.topics, { id: uid(), name, done: false }] }
          : sub
      ),
    }))
    setTopicDrafts((d) => ({ ...d, [subjectId]: '' }))
  }

  const toggleTopic = (subjectId, topicId) =>
    update((s) => ({
      ...s,
      subjects: s.subjects.map((sub) =>
        sub.id === subjectId
          ? {
              ...sub,
              topics: sub.topics.map((t) => (t.id === topicId ? { ...t, done: !t.done } : t)),
            }
          : sub
      ),
    }))

  const removeTopic = (subjectId, topicId) =>
    update((s) => ({
      ...s,
      subjects: s.subjects.map((sub) =>
        sub.id === subjectId
          ? { ...sub, topics: sub.topics.filter((t) => t.id !== topicId) }
          : sub
      ),
    }))

  return (
    <div>
      <SectionHeader icon={BookOpen}>Konu Takibi</SectionHeader>

      {student.subjects.length === 0 && (
        <EmptyState text="Henüz ders eklenmemiş. Aşağıdan ilk dersi ekleyebilirsin." />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
        {student.subjects.map((subject) => {
          const done = subject.topics.filter((t) => t.done).length
          const percent = subject.topics.length ? Math.round((done / subject.topics.length) * 100) : 0
          return (
            <Card key={subject.id}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontFamily: 'Newsreader, serif', fontSize: 17, fontWeight: 600, margin: 0 }}>
                  {subject.name}
                </h3>
                {isTeacher && (
                  <button
                    onClick={() => removeSubject(subject.id)}
                    title="Dersi sil"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B7C1CC', padding: 2 }}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              <div style={{ height: 6, background: 'var(--paper)', borderRadius: 999, margin: '10px 0 8px', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${percent}%`,
                    background: 'var(--sage)',
                    borderRadius: 999,
                    transition: 'width .2s',
                  }}
                />
              </div>
              <div style={{ fontSize: 12, color: '#6B7684', marginBottom: 8 }}>
                {done}/{subject.topics.length} konu tamamlandı
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {subject.topics.map((topic) => (
                  <div key={topic.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    <button
                      onClick={() => isTeacher && toggleTopic(subject.id, topic.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 7,
                        background: 'none',
                        border: 'none',
                        cursor: isTeacher ? 'pointer' : 'default',
                        padding: '3px 0',
                        fontSize: 13.5,
                        color: 'var(--ink)',
                      }}
                    >
                      <CheckToggle checked={topic.done} />
                      <span style={{ textDecoration: topic.done ? 'line-through' : 'none', color: topic.done ? '#8A94A0' : 'inherit' }}>
                        {topic.name}
                      </span>
                    </button>
                    {isTeacher && (
                      <button
                        onClick={() => removeTopic(subject.id, topic.id)}
                        title="Konuyu sil"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B7C1CC', padding: 2 }}
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {isTeacher && (
                <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                  <input
                    placeholder="Yeni konu ekle…"
                    value={topicDrafts[subject.id] || ''}
                    onChange={(e) => setTopicDrafts((d) => ({ ...d, [subject.id]: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && addTopic(subject.id)}
                    style={{ flex: 1, minWidth: 0 }}
                  />
                  <Button size="sm" variant="ghost" icon={Plus} onClick={() => addTopic(subject.id)}>
                    Ekle
                  </Button>
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {isTeacher && (
        <div style={{ display: 'flex', gap: 8, marginTop: 16, maxWidth: 420 }}>
          <input
            placeholder="Yeni ders adı (örn. Fen Bilimleri)"
            value={newSubject}
            onChange={(e) => setNewSubject(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addSubject()}
            style={{ flex: 1, minWidth: 0 }}
          />
          <Button icon={Plus} onClick={addSubject}>
            Ders Ekle
          </Button>
        </div>
      )}
    </div>
  )
}
