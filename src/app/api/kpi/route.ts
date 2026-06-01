import { NextResponse, type NextRequest } from 'next/server'
import { withAuth, type SupabaseServerClient } from '@/lib/auth/api-auth'
import { CLIENT_TYPES, CLIENT_TYPE_LABELS } from '@/lib/constants/client-types'
import type {
  TatByClientType,
  PositivityByClientType,
  SlaByClientType,
  ThroughputByClientType,
} from '@/types/analytics'

const ANALYSIS_AREA_LABELS: Record<string, string> = {
  nematologia: 'Nematología',
  fitopatologia: 'Fitopatología',
  virologia: 'Virología',
  deteccion_precoz: 'Detección precoz'
}

function formatAreaLabel(raw: string | null): string {
  if (!raw || raw.trim() === '') return 'Sin especificar'
  return ANALYSIS_AREA_LABELS[raw.toLowerCase().trim()] ?? raw.trim()
}

function formatClientTypeLabel(raw: string | null): string {
  if (!raw || raw.trim() === '') return 'Sin especificar'
  return CLIENT_TYPE_LABELS[raw.trim() as keyof typeof CLIENT_TYPE_LABELS] ?? raw.trim()
}

// ---------- helpers ----------

async function fetchAllPages<T>(
  fetchRange: (
    fromInclusive: number,
    toInclusive: number
  ) => Promise<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const pageSize = 1000
  let fromInclusive = 0
  const accumulated: T[] = []
  while (true) {
    const toInclusive = fromInclusive + pageSize - 1
    const { data, error } = await fetchRange(fromInclusive, toInclusive)
    if (error) throw error
    const chunk = data ?? []
    accumulated.push(...chunk)
    if (chunk.length < pageSize) break
    fromInclusive += pageSize
  }
  return accumulated
}

function percentiles(sorted: number[]): { p50: number; p90: number; p95: number } {
  const n = sorted.length
  if (n === 0) return { p50: 0, p90: 0, p95: 0 }
  return {
    p50: sorted[Math.floor(n * 0.5)],
    p90: sorted[Math.floor(n * 0.9)],
    p95: sorted[Math.floor(n * 0.95)]
  }
}

function safeIngressMs(row: { received_at: string | null; received_date: string | null } | null): number | null {
  if (!row) return null
  if (row.received_at) {
    const ms = Date.parse(row.received_at)
    return Number.isNaN(ms) ? null : ms
  }
  if (row.received_date) {
    const ms = Date.parse(`${row.received_date.trim()}T12:00:00.000Z`)
    return Number.isNaN(ms) ? null : ms
  }
  return null
}

// ---------- Resolver tipos de cliente ----------

function resolveClientTypes(raw: string | null): string[] {
  if (!raw || raw === 'all' || raw.trim() === '') return CLIENT_TYPES as unknown as string[]
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter((t) => CLIENT_TYPES.includes(t as typeof CLIENT_TYPES[number]))
}

// ---------- metric: tat (turnaround time) ----------

type TatRow = {
  validation_date: string | null
  test_area: string | null
  samples: {
    received_at: string | null
    received_date: string | null
    clients: { client_type: string | null } | { client_type: string | null }[] | null
  } | { received_at: string | null; received_date: string | null }[] | null
}

