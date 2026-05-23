const STORAGE_KEY = 'exam-practice-state'
export const CURRENT_EXAM_STORAGE_VERSION = 'pdf-rtl-extraction-v12'

export function loadStoredExam() {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY)
    return rawValue ? JSON.parse(rawValue) : null
  } catch (error) {
    console.warn('Could not load stored exam state.', error)
    return null
  }
}

export function saveStoredExam(value) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...value,
        savedAt: new Date().toISOString(),
      }),
    )
  } catch (error) {
    console.warn('Could not save exam state.', error)
  }
}

export function clearStoredExam() {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(STORAGE_KEY)
}

export function createFileId(file) {
  if (!file) {
    return ''
  }

  return `${file.name}-${file.size}-${file.lastModified}`
}
