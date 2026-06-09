import { NextResponse } from 'next/server'
import { withAuth, type SupabaseServerClient } from '@/lib/auth/api-auth'

// ── Tipos ───────────────────────────────────────────────────────────

interface AlertaSLA {
  id: string
  code: string
  species: string
  sla_status: string
  sla_type: string
  due_date: string | null
  status: string
  client_name: string
}

interface CuelloBotella {
  status: string
  label: string
  cantidad: number
  muestras: {
    id: string
    code: string
    species: string
    dias_estancado: number
    client_name: string
  }[]
}

interface ActividadReciente {
  id: number
  accion: string
  usuario: string
  tabla: string | null
  muestra_id: string | null
  muestra_codigo: string | null
  fecha: string
}

interface MonitorData {
  alertas_sla: AlertaSLA[]
  cuellos_botella: CuelloBotella[]
  actividad_reciente: ActividadReciente[]
}

// ── Labels ──────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  received: 'Recibida',
  processing: 'En proceso',
  microscopy: 'Microscopía',
  isolation: 'Aislamiento',
  identification: 'Identificación',
  molecular_analysis: 'Análisis molecular',
  validation: 'Validación',
  completed: 'Completada',
}

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status
}

// ── Helpers ─────────────────────────────────────────────────────────

const BOTTLENECK_DAYS = 5
const ACTIVIDAD_LIMIT = 20

// ── Endpoint ────────────────────────────────────────────────────────

