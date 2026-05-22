import { normalizeText } from './normalizeText.js'
import { parserPatterns } from './parserPatterns.js'

const hebrewAnswerOrder = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י']
const englishAnswerOrder = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const minimumSequentialAnswersForMultipleChoice = 3
const explicitMarkerTypes = new Set([
  'explicit-hebrew',
  'explicit-hebrew-rtl',
  'explicit-english',
])

function isDevelopmentMode() {
  return import.meta.env?.DEV ?? false
}

function compactLine(line) {
  return line.replace(/\s+/g, ' ').trim()
}

function normalizeLine(line) {
  return compactLine(normalizeText(line))
}

function isPunctuationToken(token) {
  return /^[.,:;!?()[\]{}"'״׳-]+$/u.test(token)
}

function isHebrewToken(token) {
  return /\p{Script=Hebrew}/u.test(token)
}

function isLatinToken(token) {
  return /^[A-Za-z][A-Za-z0-9_:/.-]*$/u.test(token)
}

function getHebrewTokens(tokens) {
  return tokens.filter(isHebrewToken)
}

const likelyHebrewSentenceStarts = new Set([
  'מה',
  'מהו',
  'מהי',
  'מי',
  'איזה',
  'איזו',
  'כיצד',
  'למה',
  'מדוע',
  'האם',
  'כל',
  'אין',
  'יש',
  'פיתוח',
  'בפיתוח',
  'תהליך',
  'מנהל',
  'זמני',
  'משתמשים',
  'לתעדף',
  'לדון',
  'לבצע',
  'נוצר',
  'ניתן',
])

const unlikelyHebrewSentenceStarts = new Set([
  'של',
  'את',
  'הספרינט',
  'הבא',
  'הפרויקט',
  'הלקוחות',
  'שינויים',
  'תיעוד',
  'קבוע',
  'מפרט',
  'התנהגות',
  'שגויות',
  'עצמים',
  'תבניות',
])

function normalizeHebrewToken(token) {
  return token.replace(/^[^\p{Script=Hebrew}]+|[^\p{Script=Hebrew}]+$/gu, '')
}

function startsWithHebrewPrefix(token, prefixes) {
  return prefixes.some((prefix) => token.startsWith(prefix) && token.length > prefix.length + 1)
}

function scoreHebrewWordOrder(tokens) {
  const hebrewTokens = getHebrewTokens(tokens).map(normalizeHebrewToken).filter(Boolean)

  if (hebrewTokens.length < 3) {
    return 0
  }

  const first = hebrewTokens[0]
  const second = hebrewTokens[1] ?? ''
  const last = hebrewTokens.at(-1)
  let score = 0

  if (likelyHebrewSentenceStarts.has(first)) score += 5
  if (unlikelyHebrewSentenceStarts.has(first)) score -= 5
  if (likelyHebrewSentenceStarts.has(last)) score -= 4
  if (unlikelyHebrewSentenceStarts.has(last)) score += 2
  if (startsWithHebrewPrefix(first, ['ב', 'ל']) && !unlikelyHebrewSentenceStarts.has(first)) score += 1
  if (first === 'את' || first === 'של') score -= 4
  if (second === 'את' || second === 'של') score += 1
  if (hebrewTokens.includes('את') && hebrewTokens.indexOf('את') < hebrewTokens.length - 1) score += 1

  return score
}

function shouldRepairPdfRtlWordOrder(line) {
  const tokens = line.split(/\s+/u).filter(Boolean)
  const hebrewTokens = getHebrewTokens(tokens)

  if (hebrewTokens.length < 3) {
    return false
  }

  const { remaining, trailing } = splitTrailingLatinPhrase(tokens)
  const originalScore = scoreHebrewWordOrder(tokens)
  const repairedScore = scoreHebrewWordOrder([...remaining].reverse().concat(trailing))

  return repairedScore >= originalScore + 3
}

function splitTrailingLatinPhrase(tokens) {
  const trailing = []
  const remaining = [...tokens]

  while (remaining.length > 0 && isLatinToken(remaining.at(-1))) {
    trailing.unshift(remaining.pop())
  }

  return {
    remaining,
    trailing,
  }
}

function repairPdfRtlWordOrder(line) {
  const tokens = line.split(/\s+/u).filter(Boolean)
  const { remaining, trailing } = splitTrailingLatinPhrase(tokens)
  const groups = []
  let latinGroup = []

  remaining.forEach((token) => {
    if (isLatinToken(token)) {
      latinGroup.push(token)
      return
    }

    if (latinGroup.length > 0) {
      groups.push(latinGroup.join(' '))
      latinGroup = []
    }

    groups.push(token)
  })

  if (latinGroup.length > 0) {
    groups.push(latinGroup.join(' '))
  }

  return [...groups.reverse(), ...trailing]
    .join(' ')
    .replace(/(^|\s)([בלכמ])\s+([A-Za-z])/gu, '$1$2-$3')
}

function restoreRtlWordOrder(line) {
  const cleanedLine = compactLine(line)

  if (isPunctuationToken(cleanedLine)) {
    return ''
  }

  const punctuationCleanedLine = cleanedLine
    .replace(/^[?.]+\s*/u, '')
    .replace(/^\.\s+/u, '')
    .replace(/^[:;]\s*(?=\p{Script=Hebrew}|\p{Script=Latin})/u, '')
    .replace(/\s+([:;,.!?])$/u, '$1')
    .replace(/\s+([:;,.!?])\s+/gu, '$1 ')
    .replace(/\s*-\s*/gu, '-')
    .trim()

  return shouldRepairPdfRtlWordOrder(punctuationCleanedLine)
    ? repairPdfRtlWordOrder(punctuationCleanedLine)
    : punctuationCleanedLine
}

function cleanDisplayText(text) {
  return text
    .split('\n')
    .map((line) =>
      restoreRtlWordOrder(
        compactLine(line)
          .replace(/^[?.]+\s*/u, '')
          .replace(/^\.\s+/u, '')
          .replace(/\s*(?:Methodologies|Technologies|Technologies\s+for|Methodologies\s+for)\b.*$/iu, '')
          .trim(),
      ),
    )
    .filter(Boolean)
    .join('\n')
}

function normalizeAnswerLabel(label) {
  const cleanLabel = label.trim()
  return /^[a-z]$/i.test(cleanLabel) ? cleanLabel.toUpperCase() : cleanLabel
}

function isReasonableQuestionNumber(number) {
  return Number.isInteger(number) && number >= 1 && number <= 200
}

function getAnswerFamily(label) {
  return /^[A-Z]$/.test(label) ? 'english' : 'hebrew'
}

function getAnswerOrderIndex(label) {
  const normalizedLabel = normalizeAnswerLabel(label)
  const englishIndex = englishAnswerOrder.indexOf(normalizedLabel)

  if (englishIndex >= 0) {
    return englishIndex
  }

  return hebrewAnswerOrder.indexOf(normalizedLabel)
}

function getAnswerMatch(line) {
  const normalizedLine = normalizeLine(line)
  const startMatch = normalizedLine.match(parserPatterns.answerAtStart)

  if (startMatch) {
    const label = normalizeAnswerLabel(startMatch[1] ?? startMatch[2])

    return {
      label,
      normalizedLabel: label,
      markerType: startMatch[1] ? 'wrapped-answer-start' : 'answer-start',
      confidenceScore: 90,
      text: startMatch[3] ?? '',
    }
  }

  const endMatch = normalizedLine.match(parserPatterns.answerAtEnd)

  if (!endMatch) {
    return null
  }

  const label = normalizeAnswerLabel(endMatch[2] ?? endMatch[3])

  return {
    label,
    normalizedLabel: label,
    markerType: 'answer-end-rtl',
    confidenceScore: 70,
    text: endMatch[1] ?? '',
  }
}

function getQuestionMarkerMatch(line) {
  const normalizedLine = normalizeLine(line)
  const matchers = [
    {
      markerType: 'explicit-hebrew',
      confidenceScore: 95,
      match: normalizedLine.match(parserPatterns.explicitHebrewQuestion),
    },
    {
      markerType: 'explicit-hebrew-rtl',
      confidenceScore: 90,
      match: normalizedLine.match(parserPatterns.reversedHebrewQuestion),
    },
    {
      markerType: 'explicit-english',
      confidenceScore: 95,
      match: normalizedLine.match(parserPatterns.englishQuestion),
    },
    {
      markerType: 'explicit-english',
      confidenceScore: 88,
      match: normalizedLine.match(parserPatterns.englishShortQuestion),
    },
    {
      markerType: 'numeric-leading',
      confidenceScore: 62,
      match: normalizedLine.match(parserPatterns.leadingNumberQuestion),
    },
    {
      markerType: 'numeric-wrapped',
      confidenceScore: 62,
      match: normalizedLine.match(parserPatterns.wrappedNumberQuestion),
    },
    {
      markerType: 'numeric-rtl',
      confidenceScore: 62,
      match: normalizedLine.match(parserPatterns.rtlNumberQuestion),
    },
  ]

  const marker = matchers.find((item) => item.match)

  if (!marker) {
    return null
  }

  const number = Number(marker.match[1])
  const remainder = marker.match[2] ?? ''

  return {
    questionNumber: number,
    markerType: marker.markerType,
    confidenceScore: remainder.trim() ? marker.confidenceScore : Math.min(marker.confidenceScore, 58),
    remainder,
  }
}

function getNoiseReason(line) {
  const normalizedLine = normalizeLine(line)

  if (!normalizedLine) return 'empty-line'
  if (parserPatterns.pageNumber.test(normalizedLine)) return 'page-number'
  if (parserPatterns.year.test(normalizedLine)) return 'year'
  if (parserPatterns.percent.test(normalizedLine)) return 'percentage'
  if (parserPatterns.decimal.test(normalizedLine)) return 'decimal'
  if (parserPatterns.hebrewPageCount.test(normalizedLine)) return 'page-count'
  if (parserPatterns.englishPageCount.test(normalizedLine)) return 'page-count'
  if (parserPatterns.examNumber.test(normalizedLine)) return 'exam-number'
  if (parserPatterns.examCode.test(normalizedLine)) return 'exam-code'
  if (parserPatterns.sectionHeader.test(normalizedLine)) return 'section-header'

  return ''
}

function isHeaderLike(line) {
  return parserPatterns.likelyHeader.test(normalizeLine(line))
}

function buildRawLineItems(rawText) {
  let syntheticIndex = 0

  return normalizeText(rawText)
    .split('\n')
    .flatMap((line, index) =>
      splitLineAtEmbeddedQuestionMarker(normalizeLine(line)).map((text, splitIndex) => {
        const item = {
          lineIndex: syntheticIndex,
          originalLineIndex: index,
          lineNumber: index + 1,
          splitIndex,
          text,
        }

        syntheticIndex += 1
        return item
      }),
    )
}

function findEmbeddedQuestionMarkerIndex(line) {
  const normalizedLine = normalizeLine(line)
  const patterns = [
    /\s+שאלה\s+מספר\s*:?\s*\d{1,3}/u,
    /[\s:]+\d{1,3}\s*:?\s*מספר\s+שאלה/u,
    /\s+Question\s+\d{1,3}/iu,
    /\s+Q\.?\s*\d{1,3}/iu,
  ]
  const matches = patterns
    .map((pattern) => {
      const match = normalizedLine.match(pattern)
      return match ? match.index : -1
    })
    .filter((index) => index > 0)

  return matches.length > 0 ? Math.min(...matches) : -1
}

function splitLineAtEmbeddedQuestionMarker(line) {
  const normalizedLine = normalizeLine(line)
  const embeddedIndex = findEmbeddedQuestionMarkerIndex(normalizedLine)

  if (embeddedIndex <= 0) {
    return [normalizedLine]
  }

  return [
    normalizedLine.slice(0, embeddedIndex).trim(),
    normalizedLine.slice(embeddedIndex).trim(),
  ].filter(Boolean)
}

function cleanLines(rawText) {
  const rawLineItems = buildRawLineItems(rawText)
  const lineCounts = new Map()

  rawLineItems.forEach(({ text }) => {
    if (text) {
      lineCounts.set(text, (lineCounts.get(text) ?? 0) + 1)
    }
  })

  return rawLineItems
    .filter((lineItem) => {
      const questionMarker = getQuestionMarkerMatch(lineItem.text)
      const answerMarker = getAnswerMatch(lineItem.text)

      if (questionMarker || answerMarker) {
        return true
      }

      if (getNoiseReason(lineItem.text)) {
        return false
      }

      return !((lineCounts.get(lineItem.text) ?? 0) > 1 && isHeaderLike(lineItem.text))
    })
    .map((lineItem, cleanedIndex) => ({
      ...lineItem,
      cleanedIndex,
    }))
}

function getNextContentLine(lineItems, startIndex) {
  for (let index = startIndex + 1; index < lineItems.length; index += 1) {
    if (lineItems[index].text) {
      return lineItems[index].text
    }
  }

  return ''
}

function getQuestionCandidate(lineItem, nextLine = '') {
  const answerMarker = getAnswerMatch(lineItem.text)

  if (answerMarker) {
    return {
      ...lineItem,
      accepted: false,
      reason: 'answer-marker',
    }
  }

  const noiseReason = getNoiseReason(lineItem.text)

  if (noiseReason) {
    return {
      ...lineItem,
      accepted: false,
      reason: noiseReason,
    }
  }

  const markerMatch = getQuestionMarkerMatch(lineItem.text)

  if (!markerMatch) {
    return null
  }

  if (!isReasonableQuestionNumber(markerMatch.questionNumber)) {
    return {
      ...lineItem,
      ...markerMatch,
      accepted: false,
      reason: 'question-number-out-of-range',
    }
  }

  if (/^\d/.test(markerMatch.remainder.trim())) {
    return {
      ...lineItem,
      ...markerMatch,
      accepted: false,
      reason: 'numeric-fragment-after-marker',
    }
  }

  if (!markerMatch.remainder.trim() && !nextLine) {
    return {
      ...lineItem,
      ...markerMatch,
      accepted: false,
      reason: 'marker-only-without-following-text',
    }
  }

  if (!markerMatch.remainder.trim() && getAnswerMatch(nextLine)) {
    return {
      ...lineItem,
      ...markerMatch,
      accepted: false,
      reason: 'marker-only-before-answer',
    }
  }

  return {
    ...lineItem,
    ...markerMatch,
    accepted: false,
    reason: 'pending-block-validation',
  }
}

function buildQuestionStartCandidates(lineItems) {
  return lineItems
    .map((lineItem, index) => getQuestionCandidate(lineItem, getNextContentLine(lineItems, index)))
    .filter(Boolean)
    .map((candidate, index) => ({
      ...candidate,
      candidateIndex: index + 1,
    }))
}

function buildAnswerStartCandidates(lineItems) {
  return lineItems
    .map((lineItem) => {
      const answer = getAnswerMatch(lineItem.text)

      return answer
        ? {
            ...lineItem,
            ...answer,
          }
        : null
    })
    .filter(Boolean)
}

function splitBlocksFromStarts(lineItems, starts) {
  if (starts.length === 0) {
    return []
  }

  const sortedStarts = [...starts].sort((first, second) => first.cleanedIndex - second.cleanedIndex)

  return sortedStarts.map((start, index) => {
    const nextStart = sortedStarts[index + 1]
    const safeStartLineIndex = start.cleanedIndex
    const safeEndLineIndex = nextStart ? nextStart.cleanedIndex : lineItems.length
    const followingLines = lineItems
      .slice(safeStartLineIndex + 1, safeEndLineIndex)
      .map((line) => line.text)

    return {
      number: start.questionNumber,
      startLineNumber: start.lineNumber,
      startCleanedIndex: safeStartLineIndex,
      endCleanedIndex: safeEndLineIndex,
      markerType: start.markerType,
      confidenceScore: start.confidenceScore,
      lines: start.remainder?.trim() ? [start.remainder, ...followingLines] : followingLines,
    }
  })
}

function pushCurrentAnswer(answers, currentAnswer, firstAnswerId) {
  if (!currentAnswer) {
    return firstAnswerId
  }

  const answer = {
    ...currentAnswer,
    text: cleanDisplayText(currentAnswer.textLines.map(compactLine).filter(Boolean).join('\n')),
    isCorrect: currentAnswer.id === firstAnswerId,
  }

  delete answer.textLines
  answers.push(answer)
  return firstAnswerId
}

function isQuestionMarkerText(text) {
  return (
    /שאלה\s+מספר|Question\s+\d+|^\s*\d+\s*[.)]/u.test(text) ||
    /\d{1,3}\s*:?\s*מספר\s+שאלה/u.test(text) ||
    findEmbeddedQuestionMarkerIndex(text) >= 0
  )
}

