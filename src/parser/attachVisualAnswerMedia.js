const visualAnswerWarning = 'ייתכן שהתשובה מופיעה כתמונה/קוד/טבלה/נוסחה שלא חולצו כטקסט'
const noUsefulCropWarning = 'לא נמצא חיתוך חזותי שימושי לתשובה זו'
const cropLimitedToContentWarning = 'לא נמצא סימון תשובה הבא, החיתוך הוגבל לאזור התוכן'
const questionVisualWarning = 'ייתכן שנוסח השאלה כולל תוכן חזותי שלא חולץ כטקסט'
export const ENABLE_VISUAL_MEDIA = true
export const ENABLE_QUESTION_TEXT_CROP = false
export const ENABLE_ANSWER_CROP = true
export const ENABLE_OPTIONS_FALLBACK_CROP = false

const footerTextPattern =
  /Faculty of Sciences|Holon Institute of Technology|www\.hit\.ac\.il|hit\.ac\.il|phone|fax|tel|address|faculty|institute|פקולטה|מכון טכנולוגי חולון|טלפון|פקס|כתובת/u
const headerTextPattern =
  /HIT|Holon Institute|Faculty of Sciences|מכון טכנולוגי חולון|פקולטה/u
const questionVisualHintPattern =
  /תרשים|דיאגרמה|איור|תמונה|טבלה|נוסחה|גרף|ERD|diagram|image|figure|table|formula|graph/iu

function normalizeLabel(label) {
  return /^[a-z]$/i.test(label) ? label.toUpperCase() : label
}

function isDevelopmentMode() {
  return import.meta.env?.DEV ?? false
}

function getAnswerMarker(lineText) {
  const text = lineText.trim()
  const startMatch = text.match(/^(?:\(([A-Za-zא-ת])\)|\.\s*([A-Za-zא-ת])|([A-Za-zא-ת])\s*[.)-]|([A-Za-zא-ת])(?=\s*$))(?:\s|$)/u)
  const endMatch = text.match(/\s(?:[.)-]\s*([A-Za-zא-ת])|\(([A-Za-zא-ת])\))\s*$/u)
  const label =
    startMatch?.[1] ??
    startMatch?.[2] ??
    startMatch?.[3] ??
    startMatch?.[4] ??
    endMatch?.[1] ??
    endMatch?.[2]

  return label ? normalizeLabel(label) : null
}

function getQuestionNumber(lineText) {
  const text = lineText.trim()
  const match =
    text.match(/^שאלה\s+(?:מספר\s*)?:?\s*(\d{1,3})/u) ??
    text.match(/^Question\s+(\d{1,3})/iu) ??
    text.match(/^Q\.?\s*(\d{1,3})/iu) ??
    text.match(/^\.?\s*(\d{1,3})\s*[.)]/u) ??
    text.match(/^\(\s*(\d{1,3})\s*\)/u)

  return match ? Number(match[1]) : null
}

function getTextQuality(text) {
  const cleanText = text.trim()
  const words = cleanText.split(/\s+/u).filter(Boolean)

  return {
    length: cleanText.length,
    wordCount: words.length,
    isEmpty: cleanText.length === 0,
    isVeryShort: cleanText.length > 0 && cleanText.length <= 2,
    isShort: cleanText.length > 2 && cleanText.length < 18,
    isReadable: cleanText.length >= 24 && words.length >= 3,
  }
}

function hasVisualWarning(warnings = []) {
  return warnings.some(
    (warning) =>
      warning.includes('תמונה/קוד/טבלה/נוסחה') ||
      warning.includes('חזותי') ||
      questionVisualHintPattern.test(warning),
  )
}

function getAnswerMediaDecision(answer) {
  const quality = getTextQuality(answer.text)

  if (answer.media) {
    return { shouldAttempt: false, reason: 'already-has-media', quality }
  }

  if (quality.isEmpty) {
    return { shouldAttempt: true, reason: 'answer-text-empty', quality }
  }

  return { shouldAttempt: false, reason: 'answer-text-present', quality }
}

function isVisualSignalStrong(debug) {
  return (
    debug.blankPercentage < 0.99 &&
    debug.nonBackgroundPixels >= 140 &&
    debug.edgePixels >= 18 &&
    debug.refinedBbox?.height >= 18
  )
}

function isVisualSignalVeryStrong(debug) {
  return (
    debug.blankPercentage < 0.985 &&
    debug.nonBackgroundPixels >= 360 &&
    debug.edgePixels >= 35 &&
    debug.refinedBbox?.height >= 36
  )
}

