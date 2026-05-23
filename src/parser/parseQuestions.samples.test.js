import { parseExamText } from './parseQuestions.js'

export const parserSampleTests = [
  {
    name: 'Format 1: explicit Hebrew question marker with dotted Hebrew answers',
    expectedQuestions: 1,
    expectedValidQuestions: 1,
    expectedAnswerCount: 5,
    text: `שאלה מספר :1
מהי תבנית Singleton?
א. תשובה ראשונה
ב. תשובה שנייה
ג. תשובה שלישית
ד. תשובה רביעית
ה. תשובה חמישית`,
  },
  {
    name: 'Format 2: RTL numeric marker with English answers',
    expectedQuestions: 1,
    expectedValidQuestions: 1,
    expectedAnswerCount: 5,
    text: `.1 What is normalization?
A. First answer
B. Second answer
C. Third answer
D. Fourth answer
E. Fifth answer`,
  },
  {
    name: 'Format 3: RTL numeric marker with Hebrew dash answers',
    expectedQuestions: 1,
    expectedValidQuestions: 1,
    expectedAnswerCount: 5,
    text: `.1 מהי בדיקת יחידה?
א- תשובה ראשונה
ב- תשובה שנייה
ג- תשובה שלישית
ד- תשובה רביעית
ה- תשובה חמישית`,
  },
  {
    name: 'Format 4: leading numeric marker with four Hebrew answers',
    expectedQuestions: 1,
    expectedValidQuestions: 1,
    expectedAnswerCount: 4,
    text: `1. מהו מפתח ראשי?
א. תשובה ראשונה
ב. תשובה שנייה
ג. תשובה שלישית
ד. תשובה רביעית`,
  },
  {
    name: 'Format 5: English question marker with four English answers',
    expectedQuestions: 1,
    expectedValidQuestions: 1,
    expectedAnswerCount: 4,
    text: `Question 1
Which statement is correct?
A. First answer
B. Second answer
C. Third answer
D. Fourth answer`,
  },
  {
    name: 'Format 6: RTL extraction answer markers at line end',
    expectedQuestions: 1,
    expectedValidQuestions: 1,
    expectedAnswerCount: 3,
    text: `שאלה מספר :1
איזו תשובה נכונה?
תשובה ראשונה .א
תשובה שנייה .ב
תשובה שלישית .ג`,
  },
  {
    name: 'preserve long multi-line question and multi-line answers',
    expectedQuestions: 1,
    expectedValidQuestions: 1,
    expectedAnswerCount: 3,
    text: `.1 זהו טקסט שאלה ארוך
שממשיך לשורה נוספת לפני התשובות
ועדיין צריך להישמר כחלק מנוסח השאלה.
א. תשובה ראשונה
עם המשך בשורה נוספת
ב. תשובה שנייה
ג. תשובה שלישית`,
    assert(result) {
      const [question] = result.questions
      return (
        question.text.includes('שממשיך לשורה נוספת') &&
        question.answers[0].text.includes('עם המשך בשורה נוספת')
      )
    },
  },
  {
    name: 'ignore numeric instructions before real multiple-choice question',
    expectedQuestions: 1,
    expectedValidQuestions: 1,
    expectedAnswerCount: 4,
    text: `.1 משך הבחינה
.2 חומר עזר
שאלה מספר :1
question
א. answer
ב. answer
ג. answer
ד. answer`,
  },
  {
    name: 'ignore numeric instructions before real English numeric question',
    expectedQuestions: 1,
    expectedValidQuestions: 1,
    expectedAnswerCount: 4,
    text: `.1 משך הבחינה
.2 חומר עזר
.1 question text
A. answer
B. answer
C. answer
D. answer`,
  },
  {
    name: 'keep visual or code answer options with dot-before English labels',
    expectedQuestions: 1,
    expectedValidQuestions: 1,
    expectedAnswerCount: 5,
    text: `.5 question with visual answer options
.A
.B
.C
.D
E. all other answers are incorrect`,
    assert(result) {
      const [question] = result.questions
      return (
        question.answers.slice(0, 4).every((answer) => answer.text === '') &&
        question.answers.slice(0, 4).every((answer) => answer.warnings?.length > 0) &&
        question.answers[4].text === 'all other answers are incorrect' &&
        question.warnings.some((warning) => warning.includes('תמונה/קוד/טבלה/נוסחה'))
      )
    },
  },
  {
    name: 'do not treat open question sections as multiple-choice answers',
    expectedQuestions: 1,
    expectedValidQuestions: 0,
    expectedAnswerCount: 2,
    text: `שאלה מספר :1
ענו על הסעיפים הבאים:
א. הסבירו בקצרה את המושג.
ב. כתבו דוגמה.
סעיף נוסף ללא תשובה אמריקאית.`,
  },
  {
    name: 'support six English answers',
    expectedQuestions: 1,
    expectedValidQuestions: 1,
    expectedAnswerCount: 6,
    text: `Question 1
Choose one option.
A. answer
B. answer
C. answer
D. answer
E. answer
F. answer`,
  },
  {
    name: 'repair PDF-reversed agile versus waterfall answer lines',
    expectedQuestions: 1,
    expectedValidQuestions: 1,
    expectedAnswerCount: 5,
    text: `שאלה מספר :3
מהו המשפט הנכון בהשוואה של פיתוח אגילי אל מול פיתוח מבוסס מפל מים
להשתנות צפוי שלא מראש קבוע מפרט עם למוצר יותר מתאים מים מפל מסוג פיתוח .א
טוב יותר תיעוד נוצר אגילי בפיתוח .ב
הפרויקט ותקציב משך את טוב יותר לחזות ניתן אגילי בפיתוח .ג
הפרויקט צוות חברי בין יותר טוב קשר יש מים מפל מסוג בפיתוח .ד
שגויות האחרות התשובות כל .ה`,
    assert(result) {
      const [question] = result.questions
      return (
        question.answers[0].text.startsWith('פיתוח מסוג מפל מים מתאים') &&
        question.answers[2].text.startsWith('בפיתוח אגילי ניתן לחזות') &&
        question.answers[2].text.endsWith('משך ותקציב הפרויקט') &&
        question.answers[3].text.startsWith('בפיתוח מסוג מפל מים')
      )
    },
  },
  {
    name: 'repair additional PDF-reversed software process answer lines',
    expectedQuestions: 1,
    expectedValidQuestions: 1,
    expectedAnswerCount: 5,
    text: `שאלה מספר :4
כיצד הסעיף הבא במנשר האגילי מתבצע בפועל בשיטה האגילית
הצגות קצרות ופיתוח זמני .א
מהלקוחות שמגיעים שינויים מתעדף Scrum Master הסקראם מנהל .ב
שינויים לנהל זמן יש ולכן קצר התיעוד תהליך .ג
המיידיים הלקוח צרכי עפ"י עובדים קבועה תוכנית אין .ד
שגויות האחרות התשובות כל .ה`,
    assert(result) {
      const [question] = result.questions
      return (
        question.answers[0].text.startsWith('זמני') &&
        question.answers[1].text.startsWith('מנהל הסקראם Scrum Master') &&
        question.answers[2].text.startsWith('תהליך התיעוד קצר') &&
        question.answers[3].text.startsWith('אין תוכנית קבועה')
      )
    },
  },
]

export function runParserSampleTests() {
  return parserSampleTests.map((sample) => {
    const result = parseExamText(sample.text)
    const [question] = result.questions
    const passed =
      result.questions.length === sample.expectedQuestions &&
      result.diagnostics.validQuestions === sample.expectedValidQuestions &&
      (question?.answers.length ?? 0) === sample.expectedAnswerCount &&
      (sample.assert ? sample.assert(result) : true)

    return {
      name: sample.name,
      passed,
      parsedQuestions: result.questions.length,
      validQuestions: result.diagnostics.validQuestions,
      answerCount: question?.answers.length ?? 0,
      parsingMode: result.diagnostics.parsingMode,
    }
  })
}

const nodeProcess = globalThis.process

if (nodeProcess?.argv?.[1]?.endsWith('parseQuestions.samples.test.js')) {
  const results = runParserSampleTests()
  console.table(results)

  if (results.some((result) => !result.passed)) {
    nodeProcess.exit(1)
  }
}
