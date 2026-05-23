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

const steps = [
  { id: 'upload', label: 'העלאה' },
  { id: 'preview', label: 'עריכה' },
  { id: 'practice', label: 'תרגול' },
  { id: 'results', label: 'תוצאות' },
]

function shuffleArray(items) {
  const shuffled = [...items]

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }

  return shuffled
}

const hebrewDisplayLabels = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח']
const englishDisplayLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

function getAnswerLabelFamily(answers) {
  return answers.some((answer) => /^[A-Z]$/i.test(answer.label)) ? 'english' : 'hebrew'
}

function getDisplayLabel(labels, index) {
  return labels[index] ?? String(index + 1)
}

function createPracticeQuestions(sourceQuestions) {
  return sourceQuestions.map((question) => ({
    ...question,
    answers: (question.media?.some((media) => media.role === 'question-options-crop')
      ? question.answers
      : shuffleArray(question.answers)
    ).map((answer, index) => {
      const labels =
        getAnswerLabelFamily(question.answers) === 'english'
          ? englishDisplayLabels
          : hebrewDisplayLabels

      return {
        ...answer,
        originalLabel: answer.originalLabel ?? answer.label,
        displayLabel: getDisplayLabel(labels, index),
      }
    }),
  }))
}

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
    Array.isArray(storedExam?.questions) && storedExam.fileId ? storedExam.questions : [],
  )
  const [rawExamText, setRawExamText] = useState(() =>
    typeof storedExam?.rawText === 'string' && storedExam.fileId ? storedExam.rawText : '',
  )
  const [examAnswers, setExamAnswers] = useState({})
  const [practiceQuestions, setPracticeQuestions] = useState([])

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
    })
  }, [currentFileId, currentFileName, questions, rawExamText])

  const results = useMemo(
    () =>
      practiceQuestions.map((question) => {
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
    [examAnswers, practiceQuestions],
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


  const clearCurrentExam = ({ fileId = '', fileName = '', rawText = '' } = {}) => {
    setCurrentFileId(fileId)
    setCurrentFileName(fileName)
    setQuestions([])
    setRawExamText(rawText)
    setExamAnswers({})
    setPracticeQuestions([])
    clearStoredExam()
    setScreen('upload')
  }

  const openParsedExam = ({ fileId, fileName, questions: parsedQuestions, rawText }) => {
    if (fileId !== currentFileId) {
      return
    }

    setQuestions(parsedQuestions)
    setRawExamText(rawText)
    setCurrentFileName(fileName)
    setExamAnswers({})
    setPracticeQuestions([])
    setScreen('preview')
  }

  const startPractice = () => {
    setExamAnswers({})
    setPracticeQuestions(createPracticeQuestions(questions))
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
        />
      )}

      {screen === 'preview' && (
        <ParsePreview
          questions={questions}
          onBack={() => setScreen('upload')}
          onStartPractice={startPractice}
        >
          <QuestionEditor questions={questions} onChange={setQuestions} />
        </ParsePreview>
      )}

      {screen === 'practice' && (
        <ExamRunner
          questions={practiceQuestions}
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
