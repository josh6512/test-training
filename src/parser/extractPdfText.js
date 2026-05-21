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
    const startsNewLine = currentY !== null && Math.abs(itemY - currentY) > 2

    if (startsNewLine) {
      lines.push(currentLine.join(' ').trim())
      currentLine = []
    }

    currentLine.push(item.str)
    currentY = itemY
  })

  if (currentLine.length > 0) {
    lines.push(currentLine.join(' ').trim())
  }

  return lines.filter(Boolean)
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