function removeQuestionMarkerContamination(text) {
  const safeLines = []

  for (const line of text.split('\n')) {
    if (isQuestionMarkerText(line) || lineContainsQuestionMarker(line)) {
      break
    }

    safeLines.push(line)
  }

  return safeLines.join('\n').trim()
}

function getAnswerSequenceStats(answers) {
  const familyCounts = { english: 0, hebrew: 0 }
  let maxRun = 0
  let currentRun = 0
  let previousIndex = null
  let previousFamily = null

  answers.forEach((answer) => {
    const index = getAnswerOrderIndex(answer.label)
    const family = getAnswerFamily(answer.label)

    familyCounts[family] += 1

    if (index < 0) {
      currentRun = 0
      previousIndex = null
      previousFamily = null
      return
    }

    currentRun =
      previousIndex === null || (family === previousFamily && index === previousIndex + 1)
        ? currentRun + 1
        : 1
    previousIndex = index
    previousFamily = family
    maxRun = Math.max(maxRun, currentRun)
  })

  const family = familyCounts.english >= familyCounts.hebrew ? 'english' : 'hebrew'

  return {
    family,
    maxSequentialRun: maxRun,
    isValidMultipleChoice: maxRun >= 2,
  }
}

function lineContainsQuestionMarker(line) {
  const normalizedLine = normalizeLine(line)
  return Boolean(getQuestionMarkerMatch(normalizedLine))
}

