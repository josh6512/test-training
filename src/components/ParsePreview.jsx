function formatList(items) {
  return items?.length > 0 ? items.join(', ') : 'אין'
}

function ParsePreview({ questions, children, diagnostics, onBack, onStartPractice }) {
  const lowConfidenceCount = questions.filter(
    (question) => question.confidence === 'low' || question.answers.length < 3,
  ).length
  const report = diagnostics?.diagnosticsReport
    ? {
        warnings: [],
        questionDiagnostics: [],
        questionsWithZeroAnswers: [],
        questionsWithOneAnswer: [],
        questionsWithTwoAnswers: [],
        questionsWithThreeOrMoreAnswers: [],
        questionsWithMoreThanSixAnswers: [],
        missingQuestionNumbers: [],
        duplicateQuestionNumbers: [],
        unparsedOrLowConfidenceBlocks: [],
        ...diagnostics.diagnosticsReport,
      }
    : null

  return (
    <section className="screen-panel" aria-labelledby="preview-title">
      <div className="panel-header">
        <div>
          <h2 id="preview-title">תצוגה מקדימה ועריכה</h2>
          <p className="muted">
            נמצאו {questions.length} שאלות. ניתן לערוך טקסטים, תשובות וסימון תשובה נכונה.
          </p>
          {lowConfidenceCount > 0 && (
            <p className="warning-summary">
              {lowConfidenceCount} שאלות דורשות בדיקה בגלל ביטחון נמוך או פחות משלוש תשובות.
            </p>
          )}

          {diagnostics && (
            <div className="preview-diagnostics" aria-label="אבחון פענוח">
              <span>אורך טקסט: {diagnostics.rawTextLength}</span>
              <span>שאלות: {diagnostics.parsedQuestions}</span>
              <span>תחילות שאלה: {diagnostics.detectedQuestionStartLinesCount}</span>
              <span>תקינות: {diagnostics.validQuestions}</span>
              <span>ביטחון נמוך: {diagnostics.lowConfidenceQuestions}</span>
              <span>
                מספרים ראשונים:{' '}
                {diagnostics.firstQuestionNumbers?.length > 0
                  ? diagnostics.firstQuestionNumbers.join(', ')
                  : 'אין'}
              </span>
            </div>
          )}

          {report && (
            <section className="diagnostics-panel" aria-labelledby="diagnostics-report-title">
              <h3 id="diagnostics-report-title">דוח אבחון פענוח</h3>
              <dl>
                <div>
                  <dt>אורך טקסט גולמי</dt>
                  <dd>{report.rawTextLength}</dd>
                </div>
                <div>
                  <dt>מספר שורות לאחר ניקוי</dt>
                  <dd>{report.cleanedLinesCount}</dd>
                </div>
                <div>
                  <dt>מועמדים לתחילת שאלה</dt>
                  <dd>{report.questionStartCandidatesCount}</dd>
                </div>
                <div>
                  <dt>תחילות שאלה שאושרו</dt>
                  <dd>{report.acceptedQuestionStartsCount}</dd>
                </div>
                <div>
                  <dt>סימוני תשובות שזוהו</dt>
                  <dd>{report.answerMarkerCandidatesCount}</dd>
                </div>
                <div>
                  <dt>שאלות שזוהו</dt>
                  <dd>{report.totalQuestionsDetected}</dd>
                </div>
                <div>
                  <dt>שאלות תקינות</dt>
                  <dd>{report.validMultipleChoiceQuestions}</dd>
                </div>
                <div>
                  <dt>שאלות בביטחון נמוך</dt>
                  <dd>{report.lowConfidenceQuestions}</dd>
                </div>
                <div>
                  <dt>שאלות עם פחות מ־2 תשובות</dt>
                  <dd>{report.questionsWithZeroAnswers.length + report.questionsWithOneAnswer.length}</dd>
                </div>
                <div>
                  <dt>שאלות עם 2 תשובות</dt>
                  <dd>{report.questionsWithTwoAnswers.length}</dd>
                </div>
                <div>
                  <dt>שאלות עם 3 תשובות ומעלה</dt>
                  <dd>{report.questionsWithThreeOrMoreAnswers.length}</dd>
                </div>
                <div>
                  <dt>יותר מ־6 תשובות</dt>
                  <dd>{report.questionsWithMoreThanSixAnswers.length}</dd>
                </div>
                <div>
                  <dt>מצב פענוח</dt>
                  <dd>{report.parsingMode}</dd>
                </div>
                <div>
                  <dt>מספרים חסרים</dt>
                  <dd>{formatList(report.missingQuestionNumbers)}</dd>
                </div>
                <div>
                  <dt>מספרים כפולים</dt>
                  <dd>
                    {report.duplicateQuestionNumbers.length > 0
                      ? report.duplicateQuestionNumbers
                          .map((item) => `${item.number} (${item.count})`)
                          .join(', ')
                      : 'אין'}
                  </dd>
                </div>
              </dl>

              {report.warnings.length > 0 && (
                <div className="question-warnings" role="status" aria-label="אזהרות פענוח">
                  {report.warnings.map((warning) => (
                    <span key={warning}>{warning}</span>
                  ))}
                </div>
              )}

              <details className="diagnostics-details">
                <summary>אבחון לפי שאלה</summary>
                <div className="question-diagnostics-list">
                  {report.questionDiagnostics.map((item, index) => (
                    <article className="suspicious-block" key={`${item.questionNumber}-${index}`}>
                      <strong>
                        שאלה {item.questionNumber}: {item.answerCount} תשובות, ביטחון{' '}
                        {item.confidence}
                      </strong>
                      <p>
                        טקסט שאלה ריק: {item.hasEmptyQuestionText ? 'כן' : 'לא'} | תשובה ריקה:{' '}
                        {item.hasEmptyAnswerText ? 'כן' : 'לא'} | תשובה כוללת התחלת שאלה:{' '}
                        {item.answerTextContainsQuestionMarker ? 'כן' : 'לא'}
                      </p>
                      {item.warnings.length > 0 && <p>אזהרות: {item.warnings.join(' | ')}</p>}
                    </article>
                  ))}
                </div>
              </details>

              <details className="diagnostics-details">
                <summary>שורות לאחר ניקוי - 80 ראשונות</summary>
                <ol className="debug-list">
                  {diagnostics.firstCleanedLines?.map((line) => (
                    <li key={line.cleanedIndex ?? line.lineNumber}>
                      <span>{line.lineNumber}</span>
                      <code>{line.text}</code>
                    </li>
                  ))}
                </ol>
              </details>

              <details className="diagnostics-details">
                <summary>תחילות שאלה שאושרו</summary>
                <ol className="debug-list">
                  {diagnostics.acceptedQuestionStarts?.map((candidate) => (
                    <li key={`${candidate.lineNumber}-${candidate.questionNumber}`}>
                      <span>
                        שורה {candidate.lineNumber}, שאלה {candidate.questionNumber},{' '}
                        {candidate.markerType}
                      </span>
                      <code>{candidate.text}</code>
                    </li>
                  ))}
                </ol>
              </details>

              <details className="diagnostics-details">
                <summary>מועמדים שנדחו וסיבות</summary>
                <ol className="debug-list">
                  {diagnostics.rejectedQuestionStarts?.map((candidate) => (
                    <li key={`${candidate.lineNumber}-${candidate.candidateIndex}`}>
                      <span>
                        שורה {candidate.lineNumber}, סיבה: {candidate.reason}
                      </span>
                      <code>{candidate.text}</code>
                    </li>
                  ))}
                </ol>
              </details>

              <details className="diagnostics-details">
                <summary>בלוקים חשודים</summary>
                {report.unparsedOrLowConfidenceBlocks.length > 0 ? (
                  <div className="suspicious-blocks">
                    {report.unparsedOrLowConfidenceBlocks.map((block, index) => (
                      <article className="suspicious-block" key={`${block.questionNumber}-${index}`}>
                        <strong>
                          שאלה {block.questionNumber} | {block.answerCount} תשובות
                        </strong>
                        <pre>{block.preview}</pre>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="muted">אין בלוקים חשודים להצגה.</p>
                )}
              </details>
            </section>
          )}
        </div>
        <button type="button" className="secondary-button" onClick={onStartPractice}>
          התחלת תרגול
        </button>
      </div>

      {children}

      <div className="panel-actions">
        <button type="button" className="ghost-button" onClick={onBack}>
          חזרה להעלאה
        </button>
        <button type="button" className="primary-button" onClick={onStartPractice}>
          המשך לתרגול
        </button>
      </div>
    </section>
  )
}

export default ParsePreview
