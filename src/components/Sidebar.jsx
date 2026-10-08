import { useState } from 'react'
import { GraduationCap, Plus, RotateCcw, LogOut, PlusCircle, MinusCircle, Settings, Search } from 'lucide-react'
import { fontSans } from '../lib/theme.js'
import { useAuth } from '../lib/auth.jsx'
import { Button } from './ui.jsx'

export function Sidebar({
  students,
  activeStudentId,
  role,
  isTeacher,
  canEdit,
  saveError,
  isMobile,
  menuOpen,
  onCloseMenu,
  onSelectStudent,
  onAddStudent,
  onRemoveStudent,
  onResetDemo,
  onRoleChange,
  onOpenSettings,
}) {
  const { isLocalMode, session, signOut, isParentAccount } = useAuth()
  const [query, setQuery] = useState('')

  const q = query.trim().toLocaleLowerCase('tr-TR')
  const filtered = q
    ? students.filter(
        (s) =>
          s.name.toLocaleLowerCase('tr-TR').includes(q) ||
          (s.grade || '').toLocaleLowerCase('tr-TR').includes(q)
      )
    : students

  const panel = (
    <aside
      style={{
        width: 248,
        flexShrink: 0,
        background: 'linear-gradient(180deg, #23405F 0%, #16283F 100%)',
        color: '#EAF0F7',
        display: 'flex',
        flexDirection: 'column',
        padding: '18px 14px',
        height: '100%',
        overflowY: 'auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 4px 18px' }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 11,
            background: 'linear-gradient(135deg, #F0B429, #DD9A06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(227, 160, 8, 0.35)',
            flexShrink: 0,
          }}
        >
          <GraduationCap size={21} color="#1E3A5F" />
        </div>
        <span style={{ fontFamily: 'Newsreader, serif', fontSize: 20, fontWeight: 700, letterSpacing: 0.2 }}>
          DersTakip
        </span>
      </div>

      {isLocalMode ? (
        <div
          style={{
            display: 'flex',
            background: 'rgba(255,255,255,0.08)',
            borderRadius: 8,
            padding: 3,
            marginBottom: 16,
          }}
        >
          {[
            { id: 'ogretmen', label: 'Öğretmen', icon: PlusCircle },
            { id: 'veli', label: 'Veli', icon: MinusCircle },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => onRoleChange(id)}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                padding: '8px 4px',
                borderRadius: 7,
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 700,
                fontFamily: fontSans,
                background: role === id ? 'var(--amber)' : 'transparent',
                color: role === id ? '#2A1D00' : '#C9D6E4',
              }}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>
      ) : (
        <div
          style={{
            background: 'rgba(255,255,255,0.08)',
            borderRadius: 8,
            padding: '8px 10px',
            marginBottom: 16,
            fontSize: 12,
            color: '#C9D6E4',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div>
            <div style={{ fontWeight: 700, color: '#EAF0F7', wordBreak: 'break-all' }}>
              {session?.user?.email || 'Hesap'}
            </div>
            <div style={{ fontSize: 11, color: '#93A5BC', marginTop: 2 }}>
              {isParentAccount ? 'Veli hesabı' : 'Öğretmen hesabı'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={onOpenSettings}
              className="dt-side-btn"
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 6,
                color: '#C9D6E4',
                cursor: 'pointer',
                padding: '5px 8px',
                fontSize: 11.5,
                fontFamily: fontSans,
              }}
            >
              <Settings size={12} /> Ayarlar
            </button>
            <button
              onClick={signOut}
              title="Çıkış yap"
              className="dt-side-btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 6,
                color: '#C9D6E4',
                cursor: 'pointer',
                padding: '5px 8px',
              }}
            >
              <LogOut size={12} />
            </button>
          </div>
        </div>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 4px 6px',
        }}
      >
        <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 0.3, color: '#93A5BC' }}>
          {isTeacher ? `ÖĞRENCİLER${students.length ? ` (${students.length})` : ''}` : 'ÇOCUĞUNU SEÇ'}
        </span>
        {isTeacher && (
          <button
            onClick={onAddStudent}
            title="Öğrenci ekle"
            className="dt-side-btn"
            style={{ background: 'none', border: 'none', color: '#C9D6E4', cursor: 'pointer', padding: 2, borderRadius: 6 }}
          >
            <Plus size={16} />
          </button>
        )}
      </div>

      {students.length > 5 && isTeacher && (
        <div style={{ position: 'relative', marginBottom: 8 }}>
          <Search
            size={13}
            style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#93A5BC' }}
          />
          <input
            placeholder="Ara (ad/sınıf)…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: '#EAF0F7',
              borderRadius: 7,
              padding: '6px 8px 6px 26px',
              fontSize: 12,
            }}
          />
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {students.length === 0 && (
          <div style={{ color: '#93A5BC', fontSize: 12.5, padding: '8px 4px' }}>Henüz öğrenci yok.</div>
        )}
        {filtered.length === 0 && students.length > 0 && (
          <div style={{ color: '#93A5BC', fontSize: 12.5, padding: '8px 4px' }}>Eşleşen yok.</div>
        )}
        {filtered.map((student) => {
          const active = student.id === activeStudentId
          return (
            <div key={student.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
              <button
                onClick={() => {
                  onSelectStudent(student.id)
                  onCloseMenu?.()
                }}
                className="dt-side-btn"
                style={{
                  flex: 1,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 8,
                  textAlign: 'left',
                  padding: '10px 12px',
                  border: 'none',
                  borderRadius: 10,
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: fontSans,
                  background: active ? 'rgba(227,160,8,0.18)' : undefined,
                  color: active ? '#FFE9B8' : '#C9D6E4',
                  boxShadow: active ? 'inset 3px 0 0 0 var(--amber)' : 'none',
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {student.name}
                </span>
                <span style={{ fontSize: 11, color: '#93A5BC', flexShrink: 0 }}>{student.grade}</span>
              </button>
              {isTeacher && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemoveStudent(student.id)
                  }}
                  title="Öğrenciyi sil"
                  className="dt-side-btn"
                  style={{ background: 'none', border: 'none', color: '#7E8FA5', cursor: 'pointer', padding: 3, borderRadius: 6 }}
                >
                  ×
                </button>
              )}
            </div>
          )
        })}
      </div>

      {canEdit && (
        <button
          onClick={onResetDemo}
          className="dt-side-btn"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'none',
            border: 'none',
            color: '#93A5BC',
            fontSize: 12,
            cursor: 'pointer',
            padding: '4px 2px',
            marginTop: 8,
            borderRadius: 6,
          }}
        >
          <RotateCcw size={13} /> Örnek verilere sıfırla
        </button>
      )}

      {saveError && (
        <div style={{ color: '#F0B4A6', fontSize: 11, marginTop: 6, lineHeight: 1.4 }}>{saveError}</div>
      )}

      <div style={{ fontSize: 10.5, color: '#5F7188', marginTop: 10, textAlign: 'center' }}>DersTakip v3</div>
    </aside>
  )

  if (!isMobile) return panel

  return (
    <>
      {menuOpen && (
        <div onClick={onCloseMenu} style={{ position: 'fixed', inset: 0, background: 'rgba(20,26,34,0.4)', zIndex: 40 }} />
      )}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          zIndex: 41,
          transform: menuOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform .2s ease',
        }}
      >
        {panel}
      </div>
    </>
  )
}
