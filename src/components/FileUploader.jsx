import { useState } from 'react'
import { attachVisualAnswerMedia } from '../parser/attachVisualAnswerMedia'
import { extractDocxText } from '../parser/extractDocxText'
import { extractPdfText } from '../parser/extractPdfText'
import { normalizeText } from '../parser/normalizeText'
import { parseExamText } from '../parser/parseQuestions'
import { createFileId } from '../utils/storage'

const supportedTypes = {
  pdf: ['application/pdf'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
}

function getFileKind(file) {
  const extension = file.name.split('.').pop()?.toLowerCase()

  if (extension === 'pdf' || supportedTypes.pdf.includes(file.type)) {
    return 'pdf'
  }

  if (extension === 'docx' || supportedTypes.docx.includes(file.type)) {
    return 'docx'
  }

  return null
}

function getQuestionShapeSnapshot(questions) {
  return {
    questionCount: questions.length,
    questionsWithZeroAnswers: questions.filter((question) => question.answers.length === 0).length,
    questionsWithOneAnswer: questions.filter((question) => question.answers.length === 1).length,
    questionsWithTwoOrMoreAnswers: questions.filter((question) => question.answers.length >= 2).length,
    answersWithEmptyText: questions.reduce(
      (total, question) => total + question.answers.filter((answer) => answer.text.trim().length === 0).length,
      0,
    ),
    answersWithMedia: questions.reduce(
      (total, question) => total + question.answers.filter((answer) => answer.media).length,
      0,
    ),
  }
}

function validateVisualMediaInvariant(beforeQuestions, afterQuestions) {
  const errors = []

  if (beforeQuestions.length !== afterQuestions.length) {
    errors.push(`question-count ${beforeQuestions.length} -> ${afterQuestions.length}`)
  }

  beforeQuestions.forEach((beforeQuestion, questionIndex) => {
    const afterQuestion = afterQuestions[questionIndex]

    if (!afterQuestion) {
      errors.push(`missing question at index ${questionIndex}`)
      return
    }

    if (beforeQuestion.id !== afterQuestion.id) {
      errors.push(`question id changed at index ${questionIndex}`)
    }

    if (beforeQuestion.answers.length !== afterQuestion.answers.length) {
      errors.push(
        `answer-count q${beforeQuestion.number} ${beforeQuestion.answers.length} -> ${afterQuestion.answers.length}`,
      )
    }

    beforeQuestion.answers.forEach((beforeAnswer, answerIndex) => {
      const afterAnswer = afterQuestion.answers[answerIndex]

      if (!afterAnswer) {
        errors.push(`missing answer q${beforeQuestion.number} index ${answerIndex}`)
        return
      }

      if (beforeAnswer.id !== afterAnswer.id) errors.push(`answer id changed q${beforeQuestion.number}`)
      if (beforeAnswer.label !== afterAnswer.label) errors.push(`answer label changed q${beforeQuestion.number}`)
      if (beforeAnswer.text !== afterAnswer.text) errors.push(`answer text changed q${beforeQuestion.number}`)
      if (beforeAnswer.isCorrect !== afterAnswer.isCorrect) {
        errors.push(`answer correctness changed q${beforeQuestion.number}`)
      }
    })
  })

  return {
    ok: errors.length === 0,
    errors,
    before: getQuestionShapeSnapshot(beforeQuestions),
    after: getQuestionShapeSnapshot(afterQuestions),
    answerTextRemovedAfterVisualProcessing:
      getQuestionShapeSnapshot(afterQuestions).answersWithEmptyText -
      getQuestionShapeSnapshot(beforeQuestions).answersWithEmptyText,
  }
}

function FileUploader({
  currentFileId,
  onNewFileSelected,
  onUseMockData,
  onParsedQuestions,
  initialRawText = '',
}) {
  const [selectedFileId, setSelectedFileId] = useState(currentFileId)
  const [fileName, setFileName] = useState('')
  const [rawText, setRawText] = useState(initialRawText)
  const [error, setError] = useState('')
  const [isExtracting, setIsExtracting] = useState(false)
  const [pdfPages, setPdfPages] = useState([])

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0]
    const nextFileId = createFileId(file)

    setSelectedFileId(nextFileId)
    setRawText('')
    setError('')
    setPdfPages([])
    setFileName(file?.name ?? '')
    onNewFileSelected({ fileId: nextFileId, fileName: file?.name ?? '', rawText: '' })

    if (!file) {
      return
    }

    const fileKind = getFileKind(file)

    if (!fileKind) {
      setError('סוג הקובץ אינו נתמך. ניתן להעלות קובץ PDF או DOCX בלבד.')
      return
    }

    setIsExtracting(true)

    try {
      const extractedResult =
        fileKind === 'pdf' ? await extractPdfText(file) : await extractDocxText(file)
      const extractedText =
        typeof extractedResult === 'string' ? extractedResult : extractedResult.rawText
      const normalizedText = normalizeText(extractedText)
      setPdfPages(typeof extractedResult === 'string' ? [] : extractedResult.pages)
      setRawText(normalizedText)
      onNewFileSelected({
        fileId: nextFileId,
        fileName: file.name,
        rawText: normalizedText,
      })
    } catch (extractError) {
      console.error(extractError)
      setError('לא ניתן היה לחלץ טקסט מהקובץ. נסו קובץ PDF או DOCX אחר.')
    } finally {
      setIsExtracting(false)
    }
  }

  const handleParseText = async () => {
    const textForCurrentFile = rawText
    const { questions: parsedQuestions } = parseExamText(textForCurrentFile, { debug: true })
    const {
      questions: questionsWithMedia,
      diagnostics: visualDiagnostics,
    } = await attachVisualAnswerMedia(parsedQuestions, pdfPages)
    const visualInvariant = validateVisualMediaInvariant(parsedQuestions, questionsWithMedia)
    const safeQuestions = visualInvariant.ok ? questionsWithMedia : parsedQuestions
    if (!visualInvariant.ok) {
      console.error('Visual media changed parser output. Reverting to parsed questions.', visualInvariant)
    } else {
      console.log('Parser counts before/after visual media', visualInvariant)
      console.log('Visual media diagnostics', visualDiagnostics)
    }

    if (safeQuestions.length === 0) {
      setError('לא זוהו שאלות מהמבחן. אפשר לבדוק את הטקסט הגולמי או להשתמש בעריכה ידנית.')
      return
    }

    setError('')
    onParsedQuestions({
      fileId: selectedFileId,
      fileName,
      questions: safeQuestions,
      rawText: textForCurrentFile,
    })
  }

  return (
    <section className="screen-panel" aria-labelledby="upload-title">
      <div className="panel-header">
        <div>
          <h2 id="upload-title">העלאת קובץ מבחן</h2>
          <p className="muted">
            ניתן להעלות קובץ PDF או DOCX ולראות את הטקסט הגולמי שחולץ ממנו.
          </p>
        </div>
        <button type="button" className="secondary-button" onClick={onUseMockData}>
          המשך עם שאלות לדוגמה
        </button>
      </div>

      <div className="upload-box">
        <div>
          <h3>בחירת קובץ</h3>
          <p className="muted">החילוץ מתבצע בדפדפן בלבד. אין עדיין פענוח שאלות מלא.</p>
          <input
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            aria-label="בחירת קובץ מבחן"
            onChange={handleFileChange}
          />
        </div>
      </div>

      {fileName && (
        <p className="file-status">
          קובץ נבחר: <strong>{fileName}</strong>
        </p>
      )}

      {isExtracting && <p className="file-status">מחלץ טקסט מהקובץ...</p>}

      {rawText && !isExtracting && (
        <div className="parse-actions">
          <button type="button" className="primary-button" onClick={handleParseText}>
            פענח שאלות מהמבחן
          </button>
          <p className="muted">
            הפענוח ייצור שאלות לעריכה מהטקסט הגולמי וישמור אותן בדפדפן.
          </p>
        </div>
      )}

      {error && (
        <div className="error-box" role="alert">
          {error}
        </div>
      )}

      <section className="debug-panel" aria-labelledby="debug-title">
        <div className="debug-header">
          <h3 id="debug-title">טקסט גולמי שחולץ</h3>
          <span>{rawText ? `${rawText.length} תווים` : 'אין טקסט להצגה'}</span>
        </div>
        <pre>{rawText || 'לא נבחר קובץ נתמך עדיין.'}</pre>
      </section>
    </section>
  )
}

export default FileUploader
