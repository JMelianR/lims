import { NextResponse, type NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth/api-auth'
import { CLIENT_TYPES, CLIENT_TYPE_LABELS } from '@/lib/constants/client-types'
import type { ClientTypeCounts } from '@/types/analytics'

const MONTHS_BACK = 3

/** Etiquetas para valores típicos de `test_area` (tipo de análisis). */
const ANALYSIS_AREA_LABELS: Record<string, string> = {
  nematologia: 'Nematología',
  fitopatologia: 'Fitopatología',
  virologia: 'Virología',
  deteccion_precoz: 'Detección precoz'
}

function formatTestAreaLabel(raw: string | null): { typeKey: string; label: string } {
  if (raw === null || String(raw).trim() === '') {
    return { typeKey: '__uncategorized__', label: 'Sin especificar' }
  }
  const trimmed = String(raw).trim()
  const normalized = trimmed.toLowerCase()
  const label =
    ANALYSIS_AREA_LABELS[normalized] ??
    normalized
      .split('_')
      .filter(Boolean)
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(' ')
  return { typeKey: normalized, label }
}

function rollingMonthKeysUtc(): string[] {
  const keys: string[] = []
  const now = new Date()
  for (let i = MONTHS_BACK; i >= 0; i--) {
    const reference = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    keys.push(
      `${reference.getUTCFullYear()}-${String(reference.getUTCMonth() + 1).padStart(2, '0')}`
    )
  }
  return keys
}

function formatMonthLabel(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split('-')
  const year = Number(yearStr)
  const month = Number(monthStr)
  const date = new Date(year, month - 1, 1)
  return new Intl.DateTimeFormat('es', { month: 'short', year: 'numeric' }).format(date)
}

function monthKeyFromTimestamp(iso: string | null): string | null {
  if (!iso) return null
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return null
  return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, '0')}`
}

function monthKeyFromReceivedDate(receivedDate: string | null): string | null {
  if (!receivedDate || typeof receivedDate !== 'string') return null
  const trimmed = receivedDate.trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 7)
  }
  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return null
  return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, '0')}`
}

/** Tiempo de ingreso de la muestra al laboratorio (ms desde epoch). */
function sampleIngressTimeMs(sample: {
  received_at: string | null
  received_date: string | null
} | null): number | null {
  if (!sample) return null
  if (sample.received_at) {
    const parsed = Date.parse(sample.received_at)
    return Number.isNaN(parsed) ? null : parsed
  }
  if (sample.received_date) {
    const raw = sample.received_date.trim()
    let parsed = Date.parse(raw)
    if (!Number.isNaN(parsed)) return parsed
    parsed = Date.parse(`${raw}T12:00:00.000Z`)
    return Number.isNaN(parsed) ? null : parsed
  }
  return null
}

type SampleIngressSlice = {
  received_at: string | null
  received_date: string | null
}

type ValidatedLeadRow = {
  validation_date: string | null
  samples: SampleIngressSlice | SampleIngressSlice[] | null
}

function computeAverageValidationLeadHours(rows: ValidatedLeadRow[]): { averageHours: number; resultCount: number } {
  let totalHours = 0
  let usedCount = 0
  for (const row of rows) {
    const sampleRaw = row.samples
    const sample = Array.isArray(sampleRaw) ? sampleRaw[0] ?? null : sampleRaw
    const ingressMs = sampleIngressTimeMs(sample)
    const validationMs = row.validation_date ? Date.parse(row.validation_date) : NaN
    if (ingressMs === null || Number.isNaN(validationMs)) continue
    const deltaMs = validationMs - ingressMs
    if (deltaMs < 0) continue
    totalHours += deltaMs / (1000 * 60 * 60)
    usedCount += 1
  }
  if (usedCount === 0) {
    return { averageHours: 0, resultCount: 0 }
  }
  return {
    averageHours: Math.round((totalHours / usedCount) * 10) / 10,
    resultCount: usedCount
  }
}

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
    if (error) {
      throw error
    }
    const chunk = data ?? []
    accumulated.push(...chunk)
    if (chunk.length < pageSize) break
    fromInclusive += pageSize
  }
  return accumulated
}

// ── Resolver tipos de cliente ──

function resolveClientTypes(raw: string | null): string[] {
  if (!raw || raw === 'all' || raw.trim() === '') return CLIENT_TYPES as unknown as string[]
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter((t) => CLIENT_TYPES.includes(t as typeof CLIENT_TYPES[number]))
}

function extractClientType(clientsRaw: any): string {
  if (!clientsRaw) return 'sin_tipo'
  const client = Array.isArray(clientsRaw) ? clientsRaw[0] : clientsRaw
  return client?.client_type || 'sin_tipo'
}

