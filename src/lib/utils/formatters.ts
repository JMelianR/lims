/**
 * Common formatting utilities to handle null values and provide consistent formatting
 */

// Safe date formatting
export const formatDate = (date: string | null | undefined, locale: string = 'es-ES'): string => {
  if (!date) return 'N/A'
  const dateObj = new Date(date)
  if (isNaN(dateObj.getTime())) return 'Fecha inválida'
  try {
    return dateObj.toLocaleDateString(locale)
  } catch {
    return 'Fecha inválida'
  }
}

export const formatDateTime = (date: string | null | undefined, locale: string = 'es-ES'): string => {
  if (!date) return 'N/A'
  const dateObj = new Date(date)
  if (isNaN(dateObj.getTime())) return 'Fecha inválida'
  try {
    return dateObj.toLocaleString(locale)
  } catch {
    return 'Fecha inválida'
  }
}

// Calculate days ago
export const getDaysAgo = (date: string | null | undefined): number => {
  if (!date) return 0
  const dateObj = new Date(date)
  if (isNaN(dateObj.getTime())) return 0
  const diff = Date.now() - dateObj.getTime()
  if (isNaN(diff)) return 0
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

// Safe string formatting
export const formatText = (text: string | null | undefined, fallback: string = 'N/A'): string => {
  return text || fallback
}

export const capitalize = (text: string | null | undefined): string => {
  if (!text) return 'N/A'
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
}

export const formatTestArea = (area: string | null | undefined): string => {
  if (!area) return 'N/A'
  return area.replace(/_/g, ' ').split(' ').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(' ')
}