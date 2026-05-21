import { useEffect, useMemo, useState } from 'react'
import ExamRunner from './components/ExamRunner'
import FileUploader from './components/FileUploader'
import ParsePreview from './components/ParsePreview'
import QuestionEditor from './components/QuestionEditor'
import ResultsView from './components/ResultsView'
import {
  CURRENT_EXAM_STORAGE_VERSION,
  clearStoredExam,
  loadStoredExam,
  saveStoredExam,
} from './utils/storage'

const mockQuestions = [
  {
    id: 'q-1',
    number: 1,
    text: 'מהו תפקידו המרכזי של React באפליקציית ווב?',
    answers: [
      {
        id: 'q-1-a',
        label: 'א',
        text: 'בניית ממשק משתמש מרכיבים קטנים וניתנים לשימוש חוזר',
        isCorrect: true,
      },
      {
        id: 'q-1-b',
        label: 'ב',
        text: 'ניהול מסד נתונים בצד השרת',
        isCorrect: false,
      },
      {
        id: 'q-1-c',
        label: 'ג',
        text: 'המרת קבצי PDF לטקסט',
        isCorrect: false,
      },
      {
        id: 'q-1-d',
        label: 'ד',
        text: 'שליחת מיילים אוטומטית',
        isCorrect: false,
      },
    ],
  },
  {
    id: 'q-2',
    number: 2,
    text: 'איזו תשובה תסומן כברירת מחדל לאחר פענוח עתידי של מבחן?',
    answers: [
      {
        id: 'q-2-a',
        label: 'א',
        text: 'התשובה הראשונה',
        isCorrect: true,
      },
      {
        id: 'q-2-b',
        label: 'ב',
        text: 'התשובה האחרונה',
        isCorrect: false,
      },
      {
        id: 'q-2-c',
        label: 'ג',
        text: 'תשובה אקראית',
        isCorrect: false,
      },
      {
        id: 'q-2-d',
        label: 'ד',
        text: 'אף תשובה עד שהמשתמש יבחר',
        isCorrect: false,
      },
    ],
  },
  {
    id: 'q-3',
    number: 3,
    text: 'מהו השלב שבו המשתמש יוכל לתקן ניסוח שאלות ותשובות?',
    answers: [
      {
        id: 'q-3-a',
        label: 'א',
        text: 'מסך תצוגה מקדימה ועריכה',
        isCorrect: true,
      },
      {
        id: 'q-3-b',
        label: 'ב',
        text: 'מסך התוצאות בלבד',
        isCorrect: false,
      },
      {
        id: 'q-3-c',
        label: 'ג',
        text: 'לפני העלאת הקובץ',
        isCorrect: false,
      },
      {
        id: 'q-3-d',
        label: 'ד',
        text: 'רק אחרי ייצוא לקובץ חדש',
        isCorrect: false,
      },
    ],
  },
]

const steps = [
  { id: 'upload', label: 'העלאה' },
  { id: 'preview', label: 'עריכה' },
  { id: 'practice', label: 'תרגול' },
  { id: 'results', label: 'תוצאות' },
]

