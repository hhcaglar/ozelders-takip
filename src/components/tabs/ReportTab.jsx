import { useEffect, useState } from 'react'
import { MessageCircle, Copy, KeyRound, Users, Printer } from 'lucide-react'
import { Card, Button, SectionHeader, Banner } from '../ui.jsx'
import { doneTopics, totalTopics, homeworkStats, lastNet, waNumber } from '../../lib/utils.js'
import { listStudentParents, isCloud } from '../../lib/dataService.js'

// Öğretmen: bu öğrenciye bağlanmış veli hesaplarını listeler
function LinkedParentsCard({ studentId }) {
  const [parents, setParents] = useState(null)

  useEffect(() => {
    let cancelled = false
    listStudentParents(studentId)
      .then((rows) => !cancelled && setParents(rows))
      .catch(() => !cancelled && setParents([]))
    return () => {
      cancelled = true
    }
  }, [studentId])

  if (!isCloud || parents === null) return null
  return (
    <Card style={{ maxWidth: 520, marginTop: 12, padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8, fontSize: 13, fontWeight: 700 }}>
        <Users size={15} color="var(--navy)" /> Bağlı veli hesapları
      </div>
      {parents.length === 0 ? (
        <div style={{ fontSize: 12.5, color: '#8A94A0' }}>
          Henüz veli hesabı bağlanmamış. Veli, erişim koduyla "Veli Kayıt" üzerinden hesap açtığında burada görünür.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {parents.map((p) => (
            <div key={p.user_id} style={{ fontSize: 12.5, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span>
                <b>{p.full_name || 'Veli'}</b> · {p.email}
              </span>
              <span style={{ color: '#8A94A0' }}>
                {new Date(p.linked_at).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

export function ReportTab({ student }) {
  const [copied, setCopied] = useState(false)

  const done = doneTopics(student)
  const total = totalTopics(student)
  const hw = homeworkStats(student)
  const net = lastNet(student)

  const reportText = [
    `📚 ${student.name} — Gelişim Raporu`,
    `Konu takibi: ${done}/${total} tamamlandı`,
    `Ödevler: ${hw.delivered}/${hw.total} teslim edildi`,
    net === null ? 'Henüz sınav sonucu girilmedi' : `Son sınav neti: ${net}`,
    ``,
    `— DersTakip`,
  ].join('\n')

  const waLink = `https://wa.me/${waNumber(student.parentPhone)}?text=${encodeURIComponent(reportText)}`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reportText)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* pano erişimi yok — kullanıcı metni kendisi seçebilir */
    }
  }

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(student.parentCode || '')
    } catch {
      /* yoksay */
    }
  }

  return (
    <div>
      <SectionHeader icon={MessageCircle}>Veli Raporu</SectionHeader>
      <div className="dt-print-area">
      <Card style={{ maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <pre
          style={{
            margin: 0,
            whiteSpace: 'pre-wrap',
            fontFamily: 'Inter, sans-serif',
            fontSize: 13.5,
            lineHeight: 1.6,
            background: 'var(--paper)',
            border: '1px solid var(--line)',
            borderRadius: 10,
            padding: 14,
          }}
        >
          {reportText}
        </pre>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button icon={MessageCircle} onClick={() => window.open(waLink, '_blank', 'noopener')}>
            WhatsApp'ta Gönder
          </Button>
          <Button variant="ghost" icon={Copy} onClick={copy}>
            {copied ? 'Kopyalandı ✓' : 'Metni Kopyala'}
          </Button>
          <Button variant="ghost" icon={Printer} onClick={() => window.print()}>
            Yazdır / PDF
          </Button>
        </div>

        {!student.parentPhone && (
          <Banner tone="warn">
            Veli telefonu tanımlı değil — WhatsApp'ta alıcıyı manuel seçmen gerekecek.
          </Banner>
        )}

        {student.parentCode && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              flexWrap: 'wrap',
              background: 'var(--paper)',
              border: '1px solid var(--line)',
              borderRadius: 10,
              padding: '10px 14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <KeyRound size={15} color="var(--navy)" />
              <span>
                Veli erişim kodu: <b style={{ letterSpacing: 1 }}>{student.parentCode}</b>
              </span>
            </div>
            <Button size="sm" variant="ghost" icon={Copy} onClick={copyCode}>
              Kodu Kopyala
            </Button>
          </div>
        )}
      </Card>
      </div>

      <LinkedParentsCard studentId={student.id} />
    </div>
  )
}