function answerContainsQuestionMarker(answer) {
  return isQuestionMarkerText(answer.text) || answer.text.split('\n').some((line) => lineContainsQuestionMarker(line))
}

function parseQuestionBlock(block, blockIndex) {
  const warnings = []
  const questionLines = []
  const answers = []
  let currentAnswer = null
  let firstAnswerId = null
  let sawFirstAnswer = false
  let stoppedAtQuestionMarker = false

  for (const line of block.lines) {
    if (lineContainsQuestionMarker(line)) {
      stoppedAtQuestionMarker = true
      warnings.push('זוהתה התחלה של שאלה אחרת בתוך הבלוק, ולכן הפענוח של השאלה נעצר.')
      break
    }

    const answerMatch = getAnswerMatch(line)

    if (!answerMatch) {
      if (sawFirstAnswer && currentAnswer) {
        currentAnswer.textLines.push(line)
      } else {
        questionLines.push(line)
      }
      continue
    }

    sawFirstAnswer = true
    firstAnswerId = pushCurrentAnswer(answers, currentAnswer, firstAnswerId)

    const answerId = `q-${block.number}-${blockIndex + 1}-answer-${answerMatch.normalizedLabel}`
    firstAnswerId ??= answerId
    currentAnswer = {
      id: answerId,
      label: answerMatch.normalizedLabel,
      textLines: answerMatch.text ? [answerMatch.text] : [],
    }
  }

  pushCurrentAnswer(answers, currentAnswer, firstAnswerId)

  answers.forEach((answer) => {
    if (answerContainsQuestionMarker(answer)) {
      answer.text = removeQuestionMarkerContamination(answer.text)
    }
  })

  const questionText = cleanDisplayText(questionLines.map(compactLine).filter(Boolean).join('\n'))
  const sequenceStats = getAnswerSequenceStats(answers)
  const answersWithQuestionMarker = answers.filter(answerContainsQuestionMarker)

  if (!questionText) {
    warnings.push('לא זוהה טקסט שאלה לפני התשובות.')
  }

  if (answers.length === 0) {
    warnings.push('לא זוהו תשובות לשאלה, לכן הביטחון נמוך.')
  }

  if (answers.length === 1) {
    warnings.push('זוהתה תשובה אחת בלבד, לכן הביטחון נמוך.')
  }

  if (answersWithQuestionMarker.length > 0) {
    warnings.push('ייתכן שהתשובה כוללת התחלה של שאלה אחרת')
  }

  const confidence =
    !questionText || answers.length <= 1
      ? 'low'
      : sequenceStats.maxSequentialRun >= 3
        ? 'high'
        : 'medium'

  return {
    id: `q-${block.number}-${blockIndex + 1}`,
    number: block.number,
    text: questionText,
    answers,
    confidence,
    warnings,
    debug: {
      startLineNumber: block.startLineNumber,
      markerType: block.markerType,
      confidenceScore: block.confidenceScore,
      sequentialAnswerRun: sequenceStats.maxSequentialRun,
      answerFamily: sequenceStats.family,
      answerCount: answers.length,
      stoppedAtQuestionMarker,
      answerTextsContainingQuestionMarker: answersWithQuestionMarker.length,
      containsHebrewQuestionText: answers.some((answer) => /שאלה\s+מספר/.test(answer.text)),
      containsEnglishQuestionText: answers.some((answer) => /Question/i.test(answer.text)),
      rawBlockPreview: block.lines.join('\n').slice(0, 300),
    },
  }
}

