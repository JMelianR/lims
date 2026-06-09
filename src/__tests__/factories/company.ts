import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'
import { generateTestCompanyName } from '@/__tests__/helpers/api'

/**
 * Crea una empresa de prueba y retorna sus datos.
 */
export async function createTestCompany(
  client: SupabaseClient<Database>,
  name?: string
): Promise<{ id: string; name: string }> {
  const { data, error } = await client
    .from('companies')
    .insert({ name: name || generateTestCompanyName() })
    .select('id, name')
    .single()

  if (error) throw new Error(`createTestCompany failed: ${error.message}`)
  return data
}
