import { useState } from 'react'

function ExamRunner({ questions, selectedAnswers, onAnswerChange, onBack, onFinish }) {
  const [requestedIndex, setRequestedIndex] = useState(0)

  if (questions.length === 0) {
    return (
      <section className="screen-panel runner-card" aria-labelledby="practice-title">
        <h2 id="practice-title">תרגול מבחן</h2>
        <p className="warning-summary">אין שאלות לתרגול. חזרו למסך העריכה והוסיפו שאלות.</p>
        <button type="button" className="ghost-button" onClick={onBack}>
          חזרה לעריכה
        </button>
      </section>
    )
  }

  const currentIndex = Math.min(requestedIndex, questions.length - 1)
  const currentQuestion = questions[currentIndex]
  const isLastQuestion = currentIndex === questions.length - 1
  const selectedAnswerId = selectedAnswers[currentQuestion.id] ?? ''
  const answeredCount = questions.filter((question) => selectedAnswers[question.id]).length
  const unansweredCount = questions.length - answeredCount

  const selectAnswer = (answerId) => {
    onAnswerChange(currentQuestion.id, answerId)
  }

  const submitExam = () => {
    if (
      unansweredCount > 0 &&
      !window.confirm(`יש ${unansweredCount} שאלות ללא תשובה. להגיש את המבחן בכל זאת?`)
    ) {
      return
    }

    onFinish()
  }

  const goNext = () => {
    if (isLastQuestion) {
      submitExam()
      return
    }

    setRequestedIndex((index) => Math.min(questions.length - 1, index + 1))
  }

  return (
    <section className="screen-panel runner-card" aria-labelledby="practice-title">
      <div>
        <h2 id="practice-title">תרגול מבחן</h2>
        <div className="progress-line">
          <span>
            שאלה {currentIndex + 1} מתוך {questions.length}
          </span>
          <span>
            נענו {answeredCount} | ללא תשובה {unansweredCount}
          </span>
        </div>
      </div>

      <article className="question-card">
        <div className="question-meta">
          <span>שאלה {currentQuestion.number}</span>
          <span>{currentQuestion.answers.length} תשובות</span>
        </div>
        <h3>{currentQuestion.text}</h3>
        <div>
          {currentQuestion.answers.map((answer) => (
            <label
              key={answer.id}
              className={`answer-option ${selectedAnswerId === answer.id ? 'selected' : ''}`}
            >
              <input
                type="radio"
                name={`question-${currentQuestion.id}`}
                checked={selectedAnswerId === answer.id}
                onChange={() => selectAnswer(answer.id)}
              />
              <span className="answer-label">{answer.displayLabel ?? answer.label}</span>
              <span>{answer.text}</span>
            </label>
          ))}
        </div>
      </article>

      <div className="runner-footer">
        <button type="button" className="ghost-button" onClick={onBack}>
          חזרה לעריכה
        </button>
        <div className="panel-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => setRequestedIndex((index) => Math.max(0, index - 1))}
            disabled={currentIndex === 0}
          >
            שאלה קודמת
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={submitExam}
          >
            הגשת מבחן
          </button>
          <button type="button" className="primary-button" onClick={goNext}>
            {isLastQuestion ? 'סיום מבחן' : 'שאלה הבאה'}
          </button>
        </div>
      </div>
    </section>
  )
}

export default ExamRunner
