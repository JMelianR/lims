/**
 * Semilla de datos productivos para KPIs del LIMS
 *
 * Genera ~120 muestras y ~100 resultados en un rango de 6 meses
 * con distribucion realista para que todos los KPIs muestren tendencias
 * segmentadas por tipo de cliente.
 *
 * - Idempotente: se puede re-ejecutar sin duplicar (usa prefijo de codigo)
 * - 5 tipos de cliente con perfiles diferenciados
 * - Distribucion SLA: ~70% normal, ~30% express; ~80% on_time, ~12% at_risk, ~8% breached
 * - Areas: nematologia 40%, fitopatologia 40%, virologia 20%
 * - 6 meses de datos historicos con tendencia creciente
 *
 * Uso:
 *   npx tsx src/scripts/seed-kpi-data.ts
 */

import { createClient } from '@supabase/supabase-js'

// ── Config ──────────────────────────────────────────────────────────

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('ERROR: Faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const COMPANY_ID = 'b3b417bd-10bc-4343-b667-a2a0caffc6c0'
const USER_ID = '98fab18b-ef65-4eb9-9992-e857411afb8f'
const SEED_PREFIX = 'SEED-5T-2026-'

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── Tipos de cliente ────────────────────────────────────────────────

const CLIENT_TYPES = [
  'farmer',
  'agricultural_company',
  'research_institution',
  'government_agency',
  'consultant',
] as const

type ClientTypeKey = (typeof CLIENT_TYPES)[number]

/** Perfil de comportamiento por tipo de cliente */
interface ClientProfile {
  /** Porcentaje del total de muestras asignadas a este tipo */
  sampleShare: number
  /** Pesos de area [nematologia, fitopatologia, virologia] */
  areaWeights: [number, number, number]
  /** Probabilidad de SLA express (vs normal) */
  expressSlaRate: number
  /** Probabilidad de resultado positivo */
  positivityRate: number
  /** Probabilidad de que la muestra este completada */
  completionRate: number
}

const CLIENT_PROFILES: Record<ClientTypeKey, ClientProfile> = {
  farmer: {
    sampleShare: 0.20,
    areaWeights: [0.50, 0.35, 0.15],       // mas nematologia (suelos)
    expressSlaRate: 0.20,                    // menos express
    positivityRate: 0.45,
    completionRate: 0.80,
  },
  agricultural_company: {
    sampleShare: 0.25,
    areaWeights: [0.35, 0.45, 0.20],        // balanceado, mas fito
    expressSlaRate: 0.35,                    // mas express (exportacion)
    positivityRate: 0.48,
    completionRate: 0.88,
  },
  research_institution: {
    sampleShare: 0.20,
    areaWeights: [0.25, 0.35, 0.40],        // mas virologia (investigacion)
    expressSlaRate: 0.15,                    // menos urgencia
    positivityRate: 0.60,                    // mas positivos (casos complejos)
    completionRate: 0.82,
  },
  government_agency: {
    sampleShare: 0.20,
    areaWeights: [0.30, 0.55, 0.15],        // mas fitopatologia (fiscalizacion)
    expressSlaRate: 0.10,                    // casi nunca express
    positivityRate: 0.52,
    completionRate: 0.85,
  },
  consultant: {
    sampleShare: 0.15,
    areaWeights: [0.40, 0.35, 0.25],        // variado
    expressSlaRate: 0.40,                    // alta urgencia (consultoria)
    positivityRate: 0.50,
    completionRate: 0.90,
  },
}

// ── Catálogos realistas (contexto agricultura chilena) ──────────────

const DATA = {
  species: [
    { name: 'Vitis vinifera', varieties: ['Cabernet Sauvignon', 'Carmenere', 'Merlot', 'Chardonnay'] },
    { name: 'Prunus persica', varieties: ['O\'Henry', 'Elegant Lady', 'Royal Glory', 'Sin especificar'] },
    { name: 'Malus domestica', varieties: ['Gala', 'Fuji', 'Granny Smith', 'Pink Lady'] },
    { name: 'Solanum lycopersicum', varieties: ['Raf', 'Cherry', 'Roma', 'Sin especificar'] },
    { name: 'Persea americana', varieties: ['Hass', 'Fuerte', 'Sin especificar', 'Edranol'] },
    { name: 'Citrus limon', varieties: ['Eureka', 'Fino 49', 'Genova', 'Sin especificar'] },
  ],

  areas: ['nematologia', 'fitopatologia', 'virologia'] as const,

  pathogensByArea: {
    nematologia: [
      { type: 'nematode' as const, name: 'Meloidogyne incognita' },
      { type: 'nematode' as const, name: 'Pratylenchus penetrans' },
      { type: 'nematode' as const, name: 'Xiphinema index' },
      { type: 'nematode' as const, name: 'Tylenchulus semipenetrans' },
      { type: 'nematode' as const, name: 'Globodera rostochiensis' },
    ],
    fitopatologia: [
      { type: 'fungus' as const, name: 'Botrytis cinerea' },
      { type: 'fungus' as const, name: 'Fusarium oxysporum' },
      { type: 'fungus' as const, name: 'Phytophthora cinnamomi' },
      { type: 'fungus' as const, name: 'Verticillium dahliae' },
      { type: 'bacteria' as const, name: 'Agrobacterium tumefaciens' },
      { type: 'fungus' as const, name: 'Oidium tuckeri' },
    ],
    virologia: [
      { type: 'virus' as const, name: 'TMV — Tobacco Mosaic Virus' },
      { type: 'virus' as const, name: 'TSWV — Tomato Spotted Wilt Virus' },
      { type: 'virus' as const, name: 'PLRV — Potato Leafroll Virus' },
      { type: 'virus' as const, name: 'GFLV — Grapevine Fanleaf Virus' },
    ],
  },

  deliveryMethods: ['courier', 'personal', 'lab_pickup', null] as const,
}

// ── Helpers ─────────────────────────────────────────────────────────

function weightedPick<T>(items: readonly T[], weights: number[]): T {
  const r = Math.random()
  let cumulative = 0
  for (let i = 0; i < items.length; i++) {
    cumulative += weights[i]
    if (r <= cumulative) return items[i]
  }
  return items[items.length - 1]
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function dateISO(daysAgo: number, hour: number = 12, minute: number = 0): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  d.setUTCHours(hour, minute, 0, 0)
  return d.toISOString()
}

function dateOnlyISO(daysAgo: number): string {
  return dateISO(daysAgo, 0, 0).slice(0, 10)
}

// ── Generación de configuraciones SLA ───────────────────────────────

interface SlaConfig { sla_status: string; sla_type: string }

function generateSlaConfig(profile: ClientProfile): SlaConfig {
  const isExpress = Math.random() < profile.expressSlaRate
  const slaType = isExpress ? 'express' : 'normal'

  const r = Math.random()
  if (r < 0.08) return { sla_status: 'breached', sla_type: slaType }
  if (r < 0.20) return { sla_status: 'at_risk', sla_type: slaType }
  return { sla_status: 'on_time', sla_type: slaType }
}

// ── Asignar tipo de cliente a cada indice de muestra ────────────────

function buildClientTypeAssignments(totalSamples: number): ClientTypeKey[] {
  const assignments: ClientTypeKey[] = []

  // Calcular cuantas muestras por tipo segun sampleShare
  const counts: { type: ClientTypeKey; count: number }[] = []
  let remaining = totalSamples
  const entries = Object.entries(CLIENT_PROFILES) as [ClientTypeKey, ClientProfile][]

  for (let i = 0; i < entries.length; i++) {
    const [type, profile] = entries[i]
    const isLast = i === entries.length - 1
    const count = isLast ? remaining : Math.round(totalSamples * profile.sampleShare)
    counts.push({ type, count })
    remaining -= count
  }

  // Intercalar para que no aparezcan bloques del mismo tipo
  const queues = counts.map(({ type, count }) =>
    Array.from({ length: count }, () => type)
  )

  let idx = 0
  while (assignments.length < totalSamples) {
    for (const q of queues) {
      if (idx < q.length) {
        assignments.push(q[idx])
      }
    }
    idx++
  }

  return assignments.slice(0, totalSamples)
}

// ── Config de muestra ───────────────────────────────────────────────

interface SampleConfig {
  code: string
  daysAgo: number
  speciesIdx: number
  variety: string
  area: (typeof DATA.areas)[number]
  pathogen: { type: string; name: string }
  resultType: string
  sla: SlaConfig
  status: string
  hasResult: boolean
  clientTypeIdx: number  // indice en el array de CLIENT_TYPES
}

function generateConfigs(): SampleConfig[] {
  const totalSamples = 120
  const clientTypeAssignments = buildClientTypeAssignments(totalSamples)
  const configs: SampleConfig[] = []

  // Generar 120 muestras en 6 meses (180 dias), con leve tendencia creciente
  for (let i = 0; i < totalSamples; i++) {
    // Distribucion con mas muestras recientes (cuadratica)
    const t = i / (totalSamples - 1)
    const skewedT = 1 - (1 - t) * (1 - t)
    const daysAgo = Math.round(skewedT * 175) + 1

    const seq = String(i + 1).padStart(3, '0')
    const speciesIdx = i % DATA.species.length
    const varieties = DATA.species[speciesIdx].varieties
    const variety = varieties[i % varieties.length]

    // Usar el perfil del tipo de cliente asignado
    const clientType = clientTypeAssignments[i]
    const profile = CLIENT_PROFILES[clientType]

    const area = weightedPick(DATA.areas, profile.areaWeights)
    const pathogens = DATA.pathogensByArea[area]
    const pathogen = pathogens[i % pathogens.length]

    const sla = generateSlaConfig(profile)

    const isCompleted = Math.random() < profile.completionRate
    const statusRoll = Math.random()
    let status: string
    if (isCompleted) {
      status = 'completed'
    } else if (statusRoll < 0.4) {
      status = 'processing'
    } else if (statusRoll < 0.6) {
      status = 'received'
    } else if (statusRoll < 0.75) {
      status = 'microscopy'
    } else if (statusRoll < 0.9) {
      status = 'isolation'
    } else {
      status = 'validation'
    }

    const resultRoll = Math.random()
    let resultType: string
    if (resultRoll < profile.positivityRate) resultType = 'positive'
    else if (resultRoll < profile.positivityRate + 0.32) resultType = 'negative'
    else resultType = 'inconclusive'

    configs.push({
      code: `${SEED_PREFIX}${seq}`,
      daysAgo,
      speciesIdx,
      variety,
      area,
      pathogen,
      resultType,
      sla,
      status,
      hasResult: isCompleted || status === 'validation',
      clientTypeIdx: CLIENT_TYPES.indexOf(clientType),
    })
  }

  return configs
}

// ── Clientes ────────────────────────────────────────────────────────

interface ClientSeed {
  name: string
  rut: string
  contact_email: string
  phone: string
  address: string
  client_type: string
}

function generateClients(): ClientSeed[] {
  return [
    // agricultural_company (2)
    {
      name: 'Viña Santa Helena Ltda.',
      rut: '76123456-9',
      contact_email: 'lab@vina-santahelena.cl',
      phone: '+56987654321',
      address: 'Ruta 5 Sur Km 120, San Fernando',
      client_type: 'agricultural_company',
    },
    {
      name: 'Agroexportadora Del Maule S.A.',
      rut: '76987654-K',
      contact_email: 'calidad@agromaule.cl',
      phone: '+56911223344',
      address: 'Av. Circunvalacion 450, Talca',
      client_type: 'agricultural_company',
    },
    // farmer (1)
    {
      name: 'Juan Riquelme — Productor',
      rut: '12345678-5',
      contact_email: 'juan.riquelme@campo.cl',
      phone: '+56955443322',
      address: 'Parcela 12, Lote B, Requinoa',
      client_type: 'farmer',
    },
    // research_institution
    {
      name: 'INIA — Instituto de Investigaciones Agropecuarias',
      rut: '71567890-3',
      contact_email: 'lab@inia.cl',
      phone: '+56999887766',
      address: 'Av. Vicente Mendez 525, Chillan',
      client_type: 'research_institution',
    },
    // government_agency
    {
      name: 'SAG — Servicio Agricola y Ganadero',
      rut: '61987654-1',
      contact_email: 'laboratorio@sag.gob.cl',
      phone: '+56966778899',
      address: 'Av. Bulnes 140, Santiago',
      client_type: 'government_agency',
    },
    // consultant
    {
      name: 'AgroConsultores SpA',
      rut: '76543210-6',
      contact_email: 'info@agroconsultores.cl',
      phone: '+56955443311',
      address: 'Carmen 350, Oficina 4, Rancagua',
      client_type: 'consultant',
    },
  ]
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════╗')
  console.log('║   SEMILLA KPI — Datos productivos       ║')
  console.log('║   5 tipos de cliente con perfiles       ║')
  console.log('╚══════════════════════════════════════════╝\n')

  // ── 0. Verificar si ya hay datos de semilla ──
  const { count } = await supabase
    .from('samples')
    .select('id', { count: 'exact', head: true })
    .like('code', `${SEED_PREFIX}%`)

  if (count && count > 0) {
    console.log(`Ya existen ${count} muestras con prefijo "${SEED_PREFIX}".`)
    console.log('Para regenerar, eliminalas primero desde el SQL Editor:\n')
    console.log(`  DELETE FROM public.results WHERE sample_id IN (SELECT id FROM public.samples WHERE code LIKE '${SEED_PREFIX}%');`)
    console.log(`  DELETE FROM public.samples WHERE code LIKE '${SEED_PREFIX}%';\n`)
    process.exit(0)
  }

  // ── 1. Crear clientes ──
  console.log('1. Creando clientes...')
  const clientSeeds = generateClients()
  // Mapa: indice de CLIENT_TYPES → array de client ids de ese tipo
  const clientIdsByType: Record<string, string[]> = {}
  for (const ct of CLIENT_TYPES) {
    clientIdsByType[ct] = []
  }

  // Agregar el cliente existente como agricultural_company
  const { data: existingClient } = await supabase
    .from('clients')
    .select('id, client_type')
    .eq('id', '4780aaac-63f1-448a-a384-71bcc5cdb586')
    .single()

  if (existingClient) {
    const ect = existingClient.client_type || 'agricultural_company'
    if (!clientIdsByType[ect]) clientIdsByType[ect] = []
    clientIdsByType[ect].push(existingClient.id)
    console.log(`   [existente] Agricola Del Valle S.A. (${existingClient.id}) [${ect}]`)
  }

  for (const c of clientSeeds) {
    const { data, error } = await supabase
      .from('clients')
      .insert({
        company_id: COMPANY_ID,
        ...c,
      })
      .select('id')
      .single()

    if (error) {
      console.error(`   ERROR: ${c.name} -> ${error.message}`)
      continue
    }
    if (!clientIdsByType[c.client_type]) clientIdsByType[c.client_type] = []
    clientIdsByType[c.client_type].push(data.id)
    console.log(`   ${c.name} (${data.id}) [${c.client_type}]`)
  }

  // Contador por tipo para round-robin dentro de cada tipo
  const typeCounters: Record<string, number> = {}
  for (const ct of CLIENT_TYPES) typeCounters[ct] = 0

  function getClientIdForType(clientTypeIdx: number): string {
    const ct = CLIENT_TYPES[clientTypeIdx]
    const ids = clientIdsByType[ct]
    if (!ids || ids.length === 0) {
      // fallback: usar cualquier cliente disponible
      for (const t of CLIENT_TYPES) {
        if (clientIdsByType[t]?.length > 0) return clientIdsByType[t][0]
      }
      throw new Error('No hay clientes disponibles')
    }
    const id = ids[typeCounters[ct] % ids.length]
    typeCounters[ct]++
    return id
  }

  // ── 2. Generar configs y crear muestras ──
  console.log(`\n2. Creando muestras (prefix: ${SEED_PREFIX})...`)
  const configs = generateConfigs()
  const sampleIds: string[] = []
  let insertedSamples = 0

  for (let i = 0; i < configs.length; i++) {
    const c = configs[i]
    const clientId = getClientIdForType(c.clientTypeIdx)

    const { data, error } = await supabase
      .from('samples')
      .insert({
        company_id: COMPANY_ID,
        client_id: clientId,
        code: c.code,
        species: DATA.species[c.speciesIdx].name,
        variety: c.variety,
        status: c.status,
        sla_type: c.sla.sla_type,
        sla_status: c.sla.sla_status,
        received_at: dateISO(c.daysAgo, 9 + (i % 7), (i * 7) % 60),
        received_date: dateOnlyISO(c.daysAgo),
        registered_date: dateOnlyISO(c.daysAgo),
        created_at: dateISO(c.daysAgo, 10 + (i % 5), (i * 13) % 60),
        delivery_method: DATA.deliveryMethods[i % DATA.deliveryMethods.length],
        taken_by: i % 3 === 0 ? 'client' : 'lab',
        region: ['O\'Higgins', 'Maule', 'Metropolitana', 'Valparaiso'][i % 4],
        locality: ['Rengo', 'Talca', 'Paine', 'San Felipe', 'Requinoa'][i % 5],
      })
      .select('id')
      .single()

    if (error) {
      console.error(`   ERROR ${c.code}: ${error.message}`)
      continue
    }
    sampleIds.push(data.id)
    insertedSamples++
  }
  console.log(`   ${insertedSamples} muestras creadas`)

  // ── 3. Crear resultados ──
  console.log(`\n3. Creando resultados...`)
  let insertedResults = 0

  for (let i = 0; i < configs.length; i++) {
    const c = configs[i]
    if (!c.hasResult) continue
    if (i >= sampleIds.length) continue

    const sampleId = sampleIds[i]

    // TAT realista: 4h a 160h (1-7 dias habiles)
    const tatHours = Math.max(4, Math.round(
      (Math.random() + Math.random() + Math.random()) / 3 * 120 + 8
    ) * 10) / 10

    const valDate = new Date()
    valDate.setDate(valDate.getDate() - c.daysAgo + Math.floor(tatHours / 24))

    const performedAt = dateISO(c.daysAgo, 12, 0)

    const conclusions: Record<string, string> = {
      positive: `Se detecto presencia de ${c.pathogen.name} en la muestra analizada.`,
      negative: `No se detecto ${c.pathogen.name} en la muestra analizada.`,
      inconclusive: `Resultado no concluyente. Se recomienda repetir el analisis con nueva muestra.`,
    }

    const severities = c.resultType === 'positive'
      ? (['low', 'moderate', 'high', 'severe'] as const)[i % 4]
      : null

    const { error } = await supabase
      .from('results')
      .insert({
        sample_id: sampleId,
        test_area: c.area,
        result_type: c.resultType,
        pathogen_type: c.pathogen.type,
        pathogen_identified: c.pathogen.name,
        status: 'validated',
        performed_by: USER_ID,
        validated_by: USER_ID,
        validation_date: valDate.toISOString(),
        performed_at: performedAt,
        created_at: performedAt,
        conclusion: conclusions[c.resultType],
        severity: severities,
        confidence: (['high', 'medium', 'high', 'low'] as const)[i % 4],
        methodology: ['PCR', 'ELISA', 'Microscopia', 'Cultivo in vitro'][i % 4],
      })

    if (error) {
      console.error(`   ERROR resultado ${c.code}: ${error.message}`)
      continue
    }
    insertedResults++
  }
  console.log(`   ${insertedResults} resultados creados`)

  // ── 4. Resumen ──
  const slaStats = { on_time: 0, at_risk: 0, breached: 0 }
  const areaStats: Record<string, number> = {}
  const typeStats: Record<string, number> = {}
  const clientTypeStats: Record<string, number> = {}
  for (const c of configs) {
    slaStats[c.sla.sla_status as keyof typeof slaStats]++
    areaStats[c.area] = (areaStats[c.area] || 0) + 1
    if (c.hasResult) typeStats[c.resultType] = (typeStats[c.resultType] || 0) + 1
    const ct = CLIENT_TYPES[c.clientTypeIdx]
    clientTypeStats[ct] = (clientTypeStats[ct] || 0) + 1
  }

  console.log(`\n╔══════════════════════════════════════════╗`)
  console.log(`║   SEMILLA COMPLETADA                     ║`)
  console.log(`╠══════════════════════════════════════════╣`)
  console.log(`║  Muestras:     ${String(insertedSamples).padStart(4)}                       ║`)
  console.log(`║  Resultados:   ${String(insertedResults).padStart(4)}                       ║`)
  console.log(`║  Tipos cliente:${String(Object.keys(clientTypeStats).length).padStart(4)}                       ║`)
  console.log(`╠══════════════════════════════════════════╣`)
  console.log(`║  SLA on_time:  ${String(slaStats.on_time).padStart(4)} (${Math.round(slaStats.on_time / configs.length * 100)}%)                  ║`)
  console.log(`║  SLA at_risk:  ${String(slaStats.at_risk).padStart(4)} (${Math.round(slaStats.at_risk / configs.length * 100)}%)                  ║`)
  console.log(`║  SLA breached: ${String(slaStats.breached).padStart(4)} (${Math.round(slaStats.breached / configs.length * 100)}%)                  ║`)
  for (const [area, cnt] of Object.entries(areaStats)) {
    console.log(`║  ${area.padEnd(14)} ${String(cnt).padStart(4)}                       ║`)
  }
  console.log(`╠══════════════════════════════════════════╣`)
  for (const [ct, cnt] of Object.entries(clientTypeStats)) {
    console.log(`║  ${ct.padEnd(25)} ${String(cnt).padStart(4)}                       ║`)
  }
  for (const [type, cnt] of Object.entries(typeStats)) {
    console.log(`║  Result ${type.padEnd(8)} ${String(cnt).padStart(4)}                       ║`)
  }
  console.log(`╚══════════════════════════════════════════╝`)
}

main().catch((err) => {
  console.error('Error inesperado:', err)
  process.exit(1)
})