function parseBlocks(blocks) {
  return blocks
    .map(parseQuestionBlock)
    .filter((question) => question.text || question.answers.length > 0)
}

function hasValidAnswerSequenceForCandidate(lineItems, candidates, candidate) {
  const candidatePosition = candidates.findIndex((item) => item.lineIndex === candidate.lineIndex)
  const block = splitBlocksFromStarts(lineItems, [candidate, candidates[candidatePosition + 1]].filter(Boolean))[0]
  const parsedBlock = parseQuestionBlock(block, candidatePosition)

  return parsedBlock.debug.sequentialAnswerRun >= minimumSequentialAnswersForMultipleChoice
}

function chooseQuestionStarts(lineItems, questionStartCandidates) {
  const possibleStarts = questionStartCandidates.filter((candidate) => candidate.questionNumber)
  const highConfidenceExplicit = possibleStarts.filter(
    (candidate) =>
      explicitMarkerTypes.has(candidate.markerType) && candidate.confidenceScore >= 88,
  )
  const explicitFamily =
    highConfidenceExplicit.find((candidate) => candidate.markerType === 'explicit-hebrew') ??
    highConfidenceExplicit.find((candidate) => candidate.markerType === 'explicit-english')
  const startsWithValidation = possibleStarts.map((candidate) => {
    const isExplicit = explicitMarkerTypes.has(candidate.markerType)
    const hasAnswerSequence = hasValidAnswerSequenceForCandidate(lineItems, possibleStarts, candidate)

    return {
      ...candidate,
      accepted: isExplicit || hasAnswerSequence,
      reason: isExplicit
        ? 'accepted-explicit-marker'
        : hasAnswerSequence
          ? 'accepted-followed-by-answer-sequence'
          : 'rejected-not-followed-by-answer-sequence',
    }
  })

  if (highConfidenceExplicit.length >= 5) {
    return {
      parsingMode:
        explicitFamily?.markerType === 'explicit-english' ? 'explicit-english' : 'explicit-hebrew',
      acceptedStarts: startsWithValidation.filter((candidate) =>
        explicitMarkerTypes.has(candidate.markerType),
      ),
      candidates: startsWithValidation,
    }
  }

  const numericAccepted = startsWithValidation.filter(
    (candidate) => candidate.markerType.startsWith('numeric') && candidate.accepted,
  )

  if (numericAccepted.length > 0) {
    return {
      parsingMode: 'numeric',
      acceptedStarts: startsWithValidation.filter((candidate) => candidate.accepted),
      candidates: startsWithValidation,
    }
  }

  const explicitAccepted = startsWithValidation.filter(
    (candidate) => explicitMarkerTypes.has(candidate.markerType) && candidate.accepted,
  )

  if (explicitAccepted.length > 0) {
    return {
      parsingMode:
        explicitAccepted[0].markerType === 'explicit-english'
          ? 'explicit-english'
          : 'explicit-hebrew',
      acceptedStarts: explicitAccepted,
      candidates: startsWithValidation,
    }
  }

  return {
    parsingMode: 'answer-sequence-fallback',
    acceptedStarts: [],
    candidates: startsWithValidation,
  }
}

