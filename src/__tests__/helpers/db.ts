import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

/**
 * Crea un cliente de Supabase que bypassea RLS usando la service_role key.
 *
 * La clave está en que Authorization: Bearer <service_role_key> es lo que
 * PostgREST verifica para saltarse RLS. El apikey sigue siendo la anon key.
 */
export function createServiceRoleClient(): SupabaseClient<Database> {
  if (!supabaseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL no configurada')
  if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY no configurada')

  // Usamos service_role key como apikey para bypassear RLS.
  // Authorization se deja vacío para que PostgREST no intente
  // validarlo como JWT (la service_role key no es un JWT).
  return createClient<Database>(supabaseUrl, serviceRoleKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: '',
      },
    },
  })
}

let _client: SupabaseClient<Database> | null = null

/**
 * Retorna un cliente compartido con service_role para toda la suite de tests.
 */
export function getTestClient(): SupabaseClient<Database> {
  if (!_client) {
    _client = createServiceRoleClient()
  }
  return _client
}

/**
 * Limpia los datos de prueba buscando por prefijo.
 * Borra en orden inverso de dependencias para no violar FK.
 */
export async function cleanupTestData(
  client: SupabaseClient<Database>,
  prefix: string = 'test_intg_'
): Promise<void> {
  // 1. Encontrar samples de prueba
  const { data: testSamples } = await client
    .from('samples')
    .select('id')
    .ilike('code', `%${prefix}%`)

  const sampleIds = testSamples?.map(s => s.id) || []

  // 2. Borrar registros relacionados en orden
  for (const sampleId of sampleIds) {
    const { data: units } = await client
      .from('sample_units')
      .select('id')
      .eq('sample_id', sampleId)
    const unitIds = units?.map(u => u.id) || []

    if (unitIds.length > 0) {
      await client.from('unit_results').delete().in('sample_unit_id', unitIds)
    }
    await client.from('sample_units').delete().eq('sample_id', sampleId)
    await client.from('results').delete().eq('sample_id', sampleId)
    await client.from('sample_tests').delete().eq('sample_id', sampleId)
    await client.from('sample_status_transitions').delete().eq('sample_id', sampleId)
    await client.from('applied_interpretations').delete().eq('sample_id', sampleId)
    await client.from('sample_files').delete().eq('sample_id', sampleId)
    await client.from('reports').delete().eq('sample_id', sampleId)
    await client.from('samples').delete().eq('id', sampleId)
  }

  // 3. Buscar y eliminar samples que usan código de test (formato TEST-*)
  const { data: testSamples2 } = await client
    .from('samples')
    .select('id')
    .ilike('code', 'TEST-%')
  const sampleIds2 = testSamples2?.map(s => s.id) || []

  for (const sampleId of sampleIds2) {
    const { data: units } = await client
      .from('sample_units')
      .select('id')
      .eq('sample_id', sampleId)
    const unitIds = units?.map(u => u.id) || []

    if (unitIds.length > 0) {
      await client.from('unit_results').delete().in('sample_unit_id', unitIds)
    }
    await client.from('sample_units').delete().eq('sample_id', sampleId)
    await client.from('results').delete().eq('sample_id', sampleId)
    await client.from('sample_tests').delete().eq('sample_id', sampleId)
    await client.from('sample_status_transitions').delete().eq('sample_id', sampleId)
    await client.from('applied_interpretations').delete().eq('sample_id', sampleId)
    await client.from('sample_files').delete().eq('sample_id', sampleId)
    await client.from('reports').delete().eq('sample_id', sampleId)
    await client.from('samples').delete().eq('id', sampleId)
  }

  // 4. Borrar clientes de prueba
  await client.from('clients').delete().ilike('name', `${prefix}%`)

  // 5. Borrar usuarios públicos de prueba
  await client.from('users').delete().ilike('email', `${prefix}%`)

  // 6. Borrar empresas de prueba
  await client.from('companies').delete().ilike('name', `${prefix}%`)
}

/**
 * Elimina usuarios de auth.users que coincidan con el prefijo.
 */
export async function cleanupAuthUsers(
  client: SupabaseClient<Database>,
  prefix: string = 'test_intg_'
): Promise<void> {
  try {
    // Solo buscar en la primera página (más rápido).
    // Si hay más de ~50 usuarios de prueba, se limpian en la siguiente ejecución.
    const { data } = await client.auth.admin.listUsers({ page: 1, perPage: 50 })
    if (data?.users) {
      for (const user of data.users) {
        if (user.email?.startsWith(prefix)) {
          await client.auth.admin.deleteUser(user.id)
        }
      }
    }
  } catch (err) {
    console.warn('[cleanup] Error limpiando auth.users:', err)
  }
}