function App() {
  const loadedStoredExam = loadStoredExam()
  const storedExam =
    loadedStoredExam?.parserVersion === CURRENT_EXAM_STORAGE_VERSION
      ? loadedStoredExam
      : null
  const [screen, setScreen] = useState('upload')
  const [currentFileId, setCurrentFileId] = useState(storedExam?.fileId ?? '')
  const [currentFileName, setCurrentFileName] = useState(storedExam?.fileName ?? '')
  const [questions, setQuestions] = useState(() =>
    Array.isArray(storedExam?.questions) && storedExam.fileId ? storedExam.questions : mockQuestions,
  )
  const [rawExamText, setRawExamText] = useState(() =>
    typeof storedExam?.rawText === 'string' && storedExam.fileId ? storedExam.rawText : '',
  )
  const [parseDiagnostics, setParseDiagnostics] = useState(storedExam?.diagnostics ?? null)
  const [examAnswers, setExamAnswers] = useState({})

  useEffect(() => {
    if (!currentFileId || questions.length === 0) {
      return
    }

    saveStoredExam({
      fileId: currentFileId,
      fileName: currentFileName,
      parserVersion: CURRENT_EXAM_STORAGE_VERSION,
      questions,
      rawText: rawExamText,
      diagnostics: parseDiagnostics,
    })
  }, [currentFileId, currentFileName, parseDiagnostics, questions, rawExamText])

  const results = useMemo(
    () =>
      questions.map((question) => {
        const selectedAnswerId = examAnswers[question.id]
        const selectedAnswer = question.answers.find((answer) => answer.id === selectedAnswerId) ?? null
        const correctAnswer = question.answers.find((answer) => answer.isCorrect) ?? null
        const status = !correctAnswer
          ? 'invalid'
          : !selectedAnswer
            ? 'unanswered'
            : selectedAnswer.id === correctAnswer.id
              ? 'correct'
              : 'wrong'

        return {
          question,
          selectedAnswer,
          correctAnswer,
          status,
        }
      }),
    [examAnswers, questions],
  )

  const resultSummary = useMemo(() => {
    const correctCount = results.filter((result) => result.status === 'correct').length
    const wrongCount = results.filter((result) => result.status === 'wrong').length
    const unansweredCount = results.filter(
      (result) => result.status === 'unanswered' || result.status === 'invalid',
    ).length
    const score = results.length > 0 ? Math.round((correctCount / results.length) * 100) : 0

    return {
      score,
      correctCount,
      wrongCount,
      unansweredCount,
    }
  }, [results])

  const startMockFlow = () => {
    setCurrentFileId('')
    setCurrentFileName('')
    setQuestions(mockQuestions)
    setRawExamText('')
    setParseDiagnostics(null)
    setExamAnswers({})
    setScreen('preview')
  }

  const clearCurrentExam = ({ fileId = '', fileName = '', rawText = '' } = {}) => {
    setCurrentFileId(fileId)
    setCurrentFileName(fileName)
    setQuestions([])
    setRawExamText(rawText)
    setParseDiagnostics(null)
    setExamAnswers({})
    clearStoredExam()
    setScreen('upload')
  }

  const openParsedExam = ({ fileId, fileName, questions: parsedQuestions, rawText, diagnostics }) => {
    if (fileId !== currentFileId) {
      return
    }

    setQuestions(parsedQuestions)
    setRawExamText(rawText)
    setCurrentFileName(fileName)
    setParseDiagnostics(diagnostics)
    setExamAnswers({})
    setScreen('preview')
  }

  const startPractice = () => {
    setExamAnswers({})
    setScreen('practice')
  }

  const updateExamAnswer = (questionId, answerId) => {
    setExamAnswers((currentAnswers) => ({
      ...currentAnswers,
      [questionId]: answerId,
    }))
  }

  const finishPractice = () => {
    setScreen('results')
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">מערכת תרגול מבחנים</p>
          <h1>תרגול מבחן אמריקאי</h1>
        </div>
        <nav className="step-tabs" aria-label="שלבי העבודה">
          {steps.map((step) => (
            <button
              type="button"
              key={step.id}
              className={screen === step.id ? 'active' : ''}
              onClick={() => setScreen(step.id)}
            >
              {step.label}
            </button>
          ))}
        </nav>
      </header>

      {screen === 'upload' && (
        <FileUploader
          currentFileId={currentFileId}
          initialRawText={rawExamText}
          onNewFileSelected={clearCurrentExam}
          onParsedQuestions={openParsedExam}
          onUseMockData={startMockFlow}
        />
      )}

      {screen === 'preview' && (
        <ParsePreview
          diagnostics={parseDiagnostics}
          questions={questions}
          onBack={() => setScreen('upload')}
          onStartPractice={startPractice}
        >
          <QuestionEditor questions={questions} onChange={setQuestions} />
        </ParsePreview>
      )}

      {screen === 'practice' && (
        <ExamRunner
          questions={questions}
          selectedAnswers={examAnswers}
          onAnswerChange={updateExamAnswer}
          onBack={() => setScreen('preview')}
          onFinish={finishPractice}
        />
      )}

      {screen === 'results' && (
        <ResultsView
          results={results}
          summary={resultSummary}
          onEdit={() => setScreen('preview')}
          onRestart={startPractice}
        />
      )}
    </main>
  )
}

export default App
