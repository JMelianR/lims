import { NextRequest } from 'next/server'

/**
 * Construye un objeto NextRequest para invocar handlers de API directamente.
 */
export function buildNextRequest(
  url: string,
  options?: {
    method?: string
    body?: unknown
    headers?: Record<string, string>
  }
): NextRequest {
  const { method = 'GET', body, headers = {} } = options || {}

  const init: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  }

  if (body !== undefined) {
    init.body = JSON.stringify(body)
  }

  return new NextRequest(url, init)
}

/**
 * Extrae el cuerpo JSON de una respuesta.
 */
export async function getJsonBody(response: Response): Promise<unknown> {
  const text = await response.text()
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

/**
 * Genera un código único de muestra para tests.
 */
export function generateTestCode(): string {
  const ts = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 6)
  return `test_intg_${ts}_${random}`
}

/**
 * Genera un email único para tests.
 */
export function generateTestEmail(label: string = 'user'): string {
  const ts = Date.now().toString(36)
  return `test_intg_${label}_${ts}@test.lims.local`
}

/**
 * Genera un nombre único de empresa para tests.
 */
export function generateTestCompanyName(): string {
  const ts = Date.now().toString(36)
  return `test_intg_empresa_${ts}`
}

/**
 * Genera un nombre único de cliente para tests.
 */
export function generateTestClientName(): string {
  const ts = Date.now().toString(36)
  return `test_intg_cliente_${ts}`
}
