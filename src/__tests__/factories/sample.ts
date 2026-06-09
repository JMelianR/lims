import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'
import { generateTestCode } from '@/__tests__/helpers/api'

/**
 * Crea una muestra de prueba directamente en la base de datos (sin pasar por la API).
 * Útil para preparar datos antes de testear updates, deletes, etc.
 */
export async function createTestSample(
  client: SupabaseClient<Database>,
  options: {
    companyId: string
    clientId: string
    code?: string
    species?: string
    status?: string
    slaType?: string
    slaStatus?: string
  }
): Promise<{ id: string; code: string }> {
  const code = options.code || generateTestCode()
  const species = options.species || 'Tomate'

  const now = new Date()
  const dueDate = new Date(now)
  const businessDays = options.slaType === 'express' ? 4 : 9
  let added = 0
  while (added < businessDays) {
    dueDate.setDate(dueDate.getDate() + 1)
    if (dueDate.getDay() !== 0 && dueDate.getDay() !== 6) added++
  }

  const { data, error } = await client
    .from('samples')
    .insert({
      company_id: options.companyId,
      client_id: options.clientId,
      code,
      species,
      received_date: now.toISOString().split('T')[0],
      received_at: now.toISOString(),
      registered_date: now.toISOString().split('T')[0],
      sla_type: options.slaType || 'normal',
      due_date: dueDate.toISOString().split('T')[0],
      sla_status: options.slaStatus || 'on_time',
      status: options.status || 'received',
      taken_by: 'client',
    })
    .select('id, code')
    .single()

  if (error) throw new Error(`createTestSample failed: ${error.message}`)
  return data
}
