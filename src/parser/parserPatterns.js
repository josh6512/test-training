const answerLetters = 'א-תA-Za-z'

export const parserPatterns = {
  explicitHebrewQuestion:
    /^שאלה\s+(?:מספר\s*)?:?\s*(\d{1,3})(?:\b|$)\s*(.*)$/i,
  reversedHebrewQuestion:
    /^:?\s*(\d{1,3})\s*:?\s*מספר\s+שאלה(?:\b|$)\s*(.*)$/i,
  englishQuestion: /^question\s+(\d{1,3})(?:\b|$)\s*(.*)$/i,
  englishShortQuestion: /^q\.?\s*(\d{1,3})(?:\b|$)\s*(.*)$/i,
  leadingNumberQuestion: /^(\d{1,3})\s*[.)]\s*(.*)$/,
  wrappedNumberQuestion: /^\(\s*(\d{1,3})\s*\)\s*(.*)$/,
  rtlNumberQuestion: /^\.\s*(\d{1,3})\s*(.*)$/,

  answerAtStart: new RegExp(
    `^\\s*(?:\\(([${answerLetters}])\\)|\\.\\s*([${answerLetters}])|([${answerLetters}])\\s*[.)-])\\s*(.*)$`,
  ),
  answerAtEnd: new RegExp(
    `^\\s*(.+?)\\s+(?:[.)-]\\s*([${answerLetters}])|\\(([${answerLetters}])\\))\\s*$`,
  ),

  pageNumber: /^\s*-?\s*\d{1,3}\s*-?\s*$/,
  year: /^\s*(?:19|20)\d{2}\s*$/,
  percent: /^\s*\d+(?:\.\d+)?%\s*$/,
  decimal: /^\s*\d+\.\d+\s*$/,
  hebrewPageCount: /עמוד\s+\d+\s+מתוך\s+\d+/,
  englishPageCount: /page\s+\d+\s+(?:of|\/)\s+\d+/i,
  examNumber: /מבחן\s+מס['׳`]?/,
  examCode: /קוד\s+מבחן|קוד\s+בחינה|exam\s*code|course\s*code/i,
  sectionHeader: /^חלק\s+[א-תA-Z](?:\s|:|$)/i,
  likelyHeader:
    /(מכללה|אוניברסיטה|מכון|פקולטה|מחלקה|קורס|בחינה|מבחן|college|university|institute|faculty|course|exam)/i,
}