function getQuestionTextMediaDecision(question) {
  const quality = getTextQuality(question.text)
  const warningText = (question.warnings ?? []).join(' ')
  const warning = hasVisualWarning(question.warnings)
  const hasHint = questionVisualHintPattern.test(question.text) || questionVisualHintPattern.test(warningText)

  if (question.media?.some((media) => media.role === 'question-text-crop')) {
    return { shouldAttempt: false, reason: 'already-has-media', quality, hasHint }
  }

  if (quality.isEmpty) {
    return { shouldAttempt: true, reason: 'question-text-empty', quality, hasHint }
  }

  if (quality.length < 18) {
    return { shouldAttempt: true, reason: 'question-text-too-short', quality, hasHint }
  }

  if (warning) {
    return { shouldAttempt: true, reason: 'question-has-visual-warning', quality, hasHint }
  }

  if (hasHint) {
    return { shouldAttempt: true, reason: 'question-has-visual-hint', quality, hasHint }
  }

  return { shouldAttempt: false, reason: 'text-already-sufficient', quality, hasHint }
}

function shouldKeepQuestionTextCrop(question, debug, decision) {
  if (!isVisualSignalStrong(debug)) {
    return {
      keep: false,
      reason: 'weak visual content signal',
    }
  }

  if (decision.quality.isReadable && !decision.hasHint && !hasVisualWarning(question.warnings)) {
    return {
      keep: false,
      reason: 'text already sufficient',
    }
  }

  if (decision.quality.isReadable && decision.hasHint && !isVisualSignalVeryStrong(debug)) {
    return {
      keep: false,
      reason: 'redundant with extracted text',
    }
  }

  return { keep: true, reason: 'useful question visual content' }
}

function shouldKeepAnswerCrop(answer, debug, decision) {
  if (decision.reason === 'answer-text-empty') {
    return { keep: true, reason: 'empty answer uses visual crop' }
  }

  if (!isVisualSignalStrong(debug)) {
    return {
      keep: false,
      reason: 'weak visual content signal',
    }
  }

  if (decision.quality.isReadable && !hasVisualWarning(answer.warnings)) {
    return {
      keep: false,
      reason: 'text already sufficient',
    }
  }

  return { keep: true, reason: 'useful answer visual content' }
}

function isFooterLine(line) {
  const text = line.text?.trim() ?? ''
  const isInFooterArea = line.y > line.pageHeight * 0.65
  const isContactOrUrl = /www\.|@|טלפון|פקס|phone|fax|tel|\d{2,}[-\s]\d/iu.test(text)

  return (isInFooterArea && footerTextPattern.test(text)) || (line.y > line.pageHeight * 0.78 && isContactOrUrl)
}

function isHeaderLine(line) {
  const text = line.text?.trim() ?? ''

  return line.y < line.pageHeight * 0.16 && headerTextPattern.test(text)
}

function clampNumber(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value))
}

function buildPageContentBounds(pdfPages) {
  return new Map(
    pdfPages.map((page) => {
      const pageLines = (page.lines ?? []).map((line) => ({
        ...line,
        pageHeight: page.height,
      }))
      const footerLines = pageLines.filter(isFooterLine)
      const headerLines = pageLines.filter(isHeaderLine)
      const detectedHeaderBottom =
        headerLines.length > 0
          ? Math.max(...headerLines.map((line) => line.y + line.height))
          : null
      const detectedFooterTop =
        footerLines.length > 0 ? Math.min(...footerLines.map((line) => line.y)) : null
      const contentLines = pageLines.filter((line) => !isFooterLine(line) && !isHeaderLine(line))
      const xValues = contentLines.flatMap((line) => [line.x, line.x + line.width]).filter(Number.isFinite)
      const inferredLeft = xValues.length > 0 ? Math.min(...xValues) : page.width * 0.05
      const inferredRight = xValues.length > 0 ? Math.max(...xValues) : page.width * 0.95
      const contentTop = clampNumber(
        detectedHeaderBottom ? detectedHeaderBottom + 12 : page.height * 0.045,
        24,
        page.height * 0.18,
      )
      const contentBottom = clampNumber(
        detectedFooterTop ? detectedFooterTop - 12 : page.height * 0.9,
        contentTop + 120,
        page.height * 0.92,
      )
      const contentLeft = clampNumber(
        Math.min(page.width * 0.04, inferredLeft - 80),
        10,
        page.width * 0.08,
      )
      const contentRight = clampNumber(
        Math.max(page.width * 0.96, inferredRight + 80),
        page.width * 0.92,
        page.width - 10,
      )

      return [
        page.pageNumber,
        {
          contentLeft,
          contentRight,
          contentTop,
          contentBottom,
          footerTop: detectedFooterTop,
          footerLines: footerLines.map((line) => ({
            text: line.text,
            y: line.y,
          })),
        },
      ]
    }),
  )
}