function buildFallbackBlocks(lineItems, answerStartCandidates) {
  const blocks = []
  let previousBlockEnd = 0
  let fallbackNumber = 1

  answerStartCandidates.forEach((answerCandidate, answerIndex) => {
    if (getAnswerOrderIndex(answerCandidate.normalizedLabel) !== 0) {
      return
    }

    const sequence = [answerCandidate]
    let expectedIndex = 1

    for (let index = answerIndex + 1; index < answerStartCandidates.length; index += 1) {
      const candidate = answerStartCandidates[index]

      if (candidate.lineIndex - answerCandidate.lineIndex > 20) {
        break
      }

      if (
        getAnswerFamily(candidate.normalizedLabel) === getAnswerFamily(answerCandidate.normalizedLabel) &&
        getAnswerOrderIndex(candidate.normalizedLabel) === expectedIndex
      ) {
        sequence.push(candidate)
        expectedIndex += 1
      }

      if (sequence.length >= 3) {
        break
      }
    }

    if (sequence.length < minimumSequentialAnswersForMultipleChoice) {
      return
    }

    const firstAnswerPosition = answerCandidate.cleanedIndex
    const nextQuestionStart = answerStartCandidates
      .slice(answerIndex + 1)
      .find((candidate) => getAnswerOrderIndex(candidate.normalizedLabel) === 0)
    const nextQuestionMarker = lineItems
      .slice(firstAnswerPosition + 1)
      .find((line) => lineContainsQuestionMarker(line.text))
    const blockEnd = Math.min(
      nextQuestionStart ? nextQuestionStart.cleanedIndex : lineItems.length,
      nextQuestionMarker ? nextQuestionMarker.cleanedIndex : lineItems.length,
    )
    const blockStart = Math.max(previousBlockEnd, Math.max(0, firstAnswerPosition - 8))
    const blockLines = lineItems.slice(blockStart, blockEnd).map((line) => line.text)

    blocks.push({
      number: fallbackNumber,
      startLineNumber: lineItems[blockStart]?.lineNumber ?? answerCandidate.lineNumber,
      markerType: 'answer-sequence-fallback',
      confidenceScore: 45,
      lines: blockLines,
    })

    previousBlockEnd = blockEnd
    fallbackNumber += 1
  })

  return blocks
}

