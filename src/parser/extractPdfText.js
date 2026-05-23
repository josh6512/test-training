import * as pdfjs from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

const renderScale = 2

function countHebrewChars(text) {
  return [...text].filter((char) => /[\u0590-\u05ff]/u.test(char)).length
}

function countLatinChars(text) {
  return [...text].filter((char) => /[A-Za-z]/.test(char)).length
}

function lineItemsToText(lineItems) {
  const rawText = lineItems.map((item) => item.text).join(' ')
  const isRtlLine = countHebrewChars(rawText) > countLatinChars(rawText)
  const sortedItems = [...lineItems].sort((first, second) =>
    isRtlLine ? second.x - first.x : first.x - second.x,
  )

  return sortedItems.map((item) => item.text).join(' ').replace(/\s+/g, ' ').trim()
}

function lineItemsToLine(lineItems, pageNumber) {
  const text = lineItemsToText(lineItems)
  const minX = Math.min(...lineItems.map((item) => item.x))
  const maxX = Math.max(...lineItems.map((item) => item.x + item.width))
  const minY = Math.min(...lineItems.map((item) => item.y))
  const maxY = Math.max(...lineItems.map((item) => item.y + item.height))

  return {
    pageNumber,
    text,
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
    items: lineItems,
  }
}

function getViewportTextRect(item, viewport) {
  const x = item.transform?.[4] ?? 0
  const y = item.transform?.[5] ?? 0
  const width = item.width ?? Math.max(1, item.str.length * 5)
  const height = item.height ?? Math.abs(item.transform?.[3] ?? 10)
  const rect = viewport.convertToViewportRectangle([x, y, x + width, y - height])
  const left = Math.min(rect[0], rect[2])
  const top = Math.min(rect[1], rect[3])
  const right = Math.max(rect[0], rect[2])
  const bottom = Math.max(rect[1], rect[3])

  return {
    x: left,
    y: top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  }
}

function textItemsToLines(items, pageNumber, viewport) {
  const lines = []
  let currentLine = []
  let currentY = null

  items.forEach((item) => {
    if (!item.str?.trim()) {
      return
    }

    const itemY = Math.round(item.transform?.[5] ?? 0)
    const viewportRect = getViewportTextRect(item, viewport)
    const startsNewLine = currentY !== null && Math.abs(itemY - currentY) > 2

    if (startsNewLine) {
      lines.push(lineItemsToLine(currentLine, pageNumber))
      currentLine = []
    }

    currentLine.push({
      text: item.str,
      normalizedText: item.str.replace(/\s+/g, ' ').trim(),
      x: viewportRect.x,
      y: viewportRect.y,
      width: viewportRect.width,
      height: viewportRect.height,
      pageNumber,
    })
    currentY = itemY
  })

  if (currentLine.length > 0) {
    lines.push(lineItemsToLine(currentLine, pageNumber))
  }

  return lines.filter((line) => line.text)
}

async function renderPageImage(page) {
  const viewport = page.getViewport({ scale: renderScale })
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  canvas.width = viewport.width
  canvas.height = viewport.height
  await page.render({ canvasContext: context, viewport }).promise

  return {
    dataUrl: canvas.toDataURL('image/png'),
    width: canvas.width,
    height: canvas.height,
    scale: renderScale,
  }
}

export async function extractPdfText(file) {
  const arrayBuffer = await file.arrayBuffer()
  const document = await pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) }).promise
  const pages = []

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber)
    const viewport = page.getViewport({ scale: 1 })
    const content = await page.getTextContent()
    const lines = textItemsToLines(content.items, pageNumber, viewport)
    const image = await renderPageImage(page)

    pages.push({
      pageNumber,
      rawText: lines.map((line) => line.text).join('\n'),
      width: viewport.width,
      height: viewport.height,
      image,
      textItems: lines.flatMap((line) => line.items),
      lines,
    })
  }

  const rawText = pages.map((page) => page.rawText).join('\n\n')

  return {
    rawText,
    pages,
  }
}
