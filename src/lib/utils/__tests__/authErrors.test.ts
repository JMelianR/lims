import { describe, it, expect } from 'vitest'
import { getAuthErrorMessage } from '../authErrors'
import { AuthApiError, AuthInvalidCredentialsError } from '@supabase/supabase-js'

describe('getAuthErrorMessage', () => {
  it('retorna mensaje genérico cuando el error es null', () => {
    expect(getAuthErrorMessage(null)).toBe('Error inesperado. Intenta nuevamente.')
  })

  it('retorna mensaje genérico cuando el error es undefined', () => {
    expect(getAuthErrorMessage(undefined)).toBe('Error inesperado. Intenta nuevamente.')
  })

  it('retorna mensaje de credenciales incorrectas para AuthInvalidCredentialsError', () => {
    const error = new AuthInvalidCredentialsError('Wrong password')
    expect(getAuthErrorMessage(error)).toBe(
      'Credenciales incorrectas. Verifica tu email y contraseña.'
    )
  })

  describe('AuthApiError', () => {
    it('retorna credenciales incorrectas para status 400 con "invalid"', () => {
      const error = new AuthApiError('Invalid login credentials', 400)
      expect(getAuthErrorMessage(error)).toBe(
        'Credenciales incorrectas. Verifica tu email y contraseña.'
      )
    })

    it('retorna email no confirmado para status 400 con "email not confirmed"', () => {
      const error = new AuthApiError('Email not confirmed', 400)
      expect(getAuthErrorMessage(error)).toBe(
        'Tu email no ha sido confirmado. Revisa tu bandeja de entrada para verificar tu cuenta.'
      )
    })

    it('retorna error genérico para status 400 sin palabras clave', () => {
      const error = new AuthApiError('Some bad request', 400)
      expect(getAuthErrorMessage(error)).toBe(
        'Datos inválidos. Verifica la información ingresada.'
      )
    })

    it('retorna demasiados intentos para status 429', () => {
      const error = new AuthApiError('Too many requests', 429)
      expect(getAuthErrorMessage(error)).toBe(
        'Demasiados intentos de inicio de sesión. Por favor, espera unos minutos antes de intentar nuevamente.'
      )
    })

    it('retorna error de servidor para status 500', () => {
      const error = new AuthApiError('Internal error', 500)
      expect(getAuthErrorMessage(error)).toBe(
        'Error del servidor. Por favor, intenta nuevamente en unos momentos.'
      )
    })

    it('retorna credenciales incorrectas para mensaje "invalid login credentials" en default', () => {
      const error = new AuthApiError('Invalid login credentials', 418)
      expect(getAuthErrorMessage(error)).toBe(
        'Credenciales incorrectas. Verifica tu email y contraseña.'
      )
    })

    it('retorna email no confirmado para "email not confirmed" en default', () => {
      const error = new AuthApiError('Email not confirmed', 418)
      expect(getAuthErrorMessage(error)).toBe(
        'Tu email no ha sido confirmado. Revisa tu bandeja de entrada para verificar tu cuenta.'
      )
    })

    it('retorna usuario no encontrado para "user not found" en default', () => {
      const error = new AuthApiError('User not found', 418)
      expect(getAuthErrorMessage(error)).toBe(
        'No se encontró una cuenta con este email. Verifica tu dirección de correo.'
      )
    })

    it('retorna rate limit para "too many requests" en default', () => {
      const error = new AuthApiError('Too many requests', 418)
      expect(getAuthErrorMessage(error)).toBe(
        'Demasiados intentos de inicio de sesión. Por favor, espera unos minutos antes de intentar nuevamente.'
      )
    })

    it('retorna error de conexión para "network" en default', () => {
      const error = new AuthApiError('Network error', 418)
      expect(getAuthErrorMessage(error)).toBe(
        'Error de conexión. Verifica tu conexión a internet e intenta nuevamente.'
      )
    })

    it('retorna error de servidor genérico para status sin match', () => {
      const error = new AuthApiError('Some unknown error', 418)
      expect(getAuthErrorMessage(error)).toBe('Error del servidor. Intenta nuevamente.')
    })
  })

  describe('Error genérico', () => {
    it('retorna error de conexión si el mensaje contiene "fetch"', () => {
      const error = new Error('Fetch failed')
      expect(getAuthErrorMessage(error)).toBe(
        'Error de conexión. Verifica tu conexión a internet e intenta nuevamente.'
      )
    })

    it('retorna error de conexión si el mensaje contiene "network"', () => {
      const error = new Error('Network error occurred')
      expect(getAuthErrorMessage(error)).toBe(
        'Error de conexión. Verifica tu conexión a internet e intenta nuevamente.'
      )
    })

    it('retorna el mensaje original si es descriptivo y corto', () => {
      const error = new Error('Algo salió mal')
      expect(getAuthErrorMessage(error)).toBe('Algo salió mal')
    })

    it('retorna mensaje genérico si el mensaje es muy largo', () => {
      const longMessage = 'a'.repeat(250)
      const error = new Error(longMessage)
      expect(getAuthErrorMessage(error)).toBe('Error inesperado. Intenta nuevamente.')
    })
  })

  it('retorna mensaje genérico para un error que no es instancia de Error', () => {
    expect(getAuthErrorMessage('string error')).toBe('Error inesperado. Intenta nuevamente.')
  })
})