function buildDiagnostics({
  rawText,
  cleanedLines,
  questionStartCandidates,
  acceptedQuestionStarts,
  answerStartCandidates,
  parsedQuestions,
  parsingMode,
}) {
  const lowConfidenceQuestions = parsedQuestions.filter((question) => question.confidence === 'low')
  const validQuestions = parsedQuestions.filter(
    (question) => question.debug?.sequentialAnswerRun >= minimumSequentialAnswersForMultipleChoice,
  )
  const questionsWithZeroAnswers = parsedQuestions.filter((question) => question.answers.length === 0)
  const questionsWithOneAnswer = parsedQuestions.filter((question) => question.answers.length === 1)
  const questionsWithTwoAnswers = parsedQuestions.filter((question) => question.answers.length === 2)
  const questionsWithThreeOrMoreAnswers = parsedQuestions.filter(
    (question) => question.answers.length >= 3,
  )
  const questionsWithFewerThanThreeAnswers = parsedQuestions.filter(
    (question) => question.answers.length < 3,
  )
  const questionsWithMoreThanSixAnswers = parsedQuestions.filter(
    (question) => question.answers.length > 6,
  )
  const numberCounts = parsedQuestions.reduce((counts, question) => {
    counts.set(question.number, (counts.get(question.number) ?? 0) + 1)
    return counts
  }, new Map())
  const duplicateQuestionNumbers = [...numberCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([number, count]) => ({ number, count }))
  const sortedQuestionNumbers = [...new Set(parsedQuestions.map((question) => question.number))]
    .filter((number) => Number.isInteger(number) && number > 0)
    .sort((first, second) => first - second)
  const missingQuestionNumbers = []

  if (sortedQuestionNumbers.length > 1) {
    for (
      let number = sortedQuestionNumbers[0];
      number <= sortedQuestionNumbers[sortedQuestionNumbers.length - 1];
      number += 1
    ) {
      if (!numberCounts.has(number)) {
        missingQuestionNumbers.push(number)
      }
    }
  }
  const questionDiagnostics = parsedQuestions.map((question) => {
    const hasEmptyQuestionText = question.text.trim().length === 0
    const hasEmptyAnswerText = question.answers.some((answer) => answer.text.trim().length === 0)
    const answerTextContainsQuestionMarker =
      (question.debug?.answerTextsContainingQuestionMarker ?? 0) > 0
    const warnings = [
      ...(question.warnings ?? []),
      ...(hasEmptyQuestionText ? ['טקסט השאלה ריק.'] : []),
      ...(hasEmptyAnswerText ? ['לפחות תשובה אחת ריקה.'] : []),
      ...(answerTextContainsQuestionMarker
        ? ['ייתכן שתשובה כוללת התחלה של שאלה אחרת.']
        : []),
    ]

    return {
      questionNumber: question.number,
      answerCount: question.answers.length,
      confidence: question.confidence,
      warnings,
      hasEmptyQuestionText,
      hasEmptyAnswerText,
      answerTextContainsHebrewQuestion: question.debug?.containsHebrewQuestionText ?? false,
      answerTextContainsEnglishQuestion: question.debug?.containsEnglishQuestionText ?? false,
      answerTextContainsQuestionMarker,
    }
  })
  const answersContainingQuestionMarkersCount = parsedQuestions.reduce(
    (total, question) => total + (question.debug?.answerTextsContainingQuestionMarker ?? 0),
    0,
  )
  const rejectedQuestionCandidates = questionStartCandidates.filter((candidate) => !candidate.accepted)
  const suspiciousQuestionBlocks = lowConfidenceQuestions.map((question) => ({
    questionNumber: question.number,
    answerCount: question.answers.length,
    startLineNumber: question.debug?.startLineNumber,
    preview: question.debug?.rawBlockPreview ?? question.text.slice(0, 300),
  }))
  const warnings = [
    ...(parsedQuestions.length === 0 ? ['לא זוהו שאלות.'] : []),
    ...(parsedQuestions.length > 0 && lowConfidenceQuestions.length / parsedQuestions.length > 0.3
      ? ['מספר גבוה של שאלות בביטחון נמוך.']
      : []),
    ...(questionsWithZeroAnswers.length > 0 ? ['יש שאלות ללא תשובות.'] : []),
    ...(questionsWithOneAnswer.length > 0 ? ['יש שאלות עם תשובה אחת בלבד.'] : []),
    ...(duplicateQuestionNumbers.length > 0 ? ['זוהו מספרי שאלות כפולים.'] : []),
    ...(missingQuestionNumbers.length > 0 ? ['ייתכן שחסרים מספרי שאלות ברצף.'] : []),
    ...(answersContainingQuestionMarkersCount > 0
      ? ['יש תשובות שמכילות התחלה אפשרית של שאלה אחרת.']
      : []),
  ]
  const diagnosticsReport = {
    rawTextLength: rawText.length,
    cleanedLinesCount: cleanedLines.length,
    questionStartCandidatesCount: questionStartCandidates.length,
    acceptedQuestionStartsCount: acceptedQuestionStarts.length,
    answerMarkerCandidatesCount: answerStartCandidates.length,
    totalQuestionsDetected: parsedQuestions.length,
    parsedQuestionsCount: parsedQuestions.length,
    validMultipleChoiceQuestions: validQuestions.length,
    validQuestionsCount: validQuestions.length,
    lowConfidenceQuestions: lowConfidenceQuestions.length,
    lowConfidenceQuestionsCount: lowConfidenceQuestions.length,
    questionsWithZeroAnswers: questionsWithZeroAnswers.map((question) => question.number),
    questionsWithOneAnswer: questionsWithOneAnswer.map((question) => question.number),
    questionsWithTwoAnswers: questionsWithTwoAnswers.map((question) => question.number),
    questionsWithThreeOrMoreAnswers: questionsWithThreeOrMoreAnswers.map(
      (question) => question.number,
    ),
    questionsWithFewerThanThreeAnswers: questionsWithFewerThanThreeAnswers.map((question) => ({
      number: question.number,
      answerCount: question.answers.length,
    })),
    questionsWithMoreThanSixAnswers: questionsWithMoreThanSixAnswers.map((question) => ({
      number: question.number,
      answerCount: question.answers.length,
    })),
    missingQuestionNumbers,
    duplicateQuestionNumbers,
    parsingMode,
    warnings,
    questionDiagnostics,
    unparsedOrLowConfidenceBlocks: suspiciousQuestionBlocks.map((block) => ({
      ...block,
      preview: block.preview.slice(0, 300),
    })),
  }

  return {
    rawTextLength: rawText.length,
    cleanedLinesCount: cleanedLines.length,
    questionStartCandidatesCount: questionStartCandidates.length,
    acceptedQuestionStartsCount: acceptedQuestionStarts.length,
    answerMarkerCandidatesCount: answerStartCandidates.length,
    detectedQuestionStartLinesCount: acceptedQuestionStarts.length,
    parsedQuestions: parsedQuestions.length,
    validQuestions: validQuestions.length,
    lowConfidenceQuestions: lowConfidenceQuestions.length,
    questionsWithZeroAnswers: questionsWithZeroAnswers.length,
    questionsWithOneAnswer: questionsWithOneAnswer.length,
    questionsWithTwoAnswers: questionsWithTwoAnswers.length,
    questionsWithThreeOrMoreAnswers: questionsWithThreeOrMoreAnswers.length,
    missingQuestionNumbers,
    duplicateQuestionNumbers,
    warnings,
    parsingMode,
    detectedQuestionNumbers: parsedQuestions.map((question) => question.number),
    firstQuestionNumbers: parsedQuestions.slice(0, 5).map((question) => question.number),
    rejectedQuestionCandidates,
    questionDiagnostics,
    answersContainingQuestionMarkersCount,
    suspiciousQuestionBlocks,
    diagnosticsReport,
  }
}

