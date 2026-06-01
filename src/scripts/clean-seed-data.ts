import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Faltan env vars')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  // 1. Obtener IDs de las muestras seed
  const { data: samples, error: listErr } = await supabase
    .from('samples')
    .select('id')
    .like('code', 'SEED-2026-%')

  if (listErr) {
    console.error('Error listando samples:', listErr.message)
    process.exit(1)
  }

  const sampleIds = (samples ?? []).map((s) => s.id)

  if (sampleIds.length === 0) {
    console.log('No hay datos seed para borrar.')
    process.exit(0)
  }

  console.log(`Borrando ${sampleIds.length} muestras seed y sus resultados...`)

  // 2. Borrar resultados (FK a samples)
  const { error: errRes } = await supabase
    .from('results')
    .delete()
    .in('sample_id', sampleIds)

  if (errRes) {
    console.error('Error borrando results:', errRes.message)
  } else {
    console.log('Resultados borrados.')
  }

  // 3. Borrar muestras
  const { error: errSamp } = await supabase
    .from('samples')
    .delete()
    .in('id', sampleIds)

  if (errSamp) {
    console.error('Error borrando samples:', errSamp.message)
  } else {
    console.log('Muestras borradas.')
  }

  console.log('Limpieza completada.')
}

main().catch((err) => { console.error(err); process.exit(1) })
