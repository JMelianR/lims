/**
 * Script para crear el usuario Diego Estadistico
 *
 * Uso:
 *   npx tsx src/scripts/create-user-diego.ts
 *
 * Requiere SUPABASE_SERVICE_ROLE_KEY en .env.local
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('ERROR: Faltan variables de entorno.')
  console.error('Asegurate de tener en .env.local:')
  console.error('  NEXT_PUBLIC_SUPABASE_URL=https://gyctkpgsithngxfdegob.supabase.co')
  console.error('  SUPABASE_SERVICE_ROLE_KEY=<service_role_key_del_dashboard_de_supabase>')
  process.exit(1)
}

// ===== CONFIGURACION =====
const USER_CONFIG = {
  id: '98fab18b-ef65-4eb9-9992-e857411afb8f',
  email: 'diego.estadistico14@gmail.com',
  name: 'Diego Estadistico',
  password: 'Agro123',
  roleName: 'admin', // admin | validador | comun | consumidor
  companyId: undefined, // Se asigna null
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  console.log('Creando usuario...')
  console.log(`  Email: ${USER_CONFIG.email}`)
  console.log(`  ID:    ${USER_CONFIG.id}`)
  console.log(`  Rol:   ${USER_CONFIG.roleName}`)
  console.log('')

  // 1. Verificar si ya existe en auth.users
  console.log('1. Verificando si ya existe en auth.users...')
  const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers()

  if (listError) {
    console.error('ERROR al listar usuarios:', listError.message)
    process.exit(1)
  }

  const existingAuthUser = existingUsers?.users?.find(
    (u) => u.email?.toLowerCase() === USER_CONFIG.email.toLowerCase()
  )

  let authUserId: string

  if (existingAuthUser) {
    console.log(`   Ya existe en auth.users con ID: ${existingAuthUser.id}`)
    authUserId = existingAuthUser.id

    // Si el ID no coincide con el deseado, avisar
    if (existingAuthUser.id !== USER_CONFIG.id) {
      console.log(`   ATENCION: El ID existente (${existingAuthUser.id}) no coincide con el configurado (${USER_CONFIG.id})`)
      console.log(`   Se usara el ID existente.`)
    }
  } else {
    console.log('   No existe. Creando en auth.users...')
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      id: USER_CONFIG.id,
      email: USER_CONFIG.email,
      password: USER_CONFIG.password,
      email_confirm: true,
      user_metadata: {
        name: USER_CONFIG.name,
        company_id: USER_CONFIG.companyId,
      },
    })

    if (createError) {
      console.error('ERROR al crear usuario en auth:', createError.message)
      process.exit(1)
    }

    authUserId = newUser.user!.id
    console.log(`   Creado en auth.users con ID: ${authUserId}`)
  }

  // 2. Obtener role_id
  console.log('2. Obteniendo role_id...')
  const { data: roleData, error: roleError } = await supabaseAdmin
    .from('roles')
    .select('id')
    .eq('name', USER_CONFIG.roleName)
    .single()

  if (roleError || !roleData) {
    console.error(`ERROR: Rol '${USER_CONFIG.roleName}' no encontrado`)
    process.exit(1)
  }

  console.log(`   role_id: ${roleData.id} (${USER_CONFIG.roleName})`)

  // 3. Verificar si ya tiene perfil en public.users
  console.log('3. Verificando perfil en public.users...')
  const { data: existingProfile, error: profileError } = await supabaseAdmin
    .from('users')
    .select('id, name, email, role_id, company_id')
    .eq('id', authUserId)
    .single()

  if (existingProfile) {
    console.log(`   Ya tiene perfil: ${existingProfile.name} (${existingProfile.email})`)
    console.log('4. Actualizando perfil...')
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        name: USER_CONFIG.name,
        email: USER_CONFIG.email,
        role_id: roleData.id,
        company_id: USER_CONFIG.companyId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', authUserId)

    if (updateError) {
      console.error('ERROR al actualizar perfil:', updateError.message)
      process.exit(1)
    }
    console.log('   Perfil actualizado.')
  } else {
    console.log('   No tiene perfil. Creando...')
    const { error: insertError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authUserId,
        name: USER_CONFIG.name,
        email: USER_CONFIG.email,
        role_id: roleData.id,
        company_id: USER_CONFIG.companyId,
      })

    if (insertError) {
      console.error('ERROR al crear perfil:', insertError.message)
      process.exit(1)
    }
    console.log('   Perfil creado.')
  }

  console.log('')
  console.log('========================================')
  console.log('  USUARIO CREADO EXITOSAMENTE')
  console.log('========================================')
  console.log(`  Email:    ${USER_CONFIG.email}`)
  console.log(`  Password: ${USER_CONFIG.password}`)
  console.log(`  Rol:      ${USER_CONFIG.roleName}`)
  console.log(`  UUID:     ${authUserId}`)
  console.log('========================================')
}

main().catch((err) => {
  console.error('Error inesperado:', err)
  process.exit(1)
})