export function isQuestionStart(line, nextLine = '') {
  return Boolean(getQuestionCandidate({ lineIndex: 0, lineNumber: 1, text: line }, nextLine)?.questionNumber)
}

export function debugParser(rawText) {
  const normalizedText = normalizeText(rawText)
  const cleanedLines = normalizedText ? cleanLines(normalizedText) : []
  const questionStartCandidates = buildQuestionStartCandidates(cleanedLines)
  const answerStartCandidates = buildAnswerStartCandidates(cleanedLines)
  const modeResult = chooseQuestionStarts(cleanedLines, questionStartCandidates)
  const blocks =
    modeResult.acceptedStarts.length > 0
      ? splitBlocksFromStarts(cleanedLines, modeResult.acceptedStarts)
      : buildFallbackBlocks(cleanedLines, answerStartCandidates)
  const parsedQuestions = parseBlocks(blocks)
  const diagnostics = buildDiagnostics({
    rawText: normalizedText,
    cleanedLines,
    questionStartCandidates: modeResult.candidates,
    acceptedQuestionStarts: modeResult.acceptedStarts,
    answerStartCandidates,
    parsedQuestions,
    parsingMode: modeResult.parsingMode,
  })

  return {
    cleanedLines,
    firstCleanedLines: cleanedLines.slice(0, 80),
    questionStartCandidates: modeResult.candidates,
    acceptedQuestionStarts: modeResult.acceptedStarts,
    rejectedQuestionStarts: diagnostics.rejectedQuestionCandidates,
    possibleAnswerMarkerLines: answerStartCandidates,
    parsedQuestions,
    diagnostics,
  }
}

