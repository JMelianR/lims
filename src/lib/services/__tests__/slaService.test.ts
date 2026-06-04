import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SLAService } from '../slaService'

// Mock del módulo singleton de Supabase
vi.mock('@/lib/supabase/singleton', () => ({
  getSupabaseClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(),
        neq: vi.fn(),
        single: vi.fn(),
        order: vi.fn(),
        lte: vi.fn(),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(),
      })),
      insert: vi.fn(),
      delete: vi.fn(),
    })),
  })),
}))

function createMockSupabase() {
  const mockChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
  }
  return {
    from: vi.fn(() => mockChain),
  } as any
}

describe('SLAService', () => {
  describe('computeDueDate', () => {
    const service = new SLAService(createMockSupabase())

    it('express: 4 días hábiles desde un lunes → viernes de la misma semana', () => {
      // new Date(año, mes-1, día) usa hora local, evita problemas de UTC
      const monday = new Date(2026, 5, 1) // 1 junio 2026 = lunes (hora local)
      const dueDate = service.computeDueDate(monday, 'express')
      // Lunes → Mar(1) → Mie(2) → Jue(3) → Vie(4) = Viernes
      expect(dueDate.getDay()).toBe(5) // Viernes
      expect(dueDate.getDate()).toBe(5)
    })

    it('express: 4 días hábiles desde un viernes → jueves de la siguiente semana', () => {
      const friday = new Date(2026, 5, 5) // 5 junio 2026 = viernes
      const dueDate = service.computeDueDate(friday, 'express')
      // Vie → Lun(1) → Mar(2) → Mie(3) → Jue(4) = Jueves
      expect(dueDate.getDay()).toBe(4) // Jueves
    })

    it('standard: 9 días hábiles desde un lunes', () => {
      const monday = new Date(2026, 5, 1) // 1 junio 2026 = lunes
      const dueDate = service.computeDueDate(monday, 'standard')
      // Lun → Mar(1)→Mie(2)→Jue(3)→Vie(4)→Lun(5)→Mar(6)→Mie(7)→Jue(8)→Vie(9)
      expect(dueDate.getDay()).toBe(5) // Viernes (2 semanas después)
    })

    it('express: 4 días hábiles desde un sábado', () => {
      const saturday = new Date(2026, 5, 6) // 6 junio 2026 = sábado
      const dueDate = service.computeDueDate(saturday, 'express')
      // Dom(skip) → Lun(1) → Mar(2) → Mie(3) → Jue(4) = Jueves
      expect(dueDate.getDay()).toBe(4) // Jueves
    })

    it('standard: 9 días hábiles desde un domingo', () => {
      const sunday = new Date(2026, 5, 7) // 7 junio 2026 = domingo
      const dueDate = service.computeDueDate(sunday, 'standard')
      // Lun(1)→Mar(2)→Mie(3)→Jue(4)→Vie(5)→Lun(6)→Mar(7)→Mie(8)→Jue(9)
      expect(dueDate.getDay()).toBe(4) // Jueves
    })
  })

  describe('calculateSLAStatus', () => {
    const service = new SLAService(createMockSupabase())

    it('completed siempre es on_time', () => {
      const pastDate = new Date('2020-01-01')
      expect(service.calculateSLAStatus(pastDate, 'completed')).toBe('on_time')
    })

    it('fecha pasada → breached', () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 2)
      expect(service.calculateSLAStatus(yesterday, 'in_progress')).toBe('breached')
    })

    it('hoy → at_risk', () => {
      const today = new Date()
      expect(service.calculateSLAStatus(today, 'in_progress')).toBe('at_risk')
    })

    it('mañana → at_risk', () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      expect(service.calculateSLAStatus(tomorrow, 'in_progress')).toBe('at_risk')
    })

    it('pasado mañana → on_time', () => {
      const dayAfter = new Date()
      dayAfter.setDate(dayAfter.getDate() + 2)
      expect(service.calculateSLAStatus(dayAfter, 'pending')).toBe('on_time')
    })

    it('1 semana en el futuro → on_time', () => {
      const nextWeek = new Date()
      nextWeek.setDate(nextWeek.getDate() + 7)
      expect(service.calculateSLAStatus(nextWeek, 'pending')).toBe('on_time')
    })
  })

  describe('getSLAStats', () => {
    it('retorna ceros cuando no hay datos', async () => {
      const mockSb = createMockSupabase()
      mockSb.from().select.mockReturnValue({
        neq: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      })

      const service = new SLAService(mockSb)
      const stats = await service.getSLAStats()
      expect(stats).toEqual({
        total: 0, on_time: 0, at_risk: 0, breached: 0, express: 0,
      })
    })

    it('retorna ceros cuando hay error', async () => {
      const mockSb = createMockSupabase()
      mockSb.from().select.mockReturnValue({
        neq: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: new Error('DB error') }),
      })

      const service = new SLAService(mockSb)
      const stats = await service.getSLAStats()
      expect(stats.total).toBe(0)
    })
  })

  describe('updateSampleSLAStatus', () => {
    it('retorna false cuando no encuentra la muestra', async () => {
      const mockSb = createMockSupabase()
      mockSb.from().select.mockReturnValue({
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: new Error('Not found') }),
      })

      const service = new SLAService(mockSb)
      const result = await service.updateSampleSLAStatus('sample-id')
      expect(result).toBe(false)
    })

    it('retorna false cuando la muestra no tiene due_date', async () => {
      const mockSb = createMockSupabase()
      mockSb.from().select.mockReturnValue({
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { due_date: null, status: 'pending', sla_status: 'on_time' },
          error: null,
        }),
      })

      const service = new SLAService(mockSb)
      const result = await service.updateSampleSLAStatus('sample-id')
      expect(result).toBe(false)
    })
  })
})
