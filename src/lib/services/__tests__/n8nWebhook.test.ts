import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { sendToN8n, type N8nWebhookResult } from '../n8nWebhook'

describe('sendToN8n', () => {
  beforeEach(() => {
    vi.stubEnv('N8N_NOTIFICATIONS_WEBHOOK_URL', 'https://n8n.example.com/webhook/test')
    vi.stubEnv('N8N_WEBHOOK_USER', 'admin')
    vi.stubEnv('N8N_WEBHOOK_PASSWORD', 'secret123')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('retorna error cuando la URL no está configurada', async () => {
    vi.stubEnv('N8N_NOTIFICATIONS_WEBHOOK_URL', '')

    const result = await sendToN8n({ test: true })
    expect(result.sent).toBe(false)
    expect(result.error).toBe('N8N_NOTIFICATIONS_WEBHOOK_URL no configurada')
  })

  it('envía POST con payload JSON cuando fetch responde OK', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
      text: () => Promise.resolve(''),
    })
    vi.stubGlobal('fetch', mockFetch)

    const result = await sendToN8n({ to_email: 'test@test.com', subject: 'Hola' })

    expect(result.sent).toBe(true)
    expect(result.responseData).toEqual({ success: true })

    // Verificar que fetch fue llamado correctamente
    const [url, options] = mockFetch.mock.calls[0]
    expect(url).toBe('https://n8n.example.com/webhook/test')
    expect(options.method).toBe('POST')
    expect(options.headers['Content-Type']).toBe('application/json')
    expect(options.headers['Authorization']).toBeDefined()
    expect(options.headers['Authorization']).toMatch(/^Basic /)

    const body = JSON.parse(options.body)
    expect(body.to_email).toBe('test@test.com')
    expect(body.subject).toBe('Hola')
  })

  it('no envía Authorization cuando DISABLE_AUTH=true', async () => {
    vi.stubEnv('N8N_WEBHOOK_DISABLE_AUTH', 'true')

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(null),
      text: () => Promise.resolve(''),
    })
    vi.stubGlobal('fetch', mockFetch)

    const result = await sendToN8n({ test: true })

    expect(result.sent).toBe(true)
    const [, options] = mockFetch.mock.calls[0]
    expect(options.headers['Authorization']).toBeUndefined()
  })

  it('no envía Authorization cuando no hay user/password configurados', async () => {
    vi.stubEnv('N8N_WEBHOOK_USER', '')
    vi.stubEnv('N8N_WEBHOOK_PASSWORD', '')

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(null),
      text: () => Promise.resolve(''),
    })
    vi.stubGlobal('fetch', mockFetch)

    const result = await sendToN8n({ test: true })

    expect(result.sent).toBe(true)
    const [, options] = mockFetch.mock.calls[0]
    expect(options.headers['Authorization']).toBeUndefined()
  })

  it('retorna error cuando fetch responde con status !== ok', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Internal Server Error'),
    })
    vi.stubGlobal('fetch', mockFetch)

    const result = await sendToN8n({ test: true })

    expect(result.sent).toBe(false)
    expect(result.error).toBe('Webhook responded with 500')
  })

  it('retorna error cuando fetch lanza excepción', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Connection refused'))
    vi.stubGlobal('fetch', mockFetch)

    const result = await sendToN8n({ test: true })

    expect(result.sent).toBe(false)
    expect(result.error).toBe('Connection refused')
  })

  it('maneja respuesta sin JSON (texto plano)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.reject(new Error('Not JSON')),
      text: () => Promise.resolve('OK'),
    })
    vi.stubGlobal('fetch', mockFetch)

    const result = await sendToN8n({ test: true })

    expect(result.sent).toBe(true)
    expect(result.responseData).toBeNull()
  })
})
