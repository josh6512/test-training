import mammoth from 'mammoth/mammoth.browser'

export async function extractDocxText(file) {
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer })
  return result.value
}