function buildMarkers(pdfPages) {
  const pageBounds = buildPageContentBounds(pdfPages)

  return pdfPages
    .flatMap((page) =>
      page.lines.map((line) => {
        const bounds = pageBounds.get(page.pageNumber)

        return {
          ...line,
          pageImage: page.image,
          pageWidth: page.width,
          pageHeight: page.height,
          contentLeft: bounds?.contentLeft ?? page.width * 0.04,
          contentRight: bounds?.contentRight ?? page.width * 0.96,
          contentTop: bounds?.contentTop ?? page.height * 0.045,
          contentBottom: bounds?.contentBottom ?? page.height * 0.9,
          footerTop: bounds?.footerTop ?? null,
          footerLines: bounds?.footerLines ?? [],
          answerLabel: getAnswerMarker(line.text),
          questionNumber: getQuestionNumber(line.text),
        }
      }),
    )
    .filter((line) => line.answerLabel || line.questionNumber)
    .sort((first, second) =>
      first.pageNumber === second.pageNumber
        ? first.y - second.y
        : first.pageNumber - second.pageNumber,
    )
}

function getQuestionScope(markers, question, cursor) {
  const questionMarkerIndex = markers.findIndex(
    (marker, index) => index >= cursor && marker.questionNumber === question.number,
  )

  if (questionMarkerIndex < 0) {
    return {
      startIndex: cursor,
      endIndex: markers.length,
    }
  }

  const nextQuestionIndex = markers.findIndex(
    (marker, index) => index > questionMarkerIndex && marker.questionNumber,
  )

  return {
    startIndex: questionMarkerIndex,
    endIndex: nextQuestionIndex > questionMarkerIndex ? nextQuestionIndex : markers.length,
  }
}

function findAnswerMarker(markers, answer, scope, afterIndex) {
  const normalizedLabel = normalizeLabel(answer.label)

  for (let index = Math.max(scope.startIndex, afterIndex); index < scope.endIndex; index += 1) {
    if (markers[index].answerLabel === normalizedLabel) {
      return { marker: markers[index], index }
    }
  }

  return null
}

function getAnswerMarkersInScope(markers, scope) {
  return markers
    .slice(scope.startIndex, scope.endIndex)
    .map((marker, offset) => ({ marker, index: scope.startIndex + offset }))
    .filter((entry) => entry.marker.answerLabel)
}

function getQuestionMarkerInScope(markers, scope) {
  return markers[scope.startIndex]?.questionNumber ? markers[scope.startIndex] : null
}

function getCropBottom(markers, markerIndex, scope, marker) {
  const minimumBottom = marker.y + marker.height + 8
  const contentBottom = marker.contentBottom ?? marker.pageHeight * 0.9

  if (scope.fallbackBottom) {
    return {
      value: clampNumber(scope.fallbackBottom, minimumBottom, contentBottom),
      reason: 'question-level-fallback-boundary',
      limitedToContentBottom: scope.fallbackBottom > contentBottom,
    }
  }

  const nextBoundary = markers
    .slice(markerIndex + 1, Math.min(markers.length, scope.endIndex + 1))
    .find((candidate) => candidate.pageNumber === marker.pageNumber)

  if (nextBoundary) {
    const boundaryValue = Math.max(minimumBottom, nextBoundary.y - 6)

    return {
      value: clampNumber(boundaryValue, minimumBottom, contentBottom),
      reason: nextBoundary.answerLabel ? 'next-answer-marker' : 'next-question-marker',
      limitedToContentBottom: boundaryValue > contentBottom,
    }
  }

  return {
    value: contentBottom,
    reason: 'content-bottom-fallback',
    limitedToContentBottom: true,
  }
}

function getPixelStats(canvas) {
  const context = canvas.getContext('2d')
  const { width, height } = canvas
  const pixels = context.getImageData(0, 0, width, height).data
  const background = sampleBackgroundColor(pixels, width, height)
  let darkPixels = 0
  let nonBackgroundPixels = 0
  let edgePixels = 0
  let minX = width
  let minY = height
  let maxX = 0
  let maxY = 0

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4
      const alpha = pixels[index + 3]
      const red = pixels[index]
      const green = pixels[index + 1]
      const blue = pixels[index + 2]
      const backgroundDistance = getColorDistance([red, green, blue], background)
      const isDark = red < 242 || green < 242 || blue < 242
      const isMeaningful = alpha > 20 && (isDark || backgroundDistance > 28)

      if (!isMeaningful) {
        continue
      }

      darkPixels += 1
      if (backgroundDistance > 28) {
        nonBackgroundPixels += 1
      }
      if (x > 0 && y > 0) {
        const leftIndex = (y * width + x - 1) * 4
        const topIndex = ((y - 1) * width + x) * 4
        const leftDelta = Math.abs(red - pixels[leftIndex]) + Math.abs(green - pixels[leftIndex + 1]) + Math.abs(blue - pixels[leftIndex + 2])
        const topDelta = Math.abs(red - pixels[topIndex]) + Math.abs(green - pixels[topIndex + 1]) + Math.abs(blue - pixels[topIndex + 2])

        if (leftDelta + topDelta > 90) {
          edgePixels += 1
        }
      }
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
  }

  const totalPixels = width * height
  const darkRatio = totalPixels > 0 ? darkPixels / totalPixels : 0

  return {
    darkPixels,
    nonBackgroundPixels,
    edgePixels,
    darkRatio,
    edgeRatio: totalPixels > 0 ? edgePixels / totalPixels : 0,
    blankPercentage: 1 - darkRatio,
    background,
    bbox:
      darkPixels > 0
        ? {
            x: minX,
            y: minY,
            width: maxX - minX + 1,
            height: maxY - minY + 1,
          }
        : null,
  }
}