export const GET = withAuth(async (request, { user, supabase }) => {
  try {
    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single()

    const companyId = userData?.company_id ?? undefined

    const { searchParams } = new URL(request.url)
    const clientTypes = resolveClientTypes(searchParams.get('client_type'))
    const isFiltered = clientTypes.length < CLIENT_TYPES.length

    const monthSequence = rollingMonthKeysUtc()
    const oldestKey = monthSequence[0]
    const [oldestYearStr, oldestMonthStr] = oldestKey.split('-')
    const rangeStartIso = new Date(
      Date.UTC(Number(oldestYearStr), Number(oldestMonthStr) - 1, 1, 0, 0, 0, 0)
    ).toISOString()

    // ── samplesByMonth ──

    type SampleMonthRow = {
      created_at: string | null
      received_date: string | null
      clients: { client_type: string | null } | { client_type: string | null }[] | null
    }

    const sampleRows = await fetchAllPages<SampleMonthRow>(
      async (fromInclusive, toInclusive) => {
        let query = supabase
          .from('samples')
          .select('created_at, received_date, client_id, clients(client_type)')
          .gte('created_at', rangeStartIso)
          .range(fromInclusive, toInclusive)

        if (companyId) {
          query = query.eq('company_id', companyId)
        }

        return query
      }
    )

    const countsByMonth = new Map<string, number>()
    const countsByMonthByType = new Map<string, ClientTypeCounts>()
    for (const key of monthSequence) {
      countsByMonth.set(key, 0)
      countsByMonthByType.set(key, {})
    }

    for (const row of sampleRows) {
      const ct = extractClientType(row.clients)
      if (isFiltered && !clientTypes.includes(ct)) continue

      let key = monthKeyFromTimestamp(row.created_at)
      if (!key || !countsByMonth.has(key)) {
        key = monthKeyFromReceivedDate(row.received_date)
      }
      if (key && countsByMonth.has(key)) {
        countsByMonth.set(key, (countsByMonth.get(key) ?? 0) + 1)
        const byType = countsByMonthByType.get(key)!
        byType[ct as keyof ClientTypeCounts] = (byType[ct as keyof ClientTypeCounts] ?? 0) + 1
      }
    }

    const samplesByMonth = monthSequence.map((monthKey) => ({
      monthKey,
      label: formatMonthLabel(monthKey),
      count: countsByMonth.get(monthKey) ?? 0,
      byClientType: countsByMonthByType.get(monthKey) ?? {},
    }))

    // ── resultsByType ──

    type ResultTypeRow = {
      test_area: string | null
      samples: {
        clients: { client_type: string | null } | { client_type: string | null }[] | null
      } | { clients: { client_type: string | null } | { client_type: string | null }[] | null }[] | null
    }

    const resultRows = await fetchAllPages<ResultTypeRow>(
      async (fromInclusive, toInclusive) => {
        if (companyId) {
          return supabase
            .from('results')
            .select('test_area, samples!inner(company_id, client_id, clients(client_type))')
            .eq('samples.company_id', companyId)
            .range(fromInclusive, toInclusive)
        }
        return supabase
          .from('results')
          .select('test_area, samples(client_id, clients(client_type))')
          .range(fromInclusive, toInclusive)
      }
    )

    const analysisTypeCounts = new Map<string, { label: string; count: number; byClientType: ClientTypeCounts }>()
    for (const row of resultRows) {
      const sampleRaw = row.samples
      const sample = Array.isArray(sampleRaw) ? sampleRaw[0] ?? null : sampleRaw
      const ct = extractClientType((sample as any)?.clients)
      if (isFiltered && !clientTypes.includes(ct)) continue

      const { typeKey, label } = formatTestAreaLabel(row.test_area)
      const existing = analysisTypeCounts.get(typeKey)
      if (existing) {
        existing.count += 1
        existing.byClientType[ct as keyof ClientTypeCounts] =
          (existing.byClientType[ct as keyof ClientTypeCounts] ?? 0) + 1
      } else {
        const byClientType: ClientTypeCounts = {}
        byClientType[ct as keyof ClientTypeCounts] = 1
        analysisTypeCounts.set(typeKey, { label, count: 1, byClientType })
      }
    }

    const resultsByType = Array.from(analysisTypeCounts.entries())
      .map(([typeKey, meta]) => ({
        typeKey,
        label: meta.label,
        count: meta.count,
        byClientType: meta.byClientType,
      }))
      .sort((a, b) => b.count - a.count)

    // ── averageLeadTimeHours ──

    const validatedLeadRows = (await fetchAllPages<ValidatedLeadRow>(async (fromInclusive, toInclusive) => {
      if (companyId) {
        return supabase
          .from('results')
          .select('validation_date, samples!inner(received_at, received_date, company_id)')
          .eq('status', 'validated')
          .not('validation_date', 'is', null)
          .eq('samples.company_id', companyId)
          .range(fromInclusive, toInclusive)
      }
      return supabase
        .from('results')
        .select('validation_date, samples(received_at, received_date)')
        .eq('status', 'validated')
        .not('validation_date', 'is', null)
        .range(fromInclusive, toInclusive)
    })) as ValidatedLeadRow[]

    const { averageHours, resultCount } = computeAverageValidationLeadHours(validatedLeadRows)

    return NextResponse.json({
      samplesByMonth,
      resultsByType,
      averageLeadTimeHours: averageHours,
      averageLeadTimeResultCount: resultCount,
    })
  } catch (error) {
    console.error('Error fetching chart statistics:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})
