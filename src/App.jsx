import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  LayoutDashboard,
  BookOpen,
  TrendingUp,
  ClipboardList,
  CalendarDays,
  Lightbulb,
  MessageCircle,
  GraduationCap,
  Menu,
  LogOut,
} from 'lucide-react'
import { useAuth } from './lib/auth.jsx'
import { localBackend, loadUiPrefs, saveUiPrefs } from './lib/localBackend.js'
import { backend, isCloud, parentFetchStudent, newStudentDoc } from './lib/dataService.js'
import { buildDemoData } from './lib/demoData.js'
import { fontSans } from './lib/theme.js'
import { Sidebar } from './components/Sidebar.jsx'
import { StudentHeader } from './components/StudentHeader.jsx'
import { AddStudentModal } from './components/AddStudentModal.jsx'
import { EditStudentModal } from './components/EditStudentModal.jsx'
import { SettingsModal } from './components/SettingsModal.jsx'
import { LoginScreen } from './components/LoginScreen.jsx'
import { LinkCodeScreen } from './components/LinkCodeScreen.jsx'
import { Button, EmptyState, Banner, ConfirmDialog } from './components/ui.jsx'
import { TopicsTab } from './components/tabs/TopicsTab.jsx'
import { ExamsTab } from './components/tabs/ExamsTab.jsx'
import { HomeworksTab } from './components/tabs/HomeworksTab.jsx'
import { PlanTab } from './components/tabs/PlanTab.jsx'
import { TipsTab } from './components/tabs/TipsTab.jsx'
import { ReportTab } from './components/tabs/ReportTab.jsx'
import { OverviewTab } from './components/tabs/OverviewTab.jsx'