function sampleBackgroundColor(pixels, width, height) {
  const points = [
    [0, 0],
    [Math.max(0, width - 1), 0],
    [0, Math.max(0, height - 1)],
    [Math.max(0, width - 1), Math.max(0, height - 1)],
  ]
  const colors = points.map(([x, y]) => {
    const index = (y * width + x) * 4

    return [pixels[index], pixels[index + 1], pixels[index + 2]]
  })

  return colors
    .reduce((total, color) => total.map((value, index) => value + color[index]), [0, 0, 0])
    .map((value) => value / colors.length)
}

function getColorDistance(first, second) {
  return Math.abs(first[0] - second[0]) + Math.abs(first[1] - second[1]) + Math.abs(first[2] - second[2])
}

function cropCanvas(sourceCanvas, bbox, padding = {}) {
  const leftPadding = padding.left ?? padding.x ?? 16
  const rightPadding = padding.right ?? padding.x ?? 16
  const topPadding = padding.top ?? padding.y ?? 10
  const bottomPadding = padding.bottom ?? padding.y ?? 10
  const cropX = Math.max(0, bbox.x - leftPadding)
  const cropY = Math.max(0, bbox.y - topPadding)
  const cropRight = Math.min(sourceCanvas.width, bbox.x + bbox.width + rightPadding)
  const cropBottom = Math.min(sourceCanvas.height, bbox.y + bbox.height + bottomPadding)
  const cropWidth = cropRight - cropX
  const cropHeight = cropBottom - cropY
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  canvas.width = cropWidth
  canvas.height = cropHeight
  context.drawImage(sourceCanvas, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight)

  return {
    canvas,
    offsetX: cropX,
    offsetY: cropY,
  }
}

function validateCrop(stats, canvas) {
  if (canvas.width < 80 || canvas.height < 22) {
    return 'crop-too-small'
  }

  if (!stats.bbox) {
    return 'blank-crop'
  }

  if (stats.blankPercentage > 0.995 || stats.darkPixels < 90) {
    return 'mostly-blank-crop'
  }

  if (stats.bbox.width < 35 || stats.bbox.height < 12) {
    return 'no-meaningful-content'
  }

  return ''
}

