import { createId } from '../utils/ids'

const answerLabels = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח']

function QuestionEditor({ questions, onChange }) {
  const updateQuestions = (updater) => {
    onChange(updater(questions).map((question, index) => ({ ...question, number: index + 1 })))
  }

  const updateQuestionText = (questionId, text) => {
    updateQuestions(() =>
      questions.map((question) =>
        question.id === questionId ? { ...question, text } : question,
      ),
    )
  }

  const updateAnswerText = (questionId, answerId, text) => {
    updateQuestions(() =>
      questions.map((question) =>
        question.id === questionId
          ? {
              ...question,
              answers: question.answers.map((answer) =>
                answer.id === answerId ? { ...answer, text } : answer,
              ),
            }
          : question,
      ),
    )
  }

  const markCorrectAnswer = (questionId, answerId) => {
    updateQuestions(() =>
      questions.map((question) =>
        question.id === questionId
          ? {
              ...question,
              answers: question.answers.map((answer) => ({
                ...answer,
                isCorrect: answer.id === answerId,
              })),
            }
          : question,
      ),
    )
  }

  const addAnswer = (questionId) => {
    updateQuestions(() =>
      questions.map((question) => {
        if (question.id !== questionId) {
          return question
        }

        const newAnswer = {
          id: createId(`${question.id}-answer`),
          label: answerLabels[question.answers.length] ?? String(question.answers.length + 1),
          text: '',
          isCorrect: question.answers.length === 0,
        }

        return {
          ...question,
          answers: [...question.answers, newAnswer],
          confidence: question.answers.length + 1 >= 3 ? question.confidence : 'low',
        }
      }),
    )
  }

  const removeAnswer = (questionId, answerId) => {
    updateQuestions(() =>
      questions.map((question) => {
        if (question.id !== questionId) {
          return question
        }

        const removedAnswer = question.answers.find((answer) => answer.id === answerId)
        const remainingAnswers = question.answers.filter((answer) => answer.id !== answerId)
        const hasCorrectAnswer = remainingAnswers.some((answer) => answer.isCorrect)

        return {
          ...question,
          answers:
            removedAnswer?.isCorrect && !hasCorrectAnswer && remainingAnswers[0]
              ? remainingAnswers.map((answer, index) => ({
                  ...answer,
                  isCorrect: index === 0,
                }))
              : remainingAnswers,
          confidence: remainingAnswers.length < 3 ? 'low' : question.confidence,
        }
      }),
    )
  }

  const deleteQuestion = (questionId) => {
    updateQuestions(() => questions.filter((question) => question.id !== questionId))
  }

  const addQuestion = () => {
    const questionId = createId('question')
    updateQuestions(() => [
      ...questions,
      {
        id: questionId,
        number: questions.length + 1,
        text: '',
        answers: [
          {
            id: createId(`${questionId}-answer`),
            label: 'א',
            text: '',
            isCorrect: true,
          },
          {
            id: createId(`${questionId}-answer`),
            label: 'ב',
            text: '',
            isCorrect: false,
          },
          {
            id: createId(`${questionId}-answer`),
            label: 'ג',
            text: '',
            isCorrect: false,
          },
        ],
        confidence: 'low',
        warnings: ['שאלה נוספה ידנית ודורשת בדיקה.'],
      },
    ])
  }

  return (
    <>
      <div className="editor-toolbar">
        <button type="button" className="secondary-button" onClick={addQuestion}>
          הוספת שאלה
        </button>
      </div>

      <div className="question-list">
        {questions.map((question) => {
          const warnings = [
            ...(question.warnings ?? []),
            ...(question.confidence === 'low' ? ['ביטחון נמוך בזיהוי השאלה.'] : []),
            ...(question.answers.length < 3 ? ['לשאלה יש פחות משלוש תשובות.'] : []),
          ]

          return (
            <article className="question-card" key={question.id}>
              <div className="question-meta">
                <span>שאלה {question.number}</span>
                <span>{question.answers.length} תשובות</span>
              </div>

              {warnings.length > 0 && (
                <div className="question-warnings" role="status">
                  {warnings.map((warning) => (
                    <span key={warning}>{warning}</span>
                  ))}
                </div>
              )}

              <label className="field-label">
                נוסח השאלה
                <textarea
                  value={question.text}
                  onChange={(event) => updateQuestionText(question.id, event.target.value)}
                />
              </label>

              <div>
                {question.answers.map((answer) => (
                  <div className="answer-editor" key={answer.id}>
                    <span className="answer-label">{answer.label}</span>
                    <input
                      type="text"
                      value={answer.text}
                      aria-label={`תשובה ${answer.label} לשאלה ${question.number}`}
                      onChange={(event) =>
                        updateAnswerText(question.id, answer.id, event.target.value)
                      }
                    />
                    <label className="correct-badge">
                      <input
                        type="radio"
                        name={`correct-${question.id}`}
                        checked={answer.isCorrect}
                        onChange={() => markCorrectAnswer(question.id, answer.id)}
                      />{' '}
                      נכונה
                    </label>
                    <button
                      type="button"
                      className="small-danger-button"
                      onClick={() => removeAnswer(question.id, answer.id)}
                    >
                      הסרה
                    </button>
                  </div>
                ))}
              </div>

              <div className="question-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => addAnswer(question.id)}
                >
                  הוספת תשובה
                </button>
                <button
                  type="button"
                  className="danger-button"
                  onClick={() => deleteQuestion(question.id)}
                >
                  מחיקת שאלה
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </>
  )
}

export default QuestionEditor
