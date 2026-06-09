import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'
import { generateTestEmail } from '@/__tests__/helpers/api'

/**
 * Crea un usuario de prueba (auth.users + public.users) y retorna sus datos.
 * Necesita un cliente con service_role.
 */
export async function createTestUser(
  client: SupabaseClient<Database>,
  options: {
    companyId: string
    roleId?: number
    name?: string
    email?: string
    password?: string
    clientId?: string
  }
): Promise<{
  id: string
  email: string
  name: string
  password: string
}> {
  const email = options.email || generateTestEmail('user')
  const password = options.password || 'Test123!@#'

  // Crear en auth.users
  const { data: authUser, error: authError } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError) throw new Error(`createTestUser auth failed: ${authError.message}`)
  if (!authUser.user) throw new Error('createTestUser: no user returned')

  const userId = authUser.user.id

  // Crear en public.users
  const { error: dbError } = await client
    .from('users')
    .insert({
      id: userId,
      company_id: options.companyId,
      client_id: options.clientId || null,
      name: options.name || 'Test User',
      email,
      role_id: options.roleId || null,
    })

  if (dbError) {
    // Limpiar el auth user si falla el insert público
    await client.auth.admin.deleteUser(userId)
    throw new Error(`createTestUser public.users failed: ${dbError.message}`)
  }

  return {
    id: userId,
    email,
    name: options.name || 'Test User',
    password,
  }
}
