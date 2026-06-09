import type { User } from '@supabase/supabase-js'
import type { SupabaseServerClient } from '@/lib/auth/api-auth'

/**
 * Crea un mock de User para inyectar en withAuth durante los tests.
 */
export function createMockUser(id: string, email: string): User {
  return {
    id,
    email,
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: new Date().toISOString(),
    role: 'authenticated',
    updated_at: new Date().toISOString(),
    identities: [],
    factors: [],
  } as User
}

/**
 * Contexto de autenticación que se le pasa al handler.
 */
export interface TestAuthContext {
  user: User
  supabase: SupabaseServerClient
}

/**
 * Crea el contexto de autenticación para un test.
 * El supabase client es el de service_role.
 */
export function createTestAuthContext(
  userId: string,
  userEmail: string,
  supabase: SupabaseServerClient
): TestAuthContext {
  return {
    user: createMockUser(userId, userEmail),
    supabase,
  }
}