async function computeTat(
  supabase: SupabaseServerClient,
  companyId: string | undefined,
  clientTypes: string[],
) {
  const isFiltered = clientTypes.length < CLIENT_TYPES.length
  const rows = await fetchAllPages<TatRow>(async (from, to) => {
    if (companyId) {
      return supabase
        .from('results')
        .select('validation_date, test_area, samples!inner(received_at, received_date, company_id, client_id, clients(client_type))')
        .not('validation_date', 'is', null)
        .eq('samples.company_id', companyId)
        .range(from, to)
    }
    return supabase
      .from('results')
      .select('validation_date, test_area, samples(received_at, received_date, client_id, clients(client_type))')
      .not('validation_date', 'is', null)
      .range(from, to)
  })

  const globalLeadHours: number[] = []
  const byArea: Record<string, number[]> = {}
  const byClientType: Record<string, number[]> = {}

  for (const row of rows) {
    const sampleRaw = row.samples
    const sample = Array.isArray(sampleRaw) ? sampleRaw[0] ?? null : sampleRaw
    const ingressMs = safeIngressMs(sample)
    const valMs = row.validation_date ? Date.parse(row.validation_date) : NaN
    if (ingressMs === null || Number.isNaN(valMs)) continue
    const hours = (valMs - ingressMs) / (1000 * 60 * 60)
    if (hours < 0) continue

    // Resolver client_type via el join
    const clientsRaw = sample ? (sample as any).clients : null
    const client = Array.isArray(clientsRaw) ? clientsRaw[0] : clientsRaw
    const ct = client?.client_type || 'sin_tipo'

    // Si estamos filtrando, saltar muestras que no coinciden
    if (isFiltered && !clientTypes.includes(ct)) continue

    globalLeadHours.push(hours)

    const areaKey = formatAreaLabel(row.test_area)
    if (!byArea[areaKey]) byArea[areaKey] = []
    byArea[areaKey].push(hours)

    if (!byClientType[ct]) byClientType[ct] = []
    byClientType[ct].push(hours)
  }

  globalLeadHours.sort((a, b) => a - b)

  const areas: Record<string, { label: string; count: number; p50: number; p90: number; p95: number; avg: number }> = {}
  for (const [key, values] of Object.entries(byArea)) {
    values.sort((a, b) => a - b)
    areas[key] = {
      label: key,
      count: values.length,
      ...percentiles(values),
      avg: values.length > 0 ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : 0
    }
  }

  // Construir desglose por tipo de cliente
  const clientTypeBreakdown: TatByClientType[] = Object.entries(byClientType)
    .map(([ct, values]) => {
      values.sort((a, b) => a - b)
      return {
        clientType: ct,
        label: formatClientTypeLabel(ct),
        count: values.length,
        ...percentiles(values),
        avg: values.length > 0 ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : 0,
      }
    })
    .sort((a, b) => b.count - a.count)

  return {
    unit: 'hours',
    count: globalLeadHours.length,
    ...percentiles(globalLeadHours),
    avg: globalLeadHours.length > 0
      ? Math.round((globalLeadHours.reduce((a, b) => a + b, 0) / globalLeadHours.length) * 10) / 10
      : 0,
    byArea: areas,
    byClientType: clientTypeBreakdown,
  }
}

// ---------- metric: positivity ----------

type PositivityRow = {
  result_type: string | null
  pathogen_type: string | null
  test_area: string | null
  validation_date: string | null
  samples: {
    species: string | null
    clients: { client_type: string | null } | { client_type: string | null }[] | null
  } | { species: string | null }[] | null
}

