import { describe, it, expect, vi } from 'vitest'
import { InterpretationService } from '../interpretationService'
import type { InterpretationRule, UnitResult, SampleFull } from '@/types/database'

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
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(),
      })),
    })),
  })),
}))

function makeService(): InterpretationService {
  return new InterpretationService()
}

function makeRule(overrides: Partial<InterpretationRule> = {}): InterpretationRule {
  return {
    id: 'rule-1',
    name: 'Test Rule',
    area: null,
    analyte: 'Meloidogyne',
    comparator: '>',
    threshold_json: { value: 100 },
    message: 'Alta población de {analyte}: {value}',
    severity: 'high',
    species: null,
    crop_next: null,
    active: true,
    created_at: '2026-01-01',
    ...overrides,
  } as InterpretationRule
}

function makeResult(overrides: Partial<UnitResult> = {}): UnitResult {
  return {
    id: 'result-1',
    analyte: 'Meloidogyne',
    result_value: 150,
    result_flag: null,
    unit_id: 'unit-1',
    ...overrides,
  } as UnitResult
}

function makeSample(overrides: Partial<SampleFull> = {}): SampleFull {
  return {
    id: 'sample-1',
    code: 'DEMO-001',
    species: 'Tomate',
    variety: 'Roma',
    next_crop: null,
    status: 'completed',
    sample_units: [],
    ...overrides,
  } as SampleFull
}

