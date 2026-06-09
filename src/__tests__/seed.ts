import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

/**
 * Semilla de datos estáticos para tests de integración.
 * Es idempotente: solo inserta lo que no existe.
 *
 * Tablas que puebla:
 * - roles (admin, validador, comun, consumidor)
 * - test_catalog (nematologia, fitopatologia, virologia, deteccion_precoz)
 * - methods (COBB-BAE, CENTRI, PETRI, INCUB, HUMID-CAM, COL-COUNT, RT-PCR, PCR, ELISA)
 */
export async function seedStaticData(client: SupabaseClient<Database>): Promise<{
  roleIds: Record<string, number>
}> {
  // ── Roles ──────────────────────────────────────────────
  const ROLES = [
    { id: 1, name: 'admin' as const, level: 100, description: 'Administrador del sistema' },
    { id: 2, name: 'validador' as const, level: 50, description: 'Validador de resultados' },
    { id: 3, name: 'comun' as const, level: 10, description: 'Usuario estándar' },
    { id: 4, name: 'consumidor' as const, level: 1, description: 'Cliente final' },
  ]

  const roleIds: Record<string, number> = {}

  for (const role of ROLES) {
    const { data: existing } = await client
      .from('roles')
      .select('id, name')
      .eq('name', role.name)
      .maybeSingle()

    if (existing) {
      roleIds[existing.name] = existing.id
    } else {
      const { data: inserted, error } = await client
        .from('roles')
        .insert(role)
        .select('id, name')
        .single()

      if (error) {
        console.warn(`[seed] No se pudo insertar rol ${role.name}: ${error.message}`)
      } else if (inserted) {
        roleIds[inserted.name] = inserted.id
      }
    }
  }

  // ── Methods ────────────────────────────────────────────
  const METHODS = [
    { code: 'COBB-BAE', name: 'Tamizado de Cobb y Embudo de Baermann', matrix: 'suelo' as const },
    { code: 'CENTRI', name: 'Centrífuga', matrix: 'suelo' as const },
    { code: 'INCUB-COBB', name: 'Incubación y Tamizado de Cobb', matrix: 'suelo' as const },
    { code: 'PETRI', name: 'Placa Petri', matrix: 'hoja' as const },
    { code: 'INCUB', name: 'Incubación', matrix: 'hoja' as const },
    { code: 'HUMID-CAM', name: 'Cámara Húmeda', matrix: 'hoja' as const },
    { code: 'COL-COUNT', name: 'Recuento de Colonias', matrix: 'raiz' as const },
    { code: 'TAX-TRAD', name: 'Taxonomía Tradicional', matrix: 'suelo' as const },
    { code: 'PCR', name: 'PCR', matrix: 'hoja' as const },
    { code: 'RT-PCR', name: 'RT-PCR', matrix: 'hoja' as const },
    { code: 'ELISA', name: 'ELISA', matrix: 'hoja' as const },
  ]

  for (const method of METHODS) {
    const { data: existing } = await client
      .from('methods')
      .select('id, code')
      .eq('code', method.code)
      .maybeSingle()

    if (!existing) {
      const { error } = await client.from('methods').insert(method)
      if (error) {
        console.warn(`[seed] No se pudo insertar método ${method.code}: ${error.message}`)
      }
    }
  }

  // ── Test Catalog ───────────────────────────────────────
  const CATALOG = [
    { code: 'NEMA-001', name: 'Análisis Nematológico', area: 'nematologia' as const, default_method_code: 'COBB-BAE' },
    { code: 'FITO-001', name: 'Análisis Fitopatológico', area: 'fitopatologia' as const, default_method_code: 'HUMID-CAM' },
    { code: 'VIRO-001', name: 'Análisis Virológico', area: 'virologia' as const, default_method_code: 'RT-PCR' },
    { code: 'ENTO-001', name: 'Análisis Entomológico', area: 'fitopatologia' as const, default_method_code: null },
    { code: 'PREC-001', name: 'Detección Precoz de Enfermedades', area: 'deteccion_precoz' as const, default_method_code: null },
  ]

  for (const entry of CATALOG) {
    const { data: existing } = await client
      .from('test_catalog')
      .select('id, code')
      .eq('code', entry.code)
      .maybeSingle()

    if (existing) {
      // El registro ya existe. Intentamos actualizar default_method_id,
      // pero no es crítico si falla (puede requerir permisos extra).
      if (entry.default_method_code) {
        try {
          const { data: method } = await client
            .from('methods')
            .select('id')
            .eq('code', entry.default_method_code)
            .maybeSingle()
          if (method) {
            await client
              .from('test_catalog')
              .update({ default_method_id: method.id })
              .eq('id', existing.id)
          }
        } catch {
          // El UPDATE puede fallar por permisos; los datos ya existen.
        }
      }
    } else {
      let defaultMethodId: number | null = null
      if (entry.default_method_code) {
        const { data: method } = await client
          .from('methods')
          .select('id')
          .eq('code', entry.default_method_code)
          .maybeSingle()

        if (method) defaultMethodId = method.id
      }

      const { error } = await client
        .from('test_catalog')
        .insert({
          code: entry.code,
          name: entry.name,
          area: entry.area,
          active: true,
          default_method_id: defaultMethodId,
        })

      if (error) {
        console.warn(`[seed] No se pudo insertar test_catalog ${entry.code}: ${error.message}`)
      }
    }
  }

  console.log('[seed] Datos estáticos listos. Roles:', roleIds)
  return { roleIds }
}
