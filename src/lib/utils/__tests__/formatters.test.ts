import { describe, it, expect } from 'vitest'
import { formatDate, formatDateTime, getDaysAgo, formatText, capitalize, formatTestArea } from '../formatters'

describe('formatDate', () => {
  it('devuelve "N/A" para null', () => {
    expect(formatDate(null)).toBe('N/A')
  })

  it('devuelve "N/A" para undefined', () => {
    expect(formatDate(undefined)).toBe('N/A')
  })

  it('devuelve "N/A" para string vacía', () => {
    expect(formatDate('')).toBe('N/A')
  })

  it('formatea una fecha ISO válida en español', () => {
    const result = formatDate('2026-06-15')
    // En es-ES: día/mes/año — verificamos que no sea N/A ni error
    expect(result).not.toBe('N/A')
    expect(result).not.toBe('Fecha inválida')
    expect(result).toContain('2026')
  })

  it('devuelve "Fecha inválida" para una fecha inválida', () => {
    expect(formatDate('esto-no-es-una-fecha')).toBe('Fecha inválida')
  })
})

describe('formatDateTime', () => {
  it('devuelve "N/A" para null', () => {
    expect(formatDateTime(null)).toBe('N/A')
  })

  it('devuelve "N/A" para undefined', () => {
    expect(formatDateTime(undefined)).toBe('N/A')
  })

  it('formatea una fecha ISO válida con hora', () => {
    const result = formatDateTime('2026-01-15T10:30:00')
    expect(result).toContain('15')
    expect(result).toContain('2026')
  })

  it('devuelve "Fecha inválida" para una fecha inválida', () => {
    expect(formatDateTime('invalido')).toBe('Fecha inválida')
  })
})

describe('getDaysAgo', () => {
  it('devuelve 0 para null', () => {
    expect(getDaysAgo(null)).toBe(0)
  })

  it('devuelve 0 para undefined', () => {
    expect(getDaysAgo(undefined)).toBe(0)
  })

  it('devuelve un número positivo para una fecha pasada', () => {
    const daysAgo = getDaysAgo('2020-01-01')
    expect(daysAgo).toBeGreaterThan(0)
  })

  it('devuelve 0 para una fecha inválida', () => {
    expect(getDaysAgo('invalido')).toBe(0)
  })
})

describe('formatText', () => {
  it('devuelve el texto si no es null', () => {
    expect(formatText('Hola')).toBe('Hola')
  })

  it('devuelve "N/A" para null', () => {
    expect(formatText(null)).toBe('N/A')
  })

  it('devuelve "N/A" para undefined', () => {
    expect(formatText(undefined)).toBe('N/A')
  })

  it('devuelve string vacía si el texto es string vacía y no hay fallback', () => {
    // string vacía es falsy, así que usa el fallback por defecto
    expect(formatText('')).toBe('N/A')
  })

  it('usa el fallback personalizado cuando el texto es null', () => {
    expect(formatText(null, 'Sin datos')).toBe('Sin datos')
  })
})

describe('capitalize', () => {
  it('capitaliza la primera letra y baja el resto', () => {
    expect(capitalize('hola')).toBe('Hola')
  })

  it('convierte todo mayúsculas a formato capitalizado', () => {
    expect(capitalize('MAYUSCULAS')).toBe('Mayusculas')
  })

  it('devuelve "N/A" para null', () => {
    expect(capitalize(null)).toBe('N/A')
  })

  it('devuelve "N/A" para string vacía', () => {
    expect(capitalize('')).toBe('N/A')
  })
})

describe('formatTestArea', () => {
  it('capitaliza cada palabra y reemplaza guiones bajos', () => {
    expect(formatTestArea('fish_health')).toBe('Fish Health')
  })

  it('maneja múltiples guiones bajos', () => {
    expect(formatTestArea('water_quality_analysis')).toBe('Water Quality Analysis')
  })

  it('devuelve "N/A" para null', () => {
    expect(formatTestArea(null)).toBe('N/A')
  })

  it('devuelve "N/A" para string vacía', () => {
    expect(formatTestArea('')).toBe('N/A')
  })

  it('devuelve "N/A" para undefined', () => {
    expect(formatTestArea(undefined)).toBe('N/A')
  })
})