describe('InterpretationService', () => {
  describe('evaluateAnalyteCondition (via any)', () => {
    const service = makeService()
    const evaluate = (result: UnitResult, rule: InterpretationRule) =>
      (service as any).evaluateAnalyteCondition(result, rule)

    it('> : true cuando el valor es mayor que el umbral', () => {
      const rule = makeRule({ comparator: '>', threshold_json: { value: 100 } })
      const result = makeResult({ result_value: 150 })
      expect(evaluate(result, rule)).toBe(true)
    })

    it('> : false cuando el valor es menor que el umbral', () => {
      const rule = makeRule({ comparator: '>', threshold_json: { value: 100 } })
      const result = makeResult({ result_value: 50 })
      expect(evaluate(result, rule)).toBe(false)
    })

    it('> : false cuando el valor es igual al umbral', () => {
      const rule = makeRule({ comparator: '>', threshold_json: { value: 100 } })
      const result = makeResult({ result_value: 100 })
      expect(evaluate(result, rule)).toBe(false)
    })

    it('>= : true cuando el valor es igual al umbral', () => {
      const rule = makeRule({ comparator: '>=', threshold_json: { value: 100 } })
      const result = makeResult({ result_value: 100 })
      expect(evaluate(result, rule)).toBe(true)
    })

    it('>= : true cuando el valor es mayor', () => {
      const rule = makeRule({ comparator: '>=', threshold_json: { value: 100 } })
      const result = makeResult({ result_value: 200 })
      expect(evaluate(result, rule)).toBe(true)
    })

    it('>= : false cuando el valor es menor', () => {
      const rule = makeRule({ comparator: '>=', threshold_json: { value: 100 } })
      const result = makeResult({ result_value: 50 })
      expect(evaluate(result, rule)).toBe(false)
    })

    it('= : true cuando el valor coincide con el umbral', () => {
      const rule = makeRule({ comparator: '=', threshold_json: { value: 5 } })
      const result = makeResult({ result_value: 5 })
      expect(evaluate(result, rule)).toBe(true)
    })

    it('= : false cuando el valor no coincide', () => {
      const rule = makeRule({ comparator: '=', threshold_json: { value: 5 } })
      const result = makeResult({ result_value: 3 })
      expect(evaluate(result, rule)).toBe(false)
    })

    it('= : true cuando el flag coincide (sin value)', () => {
      const rule = makeRule({ comparator: '=', threshold_json: { flag: 'positivo' } })
      const result = makeResult({ result_value: null, result_flag: 'positivo' })
      expect(evaluate(result, rule)).toBe(true)
    })

    it('= : false cuando el flag no coincide', () => {
      const rule = makeRule({ comparator: '=', threshold_json: { flag: 'positivo' } })
      const result = makeResult({ result_value: null, result_flag: 'negativo' })
      expect(evaluate(result, rule)).toBe(false)
    })

    it('in : true cuando el valor está en la lista', () => {
      const rule = makeRule({ comparator: 'in', threshold_json: { values: ['positivo', 'dudoso'] } })
      const result = makeResult({ result_value: null, result_flag: 'positivo' })
      expect(evaluate(result, rule)).toBe(true)
    })

    it('in : true cuando el analito está en la lista', () => {
      const rule = makeRule({ comparator: 'in', threshold_json: { values: ['Meloidogyne', 'Heterodera'] } })
      const result = makeResult({ result_value: null, result_flag: null, analyte: 'Meloidogyne' })
      expect(evaluate(result, rule)).toBe(true)
    })

    it('in : false cuando nada está en la lista', () => {
      const rule = makeRule({ comparator: 'in', threshold_json: { values: ['A', 'B'] } })
      const result = makeResult({ result_value: 'C', result_flag: 'D', analyte: 'E' })
      expect(evaluate(result, rule)).toBe(false)
    })

    it('comparador desconocido → false', () => {
      const rule = makeRule({ comparator: 'unknown' as any })
      const result = makeResult()
      expect(evaluate(result, rule)).toBe(false)
    })

    it('result_value es null con > → false', () => {
      const rule = makeRule({ comparator: '>', threshold_json: { value: 100 } })
      const result = makeResult({ result_value: null })
      expect(evaluate(result, rule)).toBe(false)
    })
  })

  describe('customizeMessage (via any)', () => {
    const service = makeService()
    const customize = (template: string, result: UnitResult & { unit?: { code?: string; label?: string } }, sample: SampleFull) =>
      (service as any).customizeMessage(template, result, sample)

    it('reemplaza {analyte} con el nombre del analito', () => {
      const result = makeResult({ analyte: 'Meloidogyne', result_value: 150 })
      const sample = makeSample({ species: 'Tomate' })
      const msg = customize('Se detectó {analyte}', result, sample)
      expect(msg).toBe('Se detectó Meloidogyne')
    })

    it('reemplaza {value} con el valor numérico', () => {
      const result = makeResult({ result_value: 250 })
      const sample = makeSample()
      const msg = customize('Valor: {value}', result, sample)
      expect(msg).toBe('Valor: 250')
    })

    it('reemplaza {species} con la especie de la muestra', () => {
      const result = makeResult()
      const sample = makeSample({ species: 'Tomate' })
      const msg = customize('Especie: {species}', result, sample)
      expect(msg).toBe('Especie: Tomate')
    })

    it('reemplaza {sample_code} con el código', () => {
      const result = makeResult()
      const sample = makeSample({ code: 'DEMO-026' })
      const msg = customize('Muestra {sample_code}', result, sample)
      expect(msg).toBe('Muestra DEMO-026')
    })

    it('reemplaza múltiples placeholders', () => {
      const result = makeResult({ analyte: 'Fusarium', result_value: 5000, result_flag: 'positivo' })
      const sample = makeSample({ species: 'Trigo', variety: 'Invierno', code: 'DEMO-100' })
      const msg = customize('{analyte}={value} ({flag}) en {species} {variety} - {sample_code}', result, sample)
      expect(msg).toBe('Fusarium=5000 (positivo) en Trigo Invierno - DEMO-100')
    })

    it('usa N/A para valores faltantes', () => {
      const result = makeResult({ analyte: null, result_value: null, result_flag: null })
      const sample = makeSample({ species: null, variety: null, code: null })
      const msg = customize('{analyte} en {species}', result, sample)
      expect(msg).toBe('N/A en N/A')
    })

    it('reemplaza {unit_code} y {unit_label}', () => {
      const result = { ...makeResult(), unit: { code: 'U1', label: 'Raíz' } }
      const sample = makeSample()
      const msg = customize('Unidad {unit_code} ({unit_label})', result, sample)
      expect(msg).toBe('Unidad U1 (Raíz)')
    })
  })

  describe('getExampleRules', () => {
    it('retorna al menos 3 reglas de ejemplo', () => {
      const rules = InterpretationService.getExampleRules()
      expect(rules.length).toBeGreaterThanOrEqual(3)
    })

    it('cada regla tiene el área definida', () => {
      const rules = InterpretationService.getExampleRules()
      rules.forEach(rule => {
        expect(rule.area).toBeTruthy()
        expect(rule.message).toBeTruthy()
        expect(rule.comparator).toBeTruthy()
      })
    })

    it('incluye reglas de nematología, virología y fitopatología', () => {
      const rules = InterpretationService.getExampleRules()
      const areas = rules.map(r => r.area)
      expect(areas).toContain('nematologia')
      expect(areas).toContain('virologia')
      expect(areas).toContain('fitopatologia')
    })
  })
})