function cropPageImage(marker, markerIndex, scope, markers, options = {}) {
  return new Promise((resolve, reject) => {
    const image = new Image()

    image.onload = () => {
      const scale = marker.pageImage.scale ?? 1
      const verticalPadding = 8
      const contentTop = marker.contentTop ?? 36
      const contentBottom = marker.contentBottom ?? marker.pageHeight * 0.9
      const contentLeft = marker.contentLeft ?? marker.pageWidth * 0.04
      const contentRight = marker.contentRight ?? marker.pageWidth * 0.96
      const cropTop = Math.max(contentTop, options.top ?? marker.y - verticalPadding)
      const cropBoundary = getCropBottom(markers, markerIndex, scope, marker)
      const cropBottom = Math.min(options.bottom ?? cropBoundary.value, contentBottom)
      const cropLeft = Math.max(0, contentLeft - 12)
      const cropRight = Math.min(marker.pageWidth, contentRight + 12)
      const cropWidth = cropRight - cropLeft
      const cropHeight = cropBottom - cropTop
      const rawCanvas = document.createElement('canvas')
      const rawContext = rawCanvas.getContext('2d')
      const initialBbox = {
        x: cropLeft,
        y: cropTop,
        width: cropWidth,
        height: cropHeight,
      }

      if (cropHeight < 18 || cropWidth < 80) {
        reject(new Error('crop-region-too-small'))
        return
      }

      if (marker.footerTop && cropBottom > marker.footerTop - 8) {
        reject(
          Object.assign(new Error('footer-boundary-overlap'), {
            debug: {
              cropTop,
              cropBottom,
              cropHeight,
              footerTop: marker.footerTop,
            },
          }),
        )
        return
      }

      rawCanvas.width = Math.round(cropWidth * scale)
      rawCanvas.height = Math.round(cropHeight * scale)
      rawContext.drawImage(
        image,
        Math.round(cropLeft * scale),
        Math.round(cropTop * scale),
        rawCanvas.width,
        rawCanvas.height,
        0,
        0,
        rawCanvas.width,
        rawCanvas.height,
      )

      const rawStats = getPixelStats(rawCanvas)
      const rejectionReason = validateCrop(rawStats, rawCanvas)

      if (rejectionReason) {
        reject(
          Object.assign(new Error(rejectionReason), {
            debug: {
              cropTop,
              cropBottom,
              cropHeight,
              blankPercentage: rawStats.blankPercentage,
              cropBoundaryReason: cropBoundary.reason,
              limitedToContentBottom: cropBoundary.limitedToContentBottom,
            },
          }),
        )
        return
      }

      const trimmed = cropCanvas(rawCanvas, rawStats.bbox, {
        left: Math.round(42 * scale),
        right: Math.round(24 * scale),
        top: Math.round(12 * scale),
        bottom: Math.round(12 * scale),
      })
      const trimmedStats = getPixelStats(trimmed.canvas)
      const trimmedRejectionReason = validateCrop(trimmedStats, trimmed.canvas)

      if (trimmedRejectionReason) {
        reject(
          Object.assign(new Error(trimmedRejectionReason), {
            debug: {
              cropTop,
              cropBottom,
              cropHeight,
              blankPercentage: trimmedStats.blankPercentage,
              cropBoundaryReason: cropBoundary.reason,
              limitedToContentBottom: cropBoundary.limitedToContentBottom,
            },
          }),
        )
        return
      }

      resolve({
        media: {
          type: 'image',
          role: options.role ?? 'answer-crop',
          dataUrl: trimmed.canvas.toDataURL('image/png'),
          sourcePageNumber: marker.pageNumber,
          cropSource: options.cropSource ?? 'marker-to-marker',
          bbox: {
            x: cropLeft + trimmed.offsetX / scale,
            y: cropTop + trimmed.offsetY / scale,
            width: trimmed.canvas.width / scale,
            height: trimmed.canvas.height / scale,
          },
        },
        debug: {
          markerX: marker.x,
          markerY: marker.y,
          initialBbox,
          refinedBbox: {
            x: cropLeft + trimmed.offsetX / scale,
            y: cropTop + trimmed.offsetY / scale,
            width: trimmed.canvas.width / scale,
            height: trimmed.canvas.height / scale,
          },
          cropTop,
          cropBottom,
          cropHeight,
          cropWidth,
          blankPercentage: trimmedStats.blankPercentage,
          edgePixels: trimmedStats.edgePixels,
          edgeRatio: trimmedStats.edgeRatio,
          nonBackgroundPixels: trimmedStats.nonBackgroundPixels,
          refinedByImageAnalysis: true,
          widenedForLeftCutoffProtection: true,
          cropBoundaryReason: cropBoundary.reason,
          limitedToContentBottom: cropBoundary.limitedToContentBottom,
          boundaryWarning:
            cropBoundary.reason === 'content-bottom-fallback' ? cropLimitedToContentWarning : '',
        },
      })
    }

    image.onerror = () => reject(new Error('page-image-load-failed'))
    image.src = marker.pageImage.dataUrl
  })
}

function findQuestionFallbackBounds(markers, scope) {
  const answerMarkers = getAnswerMarkersInScope(markers, scope)

  if (answerMarkers.length === 0) {
    return null
  }

  const firstAnswer = answerMarkers[0].marker
  const samePageMarkers = markers.slice(scope.startIndex, Math.min(markers.length, scope.endIndex + 1)).filter(
    (marker) => marker.pageNumber === firstAnswer.pageNumber,
  )
  const nextQuestion = samePageMarkers.find(
    (marker) => marker.questionNumber && marker.y > firstAnswer.y,
  )
  const bottom = nextQuestion
    ? Math.max(firstAnswer.y + firstAnswer.height + 40, nextQuestion.y - 8)
    : firstAnswer.contentBottom

  return {
    marker: firstAnswer,
    top: Math.max(firstAnswer.contentTop ?? 36, firstAnswer.y - 12),
    bottom: Math.min(bottom, firstAnswer.contentBottom ?? firstAnswer.pageHeight * 0.9),
  }
}

