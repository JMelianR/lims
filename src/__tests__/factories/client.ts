import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'
import { generateTestClientName } from '@/__tests__/helpers/api'

/**
 * Crea un cliente de prueba y retorna sus datos.
 */
export async function createTestClient(
  client: SupabaseClient<Database>,
  options: {
    companyId: string
    name?: string
    contactEmail?: string
    rut?: string
  }
): Promise<{ id: string; name: string; contact_email: string | null }> {
  const name = options.name || generateTestClientName()
  const contactEmail = options.contactEmail || `test_intg_client_${Date.now()}@test.lims.local`

  const { data, error } = await client
    .from('clients')
    .insert({
      company_id: options.companyId,
      name,
      contact_email: contactEmail,
      rut: options.rut || '99999999-9',
    })
    .select('id, name, contact_email')
    .single()

  if (error) throw new Error(`createTestClient failed: ${error.message}`)
  return data
}
