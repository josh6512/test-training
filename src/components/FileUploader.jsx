import { useState } from 'react'
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
  const [diagnostics, setDiagnostics] = useState(null)
  const [isExtracting, setIsExtracting] = useState(false)

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0]
    const nextFileId = createFileId(file)

    setSelectedFileId(nextFileId)
    setRawText('')
    setError('')
    setDiagnostics(null)
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
      const extractedText =
        fileKind === 'pdf' ? await extractPdfText(file) : await extractDocxText(file)
      const normalizedText = normalizeText(extractedText)
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

  const handleParseText = () => {
    const textForCurrentFile = rawText
    const { questions: parsedQuestions, diagnostics: nextDiagnostics } = parseExamText(
      textForCurrentFile,
      { debug: true },
    )
    setDiagnostics(nextDiagnostics)

    if (parsedQuestions.length === 0) {
      setError('לא זוהו שאלות מהמבחן. אפשר לבדוק את הטקסט הגולמי או להשתמש בעריכה ידנית.')
      return
    }

    setError('')
    onParsedQuestions({
      fileId: selectedFileId,
      fileName,
      questions: parsedQuestions,
      rawText: textForCurrentFile,
      diagnostics: nextDiagnostics,
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

      {diagnostics && (
        <section className="diagnostics-panel" aria-labelledby="diagnostics-title">
          <h3 id="diagnostics-title">אבחון פענוח</h3>
          <dl>
            <div>
              <dt>אורך טקסט גולמי</dt>
              <dd>{diagnostics.rawTextLength}</dd>
            </div>
            <div>
              <dt>שורות אחרי ניקוי</dt>
              <dd>{diagnostics.cleanedLinesCount}</dd>
            </div>
            <div>
              <dt>מצב פענוח</dt>
              <dd>{diagnostics.parsingMode ?? 'לא נקבע'}</dd>
            </div>
            <div>
              <dt>מועמדי שאלות</dt>
              <dd>{diagnostics.questionStartCandidatesCount}</dd>
            </div>
            <div>
              <dt>תחילות שאושרו</dt>
              <dd>{diagnostics.acceptedQuestionStartsCount}</dd>
            </div>
            <div>
              <dt>מועמדי תשובות</dt>
              <dd>{diagnostics.answerMarkerCandidatesCount}</dd>
            </div>
            <div>
              <dt>שאלות שזוהו</dt>
              <dd>{diagnostics.parsedQuestions}</dd>
            </div>
            <div>
              <dt>שאלות תקינות</dt>
              <dd>{diagnostics.validQuestions}</dd>
            </div>
            <div>
              <dt>ביטחון נמוך</dt>
              <dd>{diagnostics.lowConfidenceQuestions}</dd>
            </div>
            <div>
              <dt>תשובות עם סימון שאלה</dt>
              <dd>{diagnostics.answersContainingQuestionMarkersCount ?? 0}</dd>
            </div>
            <div>
              <dt>מספרי שאלות</dt>
              <dd>
                {diagnostics.detectedQuestionNumbers.length > 0
                  ? diagnostics.detectedQuestionNumbers.join(', ')
                  : 'אין'}
              </dd>
            </div>
          </dl>
          {diagnostics.suspiciousQuestionBlocks.length > 0 && (
            <div className="suspicious-blocks">
              <h4>בלוקים חשודים</h4>
              {diagnostics.suspiciousQuestionBlocks.map((block) => (
                <article
                  key={`${block.questionNumber}-${block.startLineNumber}`}
                  className="suspicious-block"
                >
                  <strong>
                    שאלה {block.questionNumber}, {block.answerCount} תשובות
                  </strong>
                  <pre>{block.preview}</pre>
                </article>
              ))}
            </div>
          )}
          <div className="parser-debug-grid">
            <section>
              <h4>80 שורות נקיות ראשונות</h4>
              <ol>
                {(diagnostics.firstCleanedLines ?? []).map((line) => (
                  <li key={line.lineNumber}>
                    <span>{line.lineNumber}</span>
                    <code>{line.text}</code>
                  </li>
                ))}
              </ol>
            </section>

            <section>
              <h4>שורות עם סימון שאלה אפשרי</h4>
              <ol>
                {(diagnostics.questionStartCandidates ?? []).map((candidate) => (
                  <li key={`${candidate.lineNumber}-${candidate.candidateIndex}`}>
                    <span>{candidate.lineNumber}</span>
                    <code>{candidate.text}</code>
                    <small>
                      {candidate.accepted
                        ? `זוהתה כשאלה ${candidate.questionNumber}`
                        : `נדחתה: ${candidate.reason}`}
                    </small>
                  </li>
                ))}
              </ol>
            </section>

            <section>
              <h4>שורות עם סימון תשובה אפשרי</h4>
              <ol>
                {(diagnostics.possibleAnswerMarkerLines ?? []).map((line) => (
                  <li key={line.lineNumber}>
                    <span>{line.lineNumber}</span>
                    <code>{line.text}</code>
                    <small>תשובה {line.label}</small>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </section>
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
