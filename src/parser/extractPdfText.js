import * as pdfjs from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

function textItemsToLines(items) {
  const lines = []
  let currentLine = []
  let currentY = null

  items.forEach((item) => {
    if (!item.str) {
      return
    }

    const itemY = Math.round(item.transform?.[5] ?? 0)
    const itemX = item.transform?.[4] ?? 0
    const startsNewLine = currentY !== null && Math.abs(itemY - currentY) > 2

    if (startsNewLine) {
      lines.push(lineItemsToText(currentLine))
      currentLine = []
    }

    currentLine.push({
      text: item.str,
      x: itemX,
    })
    currentY = itemY
  })

  if (currentLine.length > 0) {
    lines.push(lineItemsToText(currentLine))
  }

  return lines.filter(Boolean)
}

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

export async function extractPdfText(file) {
  const arrayBuffer = await file.arrayBuffer()
  const document = await pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) }).promise
  const pages = []

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber)
    const content = await page.getTextContent()
    pages.push(textItemsToLines(content.items).join('\n'))
  }

  return pages.join('\n\n')
}