export const GET = withAuth(async (_request, { user, supabase }) => {
  try {
    // ── Resolver company_id ──
    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single()

    const companyId = userData?.company_id ?? undefined

    // ═══════════════════════════════════════════════════════════════
    // 1. ALERTAS SLA
    // ═══════════════════════════════════════════════════════════════

    const slaQuery = supabase
      .from('samples')
      .select('id, code, species, sla_status, sla_type, due_date, status, clients!inner(name)')
      .in('sla_status', ['at_risk', 'breached'])
      .neq('status', 'completed')
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(20)

    if (companyId) {
      slaQuery.eq('company_id', companyId)
    }

    const { data: slaRows, error: slaError } = await slaQuery

    if (slaError) {
      console.error('Error fetching SLA alerts:', slaError)
    }

    const alertas_sla: AlertaSLA[] = (slaRows ?? []).map((row: any) => ({
      id: row.id,
      code: row.code,
      species: row.species ?? '—',
      sla_status: row.sla_status,
      sla_type: row.sla_type,
      due_date: row.due_date,
      status: row.status,
      client_name: (row as any).clients?.[0]?.name || (row as any).clients?.name || '—',
    }))

    // ═══════════════════════════════════════════════════════════════
    // 2. CUELLOS DE BOTELLA
    // ═══════════════════════════════════════════════════════════════

    // Obtener muestras activas con su última transición de estado
    let samplesQuery = supabase
      .from('samples')
      .select('id, code, species, status, created_at, clients!inner(name)')
      .neq('status', 'completed')

    if (companyId) {
      samplesQuery = samplesQuery.eq('company_id', companyId)
    }

    const { data: samples, error: samplesError } = await samplesQuery

    if (samplesError) {
      console.error('Error fetching samples for bottlenecks:', samplesError)
    }

    // Obtener la última transición para cada muestra activa
    const activeSampleIds = (samples ?? []).map((s) => s.id)

    let allTransitions: any[] = []
    if (activeSampleIds.length > 0) {
      // Consultar en lotes de 100 para evitar URL demasiado larga
      const batchSize = 100
      for (let i = 0; i < activeSampleIds.length; i += batchSize) {
        const batch = activeSampleIds.slice(i, i + batchSize)
        const { data: batchData, error: batchError } = await supabase
          .from('sample_status_transitions')
          .select('sample_id, to_status, at')
          .in('sample_id', batch)
          .order('at', { ascending: false })

        if (!batchError && batchData) {
          allTransitions = allTransitions.concat(batchData)
        }
      }
    }

    // Agrupar: para cada muestra, quedarse con la transición más reciente
    const latestTransitionBySample = new Map<string, { to_status: string; at: string }>()
    for (const t of allTransitions) {
      if (!latestTransitionBySample.has(t.sample_id)) {
        latestTransitionBySample.set(t.sample_id, { to_status: t.to_status, at: t.at })
      }
    }

    // Detectar cuellos de botella (> BOTTLENECK_DAYS sin cambiar de estado)
    const now = new Date()
    const stuckByStatus = new Map<string, CuelloBotella['muestras']>()

    for (const sample of (samples ?? [])) {
      const lastTransition = latestTransitionBySample.get(sample.id)
      // Si hay transición, usar su fecha; si no, usar created_at de la muestra como referencia
      const lastChangeAt = lastTransition?.at
        ? new Date(lastTransition.at)
        : (sample as any).created_at
          ? new Date((sample as any).created_at)
          : null

      if (!lastChangeAt) continue

      const daysSinceChange = (now.getTime() - lastChangeAt.getTime()) / (1000 * 60 * 60 * 24)

      if (daysSinceChange >= BOTTLENECK_DAYS) {
        const st = sample.status
        if (!stuckByStatus.has(st)) {
          stuckByStatus.set(st, [])
        }
        stuckByStatus.get(st)!.push({
          id: sample.id,
          code: sample.code,
          species: sample.species ?? '—',
          dias_estancado: Math.round(daysSinceChange),
          client_name: (sample as any).clients?.[0]?.name || (sample as any).clients?.name || '—',
        })
      }
    }

    const cuellos_botella: CuelloBotella[] = Array.from(stuckByStatus.entries())
      .map(([status, muestras]) => ({
        status,
        label: statusLabel(status),
        cantidad: muestras.length,
        muestras: muestras.sort((a, b) => b.dias_estancado - a.dias_estancado).slice(0, 5),
      }))
      .sort((a, b) => b.cantidad - a.cantidad)

    // ═══════════════════════════════════════════════════════════════
    // 3. ACTIVIDAD RECIENTE
    // ═══════════════════════════════════════════════════════════════

    const logQuery = supabase
      .from('action_logs')
      .select('id, action, user_id, target_table, target_id, created_at, users!inner(name)')
      .order('created_at', { ascending: false })
      .limit(ACTIVIDAD_LIMIT)

    if (companyId) {
      logQuery.eq('company_id', companyId)
    }

    const { data: logRows, error: logError } = await logQuery

    if (logError) {
      console.error('Error fetching action logs:', logError)
    }

    // Resolver código de muestra para logs que referencian samples
    const sampleTargetIds = (logRows ?? [])
      .filter((l: any) => l.target_table === 'samples' && l.target_id)
      .map((l: any) => l.target_id)

    const sampleCodeMap = new Map<string, string>()
    if (sampleTargetIds.length > 0) {
      const { data: targetSamples } = await supabase
        .from('samples')
        .select('id, code')
        .in('id', sampleTargetIds)

      for (const s of (targetSamples ?? [])) {
        sampleCodeMap.set(s.id, s.code)
      }
    }

    const actividad_reciente: ActividadReciente[] = (logRows ?? []).map((row: any) => ({
      id: row.id,
      accion: row.action,
      usuario: (row as any).users?.[0]?.name || (row as any).users?.name || '—',
      tabla: row.target_table,
      muestra_id: row.target_id,
      muestra_codigo: row.target_table === 'samples' && row.target_id
        ? (sampleCodeMap.get(row.target_id) ?? null)
        : null,
      fecha: row.created_at,
    }))

    // ── Responder ──────────────────────────────────────────────────

    const result: MonitorData = {
      alertas_sla,
      cuellos_botella,
      actividad_reciente,
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error en monitor de laboratorio:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
})