const SAVE_ERROR_LOCAL = 'Yerel depolamaya kaydedilemedi (gizli pencere veya dolu depolama olabilir).'
const SAVE_ERROR_CLOUD = 'Sunucuya kaydedilemedi — bağlantını kontrol et.'

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => globalThis.matchMedia?.('(max-width: 760px)').matches ?? false
  )
  useEffect(() => {
    const mq = globalThis.matchMedia?.('(max-width: 760px)')
    if (!mq) return
    const onChange = (e) => setIsMobile(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return isMobile
}

export default function App() {
  const {
    supabaseConfigured,
    authReady,
    isAuthed,
    isLocalMode,
    isParentAccount,
    linkedStudent,
    isParent,
    parentCode,
    parentLogout,
    signOut,
  } = useAuth()

  const isMobile = useIsMobile()

  const [students, setStudents] = useState([])
  const [activeStudentId, setActiveStudentId] = useState(null)
  const [role, setRole] = useState('ogretmen') // yalnızca yerel modda anlam taşır
  const [tab, setTab] = useState('genel')
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [codeParentDoc, setCodeParentDoc] = useState(null) // hesapsız hızlı veli girişi
  const [saveError, setSaveError] = useState('')
  const [cloudEmpty, setCloudEmpty] = useState(false)
  const [showAddStudent, setShowAddStudent] = useState(false)
  const [editStudentOpen, setEditStudentOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [confirmState, setConfirmState] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)

  const savedDocsRef = useRef(new Map())

  // ------------------------------------------------------------
  // Bağlam: hangi ekrandayız?
  // local        : Supabase yok → tarayıcı verisi, rol düğmesi
  // login        : bulut, girişsiz
  // loading      : bulut, veli hesabı bağlantısı kontrol ediliyor
  // link         : veli hesabı açık ama erişim kodu bağlı değil
  // teacher      : öğretmen oturumu (tam yetki)
  // parent       : veli hesabı (RLS ile kendi çocuğu, salt-okunur)
  // parent-code  : hesapsız hızlı kod girişi (salt-okunur RPC)
  // ------------------------------------------------------------
  const contextKey = !isCloud
    ? 'local'
    : !isAuthed
      ? 'login'
      : isParentAccount
        ? linkedStudent === undefined
          ? 'loading'
          : linkedStudent
            ? 'parent'
            : 'link'
        : 'teacher'

  // ---------------- Veri yükleme ----------------
  useEffect(() => {
    let cancelled = false
    setLoaded(false)
    setLoadError('')
    setSaveError('')
    setCloudEmpty(false)
    setCodeParentDoc(null)
    savedDocsRef.current = new Map()

    ;(async () => {
      try {
        if (contextKey === 'login' || contextKey === 'loading' || contextKey === 'link') {
          if (!cancelled) setLoaded(true)
          return
        }

        if (contextKey === 'parent-code') {
          const doc = await parentFetchStudent(parentCode)
          if (cancelled) return
          setCodeParentDoc(doc)
          setLoaded(true)
          return
        }

        // teacher ve parent aynı yolu kullanır: RLS ne görünmesine izin veriyorsa o gelir
        let list = await backend.loadAll()
        // Yerel modda ilk çalıştırma: henüz veri yoksa demo tohumla
        if (contextKey === 'local' && !list) {
          list = buildDemoData()
          await localBackend.replaceAll(list)
        }
        if (cancelled) return
        const safeList = Array.isArray(list) ? list : []
        safeList.forEach((doc) => savedDocsRef.current.set(doc.id, JSON.stringify(doc)))
        setStudents(safeList)
        const prefs = loadUiPrefs()
        if (contextKey === 'local') {
          setRole(prefs.role === 'veli' ? 'veli' : 'ogretmen')
          const savedActive = safeList.some((s) => s.id === prefs.activeStudentId)
          setActiveStudentId(savedActive ? prefs.activeStudentId : safeList[0]?.id ?? null)
        } else {
          setActiveStudentId(safeList[0]?.id ?? null)
        }
        setCloudEmpty(safeList.length === 0)
        setLoaded(true)
      } catch (e) {
        if (!cancelled) {
          setLoadError(`Veriler yüklenemedi: ${e?.message ?? e}`)
          setLoaded(true)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [contextKey, parentCode])

  // ---------------- Otomatik kaydetme (yalnızca öğretmen/yerel-öğretmen) ----------------
  const canEdit = isLocalMode ? role === 'ogretmen' : contextKey === 'teacher'
  const isTeacher = canEdit

  const persist = useCallback(async () => {
    if (!isLocalMode && contextKey !== 'teacher') return
    const dirty = students.filter((s) => savedDocsRef.current.get(s.id) !== JSON.stringify(s))
    const deleted = [...savedDocsRef.current.keys()].filter((id) => !students.some((s) => s.id === id))
    if (!dirty.length && !deleted.length) return
    try {
      for (const doc of dirty) {
        await backend.upsertStudent(doc)
        savedDocsRef.current.set(doc.id, JSON.stringify(doc))
      }
      for (const id of deleted) {
        await backend.deleteStudent(id)
        savedDocsRef.current.delete(id)
      }
      setSaveError('')
    } catch (e) {
      const detail = e?.message ?? e?.error_description ?? ''
      setSaveError((isCloud ? SAVE_ERROR_CLOUD : SAVE_ERROR_LOCAL) + (detail ? ` (${detail})` : ''))
    }
  }, [students, isLocalMode, contextKey, isCloud])

  useEffect(() => {
    if (!loaded || !canEdit) return
    const t = setTimeout(persist, 800)
    return () => clearTimeout(t)
  }, [students, loaded, canEdit, persist])

  useEffect(() => {
    if (loaded && isLocalMode) saveUiPrefs({ role, activeStudentId })
  }, [role, activeStudentId, loaded, isLocalMode])

  // ---------------- Eylemler ----------------
  const updateStudent = useCallback((id, updater) => {
    setStudents((prev) => prev.map((s) => (s.id === id ? updater(s) : s)))
  }, [])

  const activeStudent = useMemo(
    () => students.find((s) => s.id === activeStudentId) || null,
    [students, activeStudentId]
  )

  const requestRemoveStudent = (id) => {
    const student = students.find((s) => s.id === id)
    if (!student) return
    setConfirmState({
      title: 'Öğrenciyi sil',
      message: `"${student.name}" ve tüm kayıtları (konular, sınavlar, ödevler, plan)${
        isCloud ? ' sunucudan da' : ''
      } kalıcı olarak silinecek. Emin misin?`,
      confirmLabel: 'Evet, sil',
      danger: true,
      action: () => {
        setStudents((prev) => {
          const next = prev.filter((s) => s.id !== id)
          setActiveStudentId((cur) => (cur === id ? next[0]?.id ?? null : cur))
          return next
        })
        setConfirmState(null)
      },
    })
  }

  const requestResetDemo = () => {
    setConfirmState({
      title: 'Örnek verilere sıfırla',
      message: isCloud
        ? 'Sunucudaki TÜM öğrenci kayıtları silinip örnek verilerle değiştirilecek. Emin misin?'
        : 'Tüm veriler örnek verilerle değiştirilecek. Emin misin?',
      confirmLabel: 'Evet, sıfırla',
      danger: true,
      action: async () => {
        setConfirmState(null)
        const demo = buildDemoData()
        try {
          await backend.replaceAll(demo)
          savedDocsRef.current = new Map(demo.map((d) => [d.id, JSON.stringify(d)]))
          setStudents(demo)
          setActiveStudentId(demo[0]?.id ?? null)
          setCloudEmpty(false)
          setSaveError('')
        } catch (e) {
          const detail = e?.message ?? ''
          setSaveError((isCloud ? SAVE_ERROR_CLOUD : SAVE_ERROR_LOCAL) + (detail ? ` (${detail})` : ''))
        }
      },
    })
  }

  const addStudent = ({ name, grade, parentName, parentPhone }) => {
    const doc = newStudentDoc({ name, grade, parentName, parentPhone })
    setStudents((prev) => [...prev, doc])
    setActiveStudentId(doc.id)
    setShowAddStudent(false)
  }

  const saveEditedStudent = (fields) => {
    updateStudent(activeStudentId, (s) => ({ ...s, ...fields }))
    setEditStudentOpen(false)
  }

  // ---------------- Ekran durumları ----------------
  if (!authReady || contextKey === 'loading') return <LoadingScreen />
  if (contextKey === 'login') return <LoginScreen />
  if (contextKey === 'link') return <LinkCodeScreen />

  // Hesapsız hızlı veli girişi
  if (contextKey === 'parent-code') {
    if (loaded && !codeParentDoc) {
      return (
        <CenteredScreen>
          <GraduationCap size={30} color="var(--amber)" />
          <h2 style={{ fontFamily: 'Newsreader, serif', margin: '10px 0 6px' }}>Kod geçersiz</h2>
          <p style={{ fontSize: 13.5, color: '#6B7684', margin: '0 0 16px' }}>
            Bu erişim koduyla bir öğrenci bulunamadı. Kodu öğretmeninden tekrar kontrol et.
          </p>
          <Button variant="ghost" icon={LogOut} onClick={parentLogout}>
            Kod girişine dön
          </Button>
        </CenteredScreen>
      )
    }
    if (!loaded || !codeParentDoc) return <LoadingScreen />
    return (
      <Shell>
        <TopBar
          subtitle="Veli Görünümü (kod ile)"
          onExit={parentLogout}
          exitLabel="Çıkış yap"
        />
        <ReadOnlyBody student={codeParentDoc} />
      </Shell>
    )
  }

  if (!loaded) return <LoadingScreen />

  // ---------------- Veli hesabı görünümü (RLS korumalı) ----------------
  if (contextKey === 'parent') {
    return (
      <Shell>
        <TopBar subtitle="Veli Görünümü" onExit={signOut} exitLabel="Çıkış yap" />
        {activeStudent ? (
          <ReadOnlyBody student={activeStudent} />
        ) : (
          <div style={{ padding: 24 }}>
            <EmptyState text="Öğrenci verisi bulunamadı." />
          </div>
        )}
      </Shell>
    )
  }

  // ---------------- Öğretmen / yerel ana ekran ----------------
  const tabs = [
    { id: 'genel', label: 'Genel Bakış', icon: LayoutDashboard },
    { id: 'konular', label: 'Konular', icon: BookOpen },
    { id: 'sinavlar', label: 'Sınavlar', icon: TrendingUp },
    { id: 'odevler', label: 'Ödevler', icon: ClipboardList },
    { id: 'plan', label: 'Haftalık Plan', icon: CalendarDays },
    { id: 'oneriler', label: 'Öneriler', icon: Lightbulb },
    ...(isTeacher ? [{ id: 'rapor', label: 'Rapor', icon: MessageCircle }] : []),
  ]

  return (
    <Shell>
      {isMobile && (
        <div
          style={{
            background: 'var(--navy)',
            color: '#EAF0F7',
            padding: '11px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <button
            onClick={() => setMenuOpen(true)}
            aria-label="Menüyü aç"
            className="dt-side-btn"
            style={{
              background: 'none',
              border: '1px solid rgba(255,255,255,0.25)',
              borderRadius: 6,
              color: '#EAF0F7',
              cursor: 'pointer',
              padding: '5px 8px',
              display: 'flex',
            }}
          >
            <Menu size={17} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg, #F0B429, #DD9A06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <GraduationCap size={17} color="#1E3A5F" />
            </div>
            <span style={{ fontFamily: 'Newsreader, serif', fontSize: 16, fontWeight: 700 }}>DersTakip</span>
          </div>
          {activeStudent && (
            <span
              style={{
                fontSize: 13,
                color: '#C9D6E4',
                marginLeft: 'auto',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {activeStudent.name}
            </span>
          )}
        </div>
      )}

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <Sidebar
          students={students}
          activeStudentId={activeStudentId}
          role={role}
          isTeacher={isTeacher}
          canEdit={canEdit}
          saveError={saveError}
          isMobile={isMobile}
          menuOpen={menuOpen}
          onCloseMenu={() => setMenuOpen(false)}
          onSelectStudent={setActiveStudentId}
          onAddStudent={() => setShowAddStudent(true)}
          onRemoveStudent={requestRemoveStudent}
          onResetDemo={requestResetDemo}
          onRoleChange={setRole}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        <main
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--paper-card)',
          }}
        >
          {activeStudent ? (
            <>
              <StudentHeader
                student={activeStudent}
                isTeacher={isTeacher}
                onRemove={requestRemoveStudent}
                onEdit={() => setEditStudentOpen(true)}
              />

              <nav
                style={{
                  display: 'flex',
                  gap: 6,
                  padding: '10px 20px 4px',
                  borderBottom: '1px solid var(--line)',
                  overflowX: 'auto',
                }}
              >
                {tabs.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setTab(id)}
                    className="dt-tabbtn"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 7,
                      padding: '10px 16px',
                      border: 'none',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      background: tab === id ? 'var(--navy)' : undefined,
                      color: tab === id ? '#fff' : '#6B7684',
                      fontWeight: tab === id ? 700 : 600,
                      fontSize: 13.5,
                      fontFamily: fontSans,
                      borderRadius: 9,
                      boxShadow: tab === id ? '0 3px 10px rgba(30, 58, 95, 0.22)' : 'none',
                    }}
                  >
                    <Icon size={15} /> {label}
                  </button>
                ))}
              </nav>

              <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
                {cloudEmpty && isTeacher && (
                  <Banner tone="info" style={{ marginBottom: 16 }}>
                    Sunucuda henüz öğrenci yok. Yeni öğrenci ekleyebilir ya da{' '}
                    <button
                      onClick={requestResetDemo}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--navy)',
                        fontWeight: 700,
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        padding: 0,
                        font: 'inherit',
                      }}
                    >
                      örnek verilerle başlayabilirsin
                    </button>
                    .
                  </Banner>
                )}
                {loadError && (
                  <Banner tone="danger" style={{ marginBottom: 16 }}>
                    {loadError}
                  </Banner>
                )}
                {saveError && (
                  <Banner tone="danger" style={{ marginBottom: 16 }}>
                    {saveError}{' '}
                    <button
                      onClick={() => persist()}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'inherit',
                        fontWeight: 700,
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        padding: 0,
                        font: 'inherit',
                      }}
                    >
                      Tekrar dene
                    </button>
                  </Banner>
                )}

                {tab === 'genel' && (
                  <OverviewTab
                    students={students}
                    onOpenStudent={(id) => {
                      setActiveStudentId(id)
                      setTab('konular')
                    }}
                  />
                )}
                {tab === 'konular' && (
                  <TopicsTab
                    student={activeStudent}
                    isTeacher={isTeacher}
                    update={(u) => updateStudent(activeStudent.id, u)}
                  />
                )}
                {tab === 'sinavlar' && (
                  <ExamsTab
                    student={activeStudent}
                    isTeacher={isTeacher}
                    update={(u) => updateStudent(activeStudent.id, u)}
                  />
                )}
                {tab === 'odevler' && (
                  <HomeworksTab
                    student={activeStudent}
                    isTeacher={isTeacher}
                    update={(u) => updateStudent(activeStudent.id, u)}
                  />
                )}
                {tab === 'plan' && (
                  <PlanTab
                    student={activeStudent}
                    isTeacher={isTeacher}
                    update={(u) => updateStudent(activeStudent.id, u)}
                  />
                )}
                {tab === 'oneriler' && <TipsTab student={activeStudent} />}
                {tab === 'rapor' && isTeacher && <ReportTab student={activeStudent} />}
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <EmptyState text="Görüntülemek için soldan bir öğrenci seç ya da yeni öğrenci ekle." />
            </div>
          )}
        </main>
      </div>

      {showAddStudent && (
        <AddStudentModal onClose={() => setShowAddStudent(false)} onAdd={addStudent} />
      )}
      {editStudentOpen && activeStudent && (
        <EditStudentModal
          student={activeStudent}
          onClose={() => setEditStudentOpen(false)}
          onSave={saveEditedStudent}
        />
      )}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      {confirmState && (
        <ConfirmDialog
          title={confirmState.title}
          message={confirmState.message}
          confirmLabel={confirmState.confirmLabel}
          danger={confirmState.danger}
          onConfirm={confirmState.action}
          onCancel={() => setConfirmState(null)}
        />
      )}
    </Shell>
  )
}