async function computePositivity(
  supabase: SupabaseServerClient,
  companyId: string | undefined,
  clientTypes: string[],
) {
  const isFiltered = clientTypes.length < CLIENT_TYPES.length
  const rows = await fetchAllPages<PositivityRow>(async (from, to) => {
    if (companyId) {
      return supabase
        .from('results')
        .select('result_type, pathogen_type, test_area, validation_date, samples!inner(species, company_id, client_id, clients(client_type))')
        .eq('samples.company_id', companyId)
        .range(from, to)
    }
    return supabase
      .from('results')
      .select('result_type, pathogen_type, test_area, validation_date, samples(species, client_id, clients(client_type))')
      .range(from, to)
  })

  const byPathogen: Record<string, { total: number; positive: number; negative: number; inconclusive: number }> = {}
  const bySpecies: Record<string, { total: number; positive: number; negative: number; inconclusive: number }> = {}
  const byClientType: Record<string, { total: number; positive: number; negative: number; inconclusive: number }> = {}
  let overallTotal = 0
  let overallPositive = 0
  let overallNegative = 0
  let overallInconclusive = 0

  for (const row of rows) {
    const rt = row.result_type
    const pt = row.pathogen_type || 'sin_especificar'
    const sampleRaw = row.samples
    const sample = Array.isArray(sampleRaw) ? sampleRaw[0] ?? null : sampleRaw
    const sp = (sample as any)?.species || 'sin_especificar'

    // Resolver client_type
    const clientsRaw = sample ? (sample as any).clients : null
    const client = Array.isArray(clientsRaw) ? clientsRaw[0] : clientsRaw
    const ct = client?.client_type || 'sin_tipo'

    if (isFiltered && !clientTypes.includes(ct)) continue

    overallTotal++
    if (rt === 'positive') overallPositive++
    else if (rt === 'negative') overallNegative++
    else if (rt === 'inconclusive') overallInconclusive++

    if (!byPathogen[pt]) byPathogen[pt] = { total: 0, positive: 0, negative: 0, inconclusive: 0 }
    byPathogen[pt].total++
    if (rt === 'positive') byPathogen[pt].positive++
    else if (rt === 'negative') byPathogen[pt].negative++
    else if (rt === 'inconclusive') byPathogen[pt].inconclusive++

    if (!bySpecies[sp]) bySpecies[sp] = { total: 0, positive: 0, negative: 0, inconclusive: 0 }
    bySpecies[sp].total++
    if (rt === 'positive') bySpecies[sp].positive++
    else if (rt === 'negative') bySpecies[sp].negative++
    else if (rt === 'inconclusive') bySpecies[sp].inconclusive++

    if (!byClientType[ct]) byClientType[ct] = { total: 0, positive: 0, negative: 0, inconclusive: 0 }
    byClientType[ct].total++
    if (rt === 'positive') byClientType[ct].positive++
    else if (rt === 'negative') byClientType[ct].negative++
    else if (rt === 'inconclusive') byClientType[ct].inconclusive++
  }

  const fmtRate = (num: number, den: number) => den > 0 ? Math.round((num / den) * 1000) / 10 : 0

  const fmtGroup = (map: Record<string, { total: number; positive: number; negative: number; inconclusive: number }>) =>
    Object.entries(map)
      .map(([key, v]) => ({
        key,
        total: v.total,
        positive: v.positive,
        negative: v.negative,
        inconclusive: v.inconclusive,
        positivityRate: fmtRate(v.positive, v.total)
      }))
      .sort((a, b) => b.total - a.total)

  // Desglose por tipo de cliente
  const clientTypeBreakdown: PositivityByClientType[] = Object.entries(byClientType)
    .map(([ct, v]) => ({
      clientType: ct,
      label: formatClientTypeLabel(ct),
      total: v.total,
      positive: v.positive,
      negative: v.negative,
      inconclusive: v.inconclusive,
      positivityRate: fmtRate(v.positive, v.total),
    }))
    .sort((a, b) => b.total - a.total)

  return {
    overall: {
      total: overallTotal,
      positive: overallPositive,
      negative: overallNegative,
      inconclusive: overallInconclusive,
      positivityRate: fmtRate(overallPositive, overallTotal)
    },
    byPathogen: fmtGroup(byPathogen),
    bySpecies: fmtGroup(bySpecies),
    byClientType: clientTypeBreakdown,
  }
}

// ---------- metric: sla ----------

type SlaRow = {
  sla_status: string | null
  sla_type: string | null
  clients: { client_type: string | null } | { client_type: string | null }[] | null
}