export function parseExamText(rawText, options = {}) {
  const result = debugParser(rawText)
  const answersWithQuestionMarkers = result.parsedQuestions.flatMap((question) =>
    question.answers
      .filter((answer) => isQuestionMarkerText(answer.text))
      .map((answer) => ({
        questionNumber: question.number,
        answerLabel: answer.label,
        text: answer.text.slice(0, 200),
      })),
  )

  console.log('answersWithQuestionMarkers', answersWithQuestionMarkers)

  if (isDevelopmentMode()) {
    console.log('Parser diagnostics summary:', result.diagnostics.diagnosticsReport)
    console.log('Accepted question starts:', result.acceptedQuestionStarts)
    console.log('Rejected question candidates:', result.rejectedQuestionStarts)
    console.log('Suspicious question blocks:', result.diagnostics.suspiciousQuestionBlocks)
  }

  if (options.debug) {
    console.log('First 120 cleaned parser lines:', result.cleanedLines.slice(0, 120))
    console.log('Question start candidates:', result.questionStartCandidates)
    console.log('Accepted question starts:', result.acceptedQuestionStarts)
    console.log('Answer marker candidates:', result.possibleAnswerMarkerLines)
  }

  return {
    questions: result.parsedQuestions,
    diagnostics: {
      ...result.diagnostics,
      firstCleanedLines: result.firstCleanedLines,
      questionStartCandidates: result.questionStartCandidates,
      acceptedQuestionStarts: result.acceptedQuestionStarts,
      rejectedQuestionStarts: result.rejectedQuestionStarts,
      possibleAnswerMarkerLines: result.possibleAnswerMarkerLines,
    },
  }
}

export function parseQuestions(rawText, options = {}) {
  return parseExamText(rawText, options).questions
}

if (typeof window !== 'undefined') {
  window.__debugParser = debugParser
}