// ---------------- Yardımcı ekranlar ----------------

function Shell({ children }) {
  return (
    <div
      style={{
        width: '100%',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--paper)',
      }}
    >
      {children}
    </div>
  )
}

function TopBar({ subtitle, onExit, exitLabel }) {
  return (
    <div
      style={{
        background: 'var(--navy)',
        color: '#EAF0F7',
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg, #F0B429, #DD9A06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <GraduationCap size={18} color="#1E3A5F" />
        </div>
        <span style={{ fontFamily: 'Newsreader, serif', fontSize: 17, fontWeight: 700 }}>DersTakip</span>
        <span
          style={{
            background: 'rgba(227,160,8,0.2)',
            color: '#FFE9B8',
            fontSize: 11,
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: 999,
            whiteSpace: 'nowrap',
          }}
        >
          {subtitle}
        </span>
      </div>
      <button
        onClick={onExit}
        className="dt-side-btn"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'none',
          border: '1px solid rgba(255,255,255,0.25)',
          borderRadius: 6,
          color: '#C9D6E4',
          cursor: 'pointer',
          padding: '5px 10px',
          fontSize: 12.5,
          fontFamily: fontSans,
          flexShrink: 0,
        }}
      >
        <LogOut size={13} /> {exitLabel}
      </button>
    </div>
  )
}