async function computeSla(
  supabase: SupabaseServerClient,
  companyId: string | undefined,
  clientTypes: string[],
) {
  const isFiltered = clientTypes.length < CLIENT_TYPES.length
  const rows = await fetchAllPages<SlaRow>(async (from, to) => {
    const base = supabase.from('samples').select('sla_status, sla_type, client_id, clients(client_type)')
    const query = companyId ? base.eq('company_id', companyId) : base
    return query.range(from, to)
  })

  let onTime = 0, atRisk = 0, breached = 0
  const byType: Record<string, { on_time: number; at_risk: number; breached: number; total: number }> = {}
  const byClientType: Record<string, { on_time: number; at_risk: number; breached: number; total: number }> = {}

  for (const row of rows) {
    // Resolver client_type
    const clientsRaw = row.clients
    const client = Array.isArray(clientsRaw) ? clientsRaw[0] : clientsRaw
    const ct = client?.client_type || 'sin_tipo'

    if (isFiltered && !clientTypes.includes(ct)) continue

    const status = row.sla_status || 'on_time'
    const type = row.sla_type || 'normal'

    if (status === 'on_time') onTime++
    else if (status === 'at_risk') atRisk++
    else if (status === 'breached') breached++

    if (!byType[type]) byType[type] = { on_time: 0, at_risk: 0, breached: 0, total: 0 }
    byType[type][status === 'on_time' ? 'on_time' : status === 'at_risk' ? 'at_risk' : 'breached']++
    byType[type].total++

    if (!byClientType[ct]) byClientType[ct] = { on_time: 0, at_risk: 0, breached: 0, total: 0 }
    byClientType[ct][status === 'on_time' ? 'on_time' : status === 'at_risk' ? 'at_risk' : 'breached']++
    byClientType[ct].total++
  }

  const total = onTime + atRisk + breached
  const fmt = (n: number) => total > 0 ? Math.round((n / total) * 1000) / 10 : 0

  const clientTypeBreakdown: SlaByClientType[] = Object.entries(byClientType)
    .map(([ct, v]) => ({
      clientType: ct,
      label: formatClientTypeLabel(ct),
      total: v.total,
      onTime: v.on_time,
      atRisk: v.at_risk,
      breached: v.breached,
      complianceRate: v.total > 0 ? Math.round((v.on_time / v.total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.total - a.total)

  return {
    total,
    onTime,
    atRisk,
    breached,
    complianceRate: fmt(onTime),
    byType: Object.entries(byType).map(([type, v]) => ({
      type,
      total: v.total,
      onTime: v.on_time,
      atRisk: v.at_risk,
      breached: v.breached,
      complianceRate: fmt(v.on_time)
    })),
    byClientType: clientTypeBreakdown,
  }
}

// ---------- metric: throughput ----------

type ThroughputRow = {
  status: string | null
  created_at: string | null
  clients: { client_type: string | null } | { client_type: string | null }[] | null
}

async function computeThroughput(
  supabase: SupabaseServerClient,
  companyId: string | undefined,
  periodDays: number,
  clientTypes: string[],
) {
  const isFiltered = clientTypes.length < CLIENT_TYPES.length
  const since = new Date()
  since.setDate(since.getDate() - periodDays)
  const sinceIso = since.toISOString()

  const rows = await fetchAllPages<ThroughputRow>(async (from, to) => {
    const base = supabase.from('samples').select('status, created_at, client_id, clients(client_type)').gte('created_at', sinceIso)
    const query = companyId ? base.eq('company_id', companyId) : base
    return query.range(from, to)
  })

  const byDay: Record<string, { received: number; completed: number }> = {}
  const byClientType: Record<string, { received: number; completed: number }> = {}
  let totalReceived = 0
  let totalCompleted = 0

  for (const row of rows) {
    // Resolver client_type
    const clientsRaw = row.clients
    const client = Array.isArray(clientsRaw) ? clientsRaw[0] : clientsRaw
    const ct = client?.client_type || 'sin_tipo'

    if (isFiltered && !clientTypes.includes(ct)) continue

    const day = row.created_at ? row.created_at.slice(0, 10) : null
    if (!day) continue

    if (!byDay[day]) byDay[day] = { received: 0, completed: 0 }
    byDay[day].received++
    totalReceived++

    if (row.status === 'completed') {
      byDay[day].completed++
      totalCompleted++
    }

    if (!byClientType[ct]) byClientType[ct] = { received: 0, completed: 0 }
    byClientType[ct].received++
    if (row.status === 'completed') {
      byClientType[ct].completed++
    }
  }

  const daily = Object.entries(byDay)
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const clientTypeBreakdown: ThroughputByClientType[] = Object.entries(byClientType)
    .map(([ct, v]) => ({
      clientType: ct,
      label: formatClientTypeLabel(ct),
      received: v.received,
      completed: v.completed,
    }))
    .sort((a, b) => b.received - a.received)

  return {
    periodDays,
    totalReceived,
    totalCompleted,
    avgPerDay: periodDays > 0 ? Math.round((totalReceived / periodDays) * 10) / 10 : 0,
    daily,
    byClientType: clientTypeBreakdown,
  }
}

// ---------- main handler ----------

export const GET = withAuth(async (request, { user, supabase }) => {
  try {
    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single()

    const companyId = userData?.company_id ?? undefined

    const { searchParams } = new URL(request.url)
    const metric = searchParams.get('metric') ?? 'tat'
    const periodDays = parseInt(searchParams.get('days') ?? '30', 10)
    const clientTypes = resolveClientTypes(searchParams.get('client_type'))

    switch (metric) {
      case 'tat':
        return NextResponse.json(await computeTat(supabase, companyId, clientTypes))
      case 'positivity':
        return NextResponse.json(await computePositivity(supabase, companyId, clientTypes))
      case 'sla':
        return NextResponse.json(await computeSla(supabase, companyId, clientTypes))
      case 'throughput':
        return NextResponse.json(await computeThroughput(supabase, companyId, Math.min(periodDays, 365), clientTypes))
      default:
        return NextResponse.json({ error: `Unknown metric: ${metric}` }, { status: 400 })
    }
  } catch (error) {
    console.error('Error computing KPI:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})
