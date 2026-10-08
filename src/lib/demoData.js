import { uid, DAYS } from './utils.js'

function blankStudent(name, grade, parentName, parentPhone) {
  return {
    id: uid(),
    name,
    grade,
    parentName,
    parentPhone,
    subjects: [
      {
        id: uid(),
        name: 'Matematik',
        topics: [
          { id: uid(), name: 'Rasyonel Sayılar', done: true },
          { id: uid(), name: 'Basit Eşitsizlikler', done: true },
          { id: uid(), name: 'Üslü İfadeler', done: false },
          { id: uid(), name: 'Köklü İfadeler', done: false },
        ],
      },
      {
        id: uid(),
        name: 'Türkçe',
        topics: [
          { id: uid(), name: 'Sözcükte Anlam', done: true },
          { id: uid(), name: 'Cümlede Anlam', done: true },
          { id: uid(), name: 'Paragraf', done: true },
          { id: uid(), name: 'Ses Bilgisi', done: false },
        ],
      },
    ],
    exams: [],
    homeworks: [],
    weeklyPlan: [],
  }
}

export function buildDemoData() {
  const elif = blankStudent('Elif Demir', '8. Sınıf', 'Ayşe Demir', '905551112233')
  const kerem = blankStudent('Kerem Aydın', '7. Sınıf', 'Murat Aydın', '905554445566')

  elif.exams = [
    {
      id: uid(),
      date: '2026-08-05',
      type: 'deneme',
      results: [
        { subject: 'Matematik', dogru: 14, yanlis: 4 },
        { subject: 'Türkçe', dogru: 16, yanlis: 2 },
      ],
    },
    {
      id: uid(),
      date: '2026-08-19',
      type: 'deneme',
      results: [
        { subject: 'Matematik', dogru: 16, yanlis: 3 },
        { subject: 'Türkçe', dogru: 17, yanlis: 1 },
      ],
    },
    {
      id: uid(),
      date: '2026-08-30',
      type: 'test',
      results: [{ subject: 'Matematik', dogru: 9, yanlis: 1 }],
    },
  ]
  elif.homeworks = [
    {
      id: uid(),
      title: 'Üslü İfadeler Test Kitabı s.24-26',
      subject: 'Matematik',
      dueDate: '2026-09-01',
      status: 'bekliyor',
    },
    {
      id: uid(),
      title: 'Paragraf Soru Bankası 20 Soru',
      subject: 'Türkçe',
      dueDate: '2026-08-28',
      status: 'teslim',
    },
  ]
  elif.weeklyPlan = DAYS.map((day, i) => ({
    id: uid(),
    day,
    task: i % 2 === 0 ? 'Matematik: 20 soru' : 'Türkçe: 1 paragraf seti',
    done: i < 2,
  }))

  kerem.homeworks = [
    {
      id: uid(),
      title: 'Sözcükte Anlam Tekrar Föyü',
      subject: 'Türkçe',
      dueDate: '2026-08-20',
      status: 'gecikti',
    },
  ]
  kerem.weeklyPlan = DAYS.map((day) => ({ id: uid(), day, task: '', done: false }))

  elif.parentCode = 'DEMO-2026'
  kerem.parentCode = 'DEMO-2027'

  return [elif, kerem]
}