function cropQuestionFallback(scope, markers) {
  const bounds = findQuestionFallbackBounds(markers, scope)

  if (!bounds) {
    return Promise.reject(new Error('question-fallback-no-answer-markers'))
  }

  const fallbackMarker = {
    ...bounds.marker,
    y: bounds.top,
    height: Math.max(1, bounds.bottom - bounds.top),
  }
  const fallbackScope = {
    ...scope,
    fallbackBottom: bounds.bottom,
  }

  return cropPageImage(fallbackMarker, scope.startIndex, fallbackScope, [
    ...markers,
    {
      ...bounds.marker,
      pageNumber: bounds.marker.pageNumber,
      y: bounds.bottom,
      height: 1,
      questionNumber: Number.MAX_SAFE_INTEGER,
    },
  ]).then(({ media, debug }) => ({
    media: {
      ...media,
      role: 'question-options-crop',
      cropSource: 'question-level-fallback',
    },
    debug,
  }))
}

function cropQuestionText(question, scope, markers) {
  const questionMarker = getQuestionMarkerInScope(markers, scope)

  if (!questionMarker) {
    return Promise.reject(new Error('question-text-no-question-marker'))
  }

  const firstAnswer = getAnswerMarkersInScope(markers, scope).find(
    (entry) => entry.marker.pageNumber === questionMarker.pageNumber && entry.marker.y > questionMarker.y,
  )
  const nextQuestion = markers
    .slice(scope.startIndex + 1, Math.min(markers.length, scope.endIndex + 1))
    .find((marker) => marker.questionNumber && marker.pageNumber === questionMarker.pageNumber)
  const bottom = firstAnswer
    ? firstAnswer.marker.y - 8
    : nextQuestion
      ? nextQuestion.y - 8
      : questionMarker.contentBottom
  const top = Math.max(questionMarker.contentTop ?? 36, questionMarker.y - 10)

  if (bottom - top < 24) {
    return Promise.reject(new Error('question-text-crop-region-too-small'))
  }

  return cropPageImage(questionMarker, scope.startIndex, scope, markers, {
    role: 'question-text-crop',
    cropSource: 'question-marker-to-first-answer',
    top,
    bottom,
  }).then(({ media, debug }) => ({
    media,
    debug,
    warning: questionVisualWarning,
    questionNumber: question.number,
  }))
}

function addRejectedWarning(answer) {
  return answer
}

function incrementReason(reasons, reason) {
  reasons[reason] = (reasons[reason] ?? 0) + 1
}

