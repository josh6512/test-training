function ParsePreview({ questions, children, onBack, onStartPractice }) {
  const lowConfidenceCount = questions.filter(
    (question) => question.confidence === 'low' || question.answers.length < 3,
  ).length

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
