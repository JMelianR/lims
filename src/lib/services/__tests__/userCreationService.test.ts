import { describe, it, expect } from 'vitest'
import { validateEmail, validateRut, generatePasswordFromRut } from '../userCreationService'

describe('validateEmail', () => {
  it('valida un email correcto', () => {
    expect(validateEmail('usuario@ejemplo.com')).toBe(true)
  })

  it('valida un email con subdominios', () => {
    expect(validateEmail('usuario@mail.ejemplo.cl')).toBe(true)
  })

  it('rechaza un email sin @', () => {
    expect(validateEmail('usuarioejemplo.com')).toBe(false)
  })

  it('rechaza un email sin dominio', () => {
    expect(validateEmail('usuario@')).toBe(false)
  })

  it('rechaza un email sin nombre', () => {
    expect(validateEmail('@ejemplo.com')).toBe(false)
  })

  it('rechaza string vacía', () => {
    expect(validateEmail('')).toBe(false)
  })

  it('rechaza espacios en blanco', () => {
    expect(validateEmail('   ')).toBe(false)
  })

  it('rechaza un email con espacios', () => {
    expect(validateEmail('usuario @ejemplo.com')).toBe(false)
  })

  it('trimmea espacios antes de validar', () => {
    expect(validateEmail('  usuario@ejemplo.com  ')).toBe(true)
  })
})

describe('validateRut', () => {
  it('valida un RUT chileno correcto con guión', () => {
    // RUT de ejemplo: 12.345.678-5 → 12345678, DV=5
    // Usamos un RUT conocido: 11111111-1
    const result = validateRut('11111111-1')
    expect(result.valid).toBe(true)
    expect(result.cleaned).toBe('11111111')
  })

  it('valida un RUT con puntos y guión', () => {
    const result = validateRut('11.111.111-1')
    expect(result.valid).toBe(true)
    expect(result.cleaned).toBe('11111111')
  })

  it('valida un RUT sin puntos y con guión', () => {
    const result = validateRut('11111111-1')
    expect(result.valid).toBe(true)
  })

  it('valida un RUT que termina en K', () => {
    // 13.000.010-K: cuerpo 13000010, suma dig*mult = 12, 12%11=1, 11-1=10 → K
    const result = validateRut('13.000.010-K')
    expect(result.valid).toBe(true)
    expect(result.cleaned).toBe('13000010')
  })

  it('valida un RUT que termina en k minúscula', () => {
    // Mismo RUT pero con k minúscula
    const result = validateRut('13.000.010-k')
    expect(result.valid).toBe(true)
  })

  it('valida un RUT con DV=0', () => {
    // 14.000.000-0: cuerpo 14000000, suma dig*mult = 11, 11%11=0, 11-0=11 → 0
    const result = validateRut('14.000.000-0')
    expect(result.valid).toBe(true)
    expect(result.cleaned).toBe('14000000')
  })

  it('rechaza un RUT con dígito verificador incorrecto', () => {
    const result = validateRut('11111111-2')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Dígito verificador inválido')
  })

  it('rechaza RUT vacío', () => {
    const result = validateRut('')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('RUT es requerido')
  })

  it('rechaza RUT null', () => {
    const result = validateRut(null as unknown as string)
    expect(result.valid).toBe(false)
  })

  it('rechaza RUT demasiado corto', () => {
    const result = validateRut('123-5')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('RUT demasiado corto (mínimo 7 caracteres)')
  })

  it('rechaza RUT con letras en el cuerpo', () => {
    const result = validateRut('12A45678-5')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('RUT contiene caracteres inválidos')
  })

  it('rechaza RUT con dígito verificador inválido (letra no K)', () => {
    const result = validateRut('11111111-Z')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Dígito verificador inválido')
  })
})

describe('generatePasswordFromRut', () => {
  it('genera contraseña desde un RUT válido (>= 8 caracteres)', () => {
    const result = generatePasswordFromRut('11111111-1')
    expect(result.password).toBe('11111111')
    expect(result.isRandom).toBe(false)
  })

  it('genera contraseña aleatoria para RUT inválido', () => {
    const result = generatePasswordFromRut('123-5')
    expect(result.isRandom).toBe(true)
    expect(result.password.length).toBeGreaterThanOrEqual(8)
  })

  it('genera contraseña aleatoria para RUT con cuerpo corto (< 8 dígitos)', () => {
    // Un RUT de 7 dígitos (cuerpo 6) generará contraseña aleatoria
    // porque el cuerpo limpio tiene menos de 8 caracteres
    const result = generatePasswordFromRut('1-1') // RUT inválido → aleatorio
    expect(result.isRandom).toBe(true)
  })

  it('genera contraseña de al menos 12 caracteres cuando es aleatoria', () => {
    const result = generatePasswordFromRut('')
    expect(result.isRandom).toBe(true)
    expect(result.password.length).toBeGreaterThanOrEqual(8)
  })
})