export async function attachVisualAnswerMedia(questions, pdfPages) {
  if (!ENABLE_VISUAL_MEDIA || !pdfPages?.length) {
    return {
      questions,
      diagnostics: {
        visualMediaEnabled: ENABLE_VISUAL_MEDIA,
        questionTextCropEnabled: ENABLE_QUESTION_TEXT_CROP,
        answerCropEnabled: ENABLE_ANSWER_CROP,
        optionsFallbackCropEnabled: ENABLE_OPTIONS_FALLBACK_CROP,
        answersWithAttachedVisualCrops: 0,
        answersNeedingVisualCrop: 0,
        answersWithRejectedVisualCrops: 0,
        answersWithEmptyTextAndNoCrop: 0,
        blankCropsRejected: 0,
        cropsClampedToContentBottom: 0,
        footerBoundaryRejected: 0,
        questionsWithQuestionTextCrops: [],
        questionTextCropRejected: 0,
        questionTextCropConsidered: 0,
        answerCropConsidered: 0,
        answerCropRejectedByDecision: 0,
        visualMediaRejectedReasons: {},
        cropsRefinedByImageAnalysis: 0,
        cropsWidenedForLeftCutoffProtection: 0,
        questionsWithVisualAnswers: [],
        questionsUsingQuestionLevelFallback: [],
        questionsWithShuffleDisabledBecauseOfFallback: [],
        cropFailures: [],
      },
    }
  }

  const markers = buildMarkers(pdfPages)
  const cropFailures = []
  const questionsWithVisualAnswers = new Set()
  const questionsWithFallbackMedia = new Set()
  const questionsWithQuestionTextCrops = new Set()
  const questionsWithShuffleDisabled = new Set()
  let cursor = 0
  let attachedCount = 0
  let rejectedCount = 0
  let answersNeedingVisualCrop = 0
  let blankRejectedCount = 0
  let cropsClampedToContentBottom = 0
  let footerBoundaryRejected = 0
  let questionTextCropRejected = 0
  let questionTextCropConsidered = 0
  let answerCropConsidered = 0
  let answerCropRejectedByDecision = 0
  let cropsRefinedByImageAnalysis = 0
  let cropsWidenedForLeftCutoffProtection = 0
  let emptyTextNoCropCount = 0
  const visualMediaRejectedReasons = {}
  const nextQuestions = []

  for (const question of questions) {
    const scope = getQuestionScope(markers, question, cursor)
    const nextAnswers = []
    let answerCursor = scope.startIndex
    let neededInQuestion = 0
    let attachedInQuestion = 0
    let rejectedInQuestion = 0
    let questionMedia = question.media
    let questionWarnings = question.warnings

    const questionTextDecision = getQuestionTextMediaDecision(question)

    if (!questionTextDecision.shouldAttempt) {
      incrementReason(visualMediaRejectedReasons, questionTextDecision.reason)
    }

    if (ENABLE_QUESTION_TEXT_CROP && questionTextDecision.shouldAttempt) {
      questionTextCropConsidered += 1
      try {
        const { media, debug, warning } = await cropQuestionText(question, scope, markers)
        const keepDecision = shouldKeepQuestionTextCrop(question, debug, questionTextDecision)

        if (!keepDecision.keep) {
          questionTextCropRejected += 1
          incrementReason(visualMediaRejectedReasons, keepDecision.reason)
          cropFailures.push({
            questionNumber: question.number,
            answerLabel: '?',
            reason: `question-text-${keepDecision.reason}`,
            debug,
          })

          if (isDevelopmentMode()) {
            console.log('visual-question-text-crop rejected', {
              questionNumber: question.number,
              reason: keepDecision.reason,
              decision: questionTextDecision.reason,
              ...debug,
            })
          }
        } else {
        questionMedia = [...(questionMedia ?? []), media]
        questionWarnings = [...new Set([...(questionWarnings ?? []), warning])]
        questionsWithQuestionTextCrops.add(question.number)
        cropsRefinedByImageAnalysis += debug.refinedByImageAnalysis ? 1 : 0
        cropsWidenedForLeftCutoffProtection += debug.widenedForLeftCutoffProtection ? 1 : 0

        if (isDevelopmentMode()) {
          console.log('visual-question-text-crop accepted', {
            questionNumber: question.number,
            cropRole: media.role,
            pageNumber: media.sourcePageNumber,
            warning,
            ...debug,
          })
        }
        }
      } catch (error) {
        questionTextCropRejected += 1
        incrementReason(visualMediaRejectedReasons, error.message)
        cropFailures.push({
          questionNumber: question.number,
          answerLabel: '?',
          reason: `question-text-${error.message}`,
          debug: error.debug,
        })

        if (isDevelopmentMode()) {
          console.log('visual-question-text-crop rejected', {
            questionNumber: question.number,
            reason: error.message,
            ...error.debug,
          })
        }
      }
    }

    for (const answer of question.answers) {
      const answerDecision = getAnswerMediaDecision(answer)

      if (!ENABLE_ANSWER_CROP || !answerDecision.shouldAttempt) {
        incrementReason(visualMediaRejectedReasons, answerDecision.reason)
        nextAnswers.push(answer)
        continue
      }

      answerCropConsidered += 1
      answersNeedingVisualCrop += 1
      neededInQuestion += 1
      const markerResult = findAnswerMarker(markers, answer, scope, answerCursor)

      if (!markerResult) {
        if (answer.text.trim().length === 0) emptyTextNoCropCount += 1
        cropFailures.push({
          questionNumber: question.number,
          answerLabel: answer.label,
          reason: 'answer-marker-not-found-in-question-scope',
        })
        rejectedCount += 1
        rejectedInQuestion += 1
        incrementReason(visualMediaRejectedReasons, 'answer-marker-not-found-in-question-scope')
        nextAnswers.push(addRejectedWarning(answer))
        continue
      }

      try {
        const { media, debug } = await cropPageImage(markerResult.marker, markerResult.index, scope, markers)
        const keepDecision = shouldKeepAnswerCrop(answer, debug, answerDecision)
        answerCursor = markerResult.index + 1
        cursor = Math.max(cursor, scope.startIndex)

        if (!keepDecision.keep) {
          rejectedCount += 1
          rejectedInQuestion += 1
          answerCropRejectedByDecision += 1
          incrementReason(visualMediaRejectedReasons, keepDecision.reason)
          cropFailures.push({
            questionNumber: question.number,
            answerLabel: answer.label,
            reason: keepDecision.reason,
            debug,
          })
          nextAnswers.push(answer)

          if (isDevelopmentMode()) {
            console.log('visual-answer-crop rejected', {
              questionNumber: question.number,
              answerLabel: answer.label,
              cropRole: 'answer-crop',
              reason: keepDecision.reason,
              decision: answerDecision.reason,
              ...debug,
            })
          }

          continue
        }

        attachedCount += 1
        attachedInQuestion += 1
        if (debug.limitedToContentBottom) {
          cropsClampedToContentBottom += 1
        }
        cropsRefinedByImageAnalysis += debug.refinedByImageAnalysis ? 1 : 0
        cropsWidenedForLeftCutoffProtection += debug.widenedForLeftCutoffProtection ? 1 : 0
        questionsWithVisualAnswers.add(question.number)
        nextAnswers.push({
          ...answer,
          media,
          warnings: [...new Set([...(answer.warnings ?? []), visualAnswerWarning, debug.boundaryWarning].filter(Boolean))],
        })

        if (isDevelopmentMode()) {
          console.log('visual-answer-crop accepted', {
            questionNumber: question.number,
            answerLabel: answer.label,
            cropRole: media.role,
            pageNumber: media.sourcePageNumber,
            ...debug,
          })
        }
      } catch (error) {
        if (answer.text.trim().length === 0) emptyTextNoCropCount += 1
        rejectedCount += 1
        rejectedInQuestion += 1
        if (['blank-crop', 'mostly-blank-crop', 'no-meaningful-content'].includes(error.message)) {
          blankRejectedCount += 1
        }
        if (error.message === 'footer-boundary-overlap') {
          footerBoundaryRejected += 1
        }
        if (error.debug?.limitedToContentBottom) {
          cropsClampedToContentBottom += 1
        }
        incrementReason(visualMediaRejectedReasons, error.message)
        cropFailures.push({
          questionNumber: question.number,
          answerLabel: answer.label,
          reason: error.message,
          debug: error.debug,
        })
        nextAnswers.push(addRejectedWarning(answer))

        if (isDevelopmentMode()) {
          console.log('visual-answer-crop rejected', {
            questionNumber: question.number,
            answerLabel: answer.label,
            cropRole: 'answer-crop',
            reason: error.message,
            ...error.debug,
          })
        }
      }
    }

    const mostlyWeakAnswers = question.answers.filter((answer) => {
      const decision = getAnswerMediaDecision(answer)
      return decision.reason === 'answer-text-empty' || decision.reason === 'answer-text-too-short'
    }).length >= Math.ceil(question.answers.length / 2)
    const hasAtLeastTwoAnswerMarkers = getAnswerMarkersInScope(markers, scope).length >= 2

    if (
      ENABLE_OPTIONS_FALLBACK_CROP &&
      hasAtLeastTwoAnswerMarkers &&
      neededInQuestion > 0 &&
      attachedInQuestion === 0 &&
      mostlyWeakAnswers &&
      rejectedInQuestion >= Math.ceil(neededInQuestion / 2)
    ) {
      try {
        const { media, debug } = await cropQuestionFallback(scope, markers)
        questionMedia = [...(questionMedia ?? []), media]
        questionsWithFallbackMedia.add(question.number)
        questionsWithShuffleDisabled.add(question.number)
        cropsRefinedByImageAnalysis += debug.refinedByImageAnalysis ? 1 : 0
        cropsWidenedForLeftCutoffProtection += debug.widenedForLeftCutoffProtection ? 1 : 0

        if (isDevelopmentMode()) {
          console.log('visual-answer-question-fallback accepted', {
            questionNumber: question.number,
            cropRole: media.role,
            pageNumber: media.sourcePageNumber,
            ...debug,
          })
        }
      } catch (error) {
        incrementReason(visualMediaRejectedReasons, error.message)
        cropFailures.push({
          questionNumber: question.number,
          answerLabel: '*',
          reason: `question-fallback-${error.message}`,
          debug: error.debug,
        })

        if (isDevelopmentMode()) {
          console.log('visual-answer-question-fallback rejected', {
            questionNumber: question.number,
            cropRole: 'question-options-crop',
            reason: error.message,
            ...error.debug,
          })
        }
      }
    }

    nextQuestions.push({
      ...question,
      warnings: questionWarnings,
      answers: nextAnswers,
      media: questionMedia,
    })
  }

  return {
    questions: nextQuestions,
    diagnostics: {
      visualMediaEnabled: ENABLE_VISUAL_MEDIA,
      questionTextCropEnabled: ENABLE_QUESTION_TEXT_CROP,
      answerCropEnabled: ENABLE_ANSWER_CROP,
      optionsFallbackCropEnabled: ENABLE_OPTIONS_FALLBACK_CROP,
      answersWithAttachedVisualCrops: attachedCount,
      answersNeedingVisualCrop,
      answersWithRejectedVisualCrops: rejectedCount,
      answersWithEmptyTextAndNoCrop: emptyTextNoCropCount,
      blankCropsRejected: blankRejectedCount,
      cropsClampedToContentBottom,
      footerBoundaryRejected,
      questionsWithQuestionTextCrops: [...questionsWithQuestionTextCrops],
      questionTextCropRejected,
      questionTextCropConsidered,
      answerCropConsidered,
      answerCropRejectedByDecision,
      visualMediaRejectedReasons,
      cropsRefinedByImageAnalysis,
      cropsWidenedForLeftCutoffProtection,
      questionsWithVisualAnswers: [...questionsWithVisualAnswers],
      questionsUsingQuestionLevelFallback: [...questionsWithFallbackMedia],
      questionsWithShuffleDisabledBecauseOfFallback: [...questionsWithShuffleDisabled],
      cropFailures,
    },
  }
}

export { noUsefulCropWarning, visualAnswerWarning }
