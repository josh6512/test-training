function ResultsView({ results, summary, onEdit, onRestart }) {
  return (
    <section className="screen-panel" aria-labelledby="results-title">
      <div className="panel-header">
        <div>
          <h2 id="results-title">תוצאות</h2>
          <p className="muted">סיכום התרגול לפי התשובות שנבחרו.</p>
        </div>
        <button type="button" className="primary-button" onClick={onRestart}>
          תרגול מחדש
        </button>
      </div>

      <div className="results-summary">
        <div className="summary-tile">
          ציון
          <strong>{summary.score}%</strong>
        </div>
        <div className="summary-tile">
          תשובות נכונות
          <strong>{summary.correctCount}</strong>
        </div>
        <div className="summary-tile">
          תשובות שגויות
          <strong>{summary.wrongCount}</strong>
        </div>
        <div className="summary-tile">
          ללא תשובה
          <strong>{summary.unansweredCount}</strong>
        </div>
      </div>

      <div className="question-list">
        {results.map(({ question, selectedAnswer, correctAnswer, status }) => {
          const isCorrect = status === 'correct'
          const isWrong = status === 'wrong'
          const isUnanswered = status === 'unanswered'
          const isInvalid = status === 'invalid'

          return (
            <article className="question-card" key={question.id}>
              <div className="question-meta">
                <span>שאלה {question.number}</span>
                <span className={isCorrect ? 'correct-badge' : 'danger'}>
                  {isCorrect && 'נכון'}
                  {isWrong && 'לא נכון'}
                  {isUnanswered && 'לא נענתה'}
                  {isInvalid && 'אין תשובה נכונה מוגדרת'}
                </span>
              </div>
              <h3>{question.text}</h3>

              {isInvalid && (
                <p className="warning-summary">
                  לשאלה זו אין תשובה שמסומנת כנכונה, ולכן היא נספרת כלא פתורה.
                </p>
              )}

              <div className="result-detail">
                <strong>התשובה שלך:</strong>{' '}
                {selectedAnswer
                  ? `${selectedAnswer.displayLabel ?? selectedAnswer.label}. ${selectedAnswer.text}`
                  : 'לא נבחרה תשובה'}
              </div>
              <div className="result-detail">
                <strong>התשובה הנכונה:</strong>{' '}
                {correctAnswer
                  ? `${correctAnswer.displayLabel ?? correctAnswer.label}. ${correctAnswer.text}`
                  : 'לא הוגדרה'}
              </div>

              {question.answers.map((answer) => {
                const isSelected = selectedAnswer?.id === answer.id
                const className = [
                  'result-answer',
                  answer.isCorrect ? 'correct' : '',
                  isSelected && !answer.isCorrect ? 'wrong' : '',
                ]
                  .filter(Boolean)
                  .join(' ')

                return (
                  <div className={className} key={answer.id}>
                    <span className="answer-label">{answer.displayLabel ?? answer.label}</span>
                    <span>{answer.text}</span>
                    <span className="muted">
                      {answer.isCorrect ? 'התשובה הנכונה' : isSelected ? 'נבחרה' : ''}
                    </span>
                  </div>
                )
              })}
            </article>
          )
        })}
      </div>

      <div className="panel-actions">
        <button type="button" className="ghost-button" onClick={onEdit}>
          חזרה לעריכה
        </button>
        <button type="button" className="primary-button" onClick={onRestart}>
          התחלה מחדש
        </button>
      </div>
    </section>
  )
}

export default ResultsView