function LoadingScreen() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#8A94A0',
        fontFamily: fontSans,
      }}
    >
      Yükleniyor…
    </div>
  )
}

function CenteredScreen({ children }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: 24,
        fontFamily: fontSans,
      }}
    >
      {children}
    </div>
  )
}

// Veli (hesaplı veya kodlu) salt-okunur içerik gövdesi
function ReadOnlyBody({ student }) {
  const tabs = [
    { id: 'genel', label: 'Genel Bakış', icon: LayoutDashboard },
    { id: 'konular', label: 'Konular', icon: BookOpen },
    { id: 'sinavlar', label: 'Sınavlar', icon: TrendingUp },
    { id: 'odevler', label: 'Ödevler', icon: ClipboardList },
    { id: 'plan', label: 'Haftalık Plan', icon: CalendarDays },
    { id: 'oneriler', label: 'Öneriler', icon: Lightbulb },
  ]
  const [tab, setTab] = useState('genel')
  return (
    <>
      <StudentHeader student={student} isTeacher={false} onRemove={() => {}} />
      <nav
        style={{
          display: 'flex',
          gap: 6,
          padding: '10px 20px 4px',
          borderBottom: '1px solid var(--line)',
          overflowX: 'auto',
        }}
      >
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className="dt-tabbtn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '10px 16px',
              border: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              background: tab === id ? 'var(--navy)' : undefined,
              color: tab === id ? '#fff' : '#6B7684',
              fontWeight: tab === id ? 700 : 600,
              fontSize: 13.5,
              fontFamily: fontSans,
              borderRadius: 9,
              boxShadow: tab === id ? '0 3px 10px rgba(30, 58, 95, 0.22)' : 'none',
            }}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </nav>
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        {tab === 'konular' && <TopicsTab student={student} isTeacher={false} update={() => {}} />}
        {tab === 'sinavlar' && <ExamsTab student={student} isTeacher={false} update={() => {}} />}
        {tab === 'odevler' && <HomeworksTab student={student} isTeacher={false} update={() => {}} />}
        {tab === 'plan' && <PlanTab student={student} isTeacher={false} update={() => {}} />}
        {tab === 'oneriler' && <TipsTab student={student} />}
      </div>
    </>
  )
}
