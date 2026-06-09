'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  Clock,
  Activity,
  ChevronRight,
  Loader2,
  XCircle,
  FlaskConical,
  User,
  Timer,
} from 'lucide-react'

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

interface MuestraEstancada {
  id: string
  code: string
  species: string
  dias_estancado: number
  client_name: string
}

interface CuelloBotella {
  status: string
  label: string
  cantidad: number
  muestras: MuestraEstancada[]
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

// ── Helpers ─────────────────────────────────────────────────────────

function fechaRelativa(iso: string): string {
  const fecha = new Date(iso)
  const ahora = new Date()
  const diffMs = ahora.getTime() - fecha.getTime()
  const diffMin = Math.floor(diffMs / (1000 * 60))
  const diffHrs = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMin < 1) return 'Ahora'
  if (diffMin < 60) return `Hace ${diffMin} min`
  if (diffHrs < 24) return `Hace ${diffHrs} h`
  if (diffDias === 1) return 'Ayer'
  return `Hace ${diffDias} días`
}

function fechaCorta(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function accionIcono(accion: string) {
  const lower = accion.toLowerCase()
  if (lower.includes('creó') || lower.includes('creo') || lower.includes('insert')) return '➕'
  if (lower.includes('actualiz') || lower.includes('edit') || lower.includes('update')) return '✏️'
  if (lower.includes('elimin') || lower.includes('borr') || lower.includes('delete')) return '🗑️'
  if (lower.includes('valid')) return '✅'
  if (lower.includes('gener')) return '📄'
  return '📋'
}

// ── Componente ──────────────────────────────────────────────────────

export function MonitorLaboratorio() {
  const [data, setData] = useState<MonitorData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMonitor = useCallback(async () => {
    try {
      const response = await fetch('/api/dashboard/monitor')
      if (!response.ok) {
        throw new Error(`Error ${response.status}`)
      }
      const payload = await response.json()
      setData(payload)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar el monitor')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMonitor()
  }, [fetchMonitor])

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="space-y-2">
              <div className="h-3 bg-gray-100 rounded w-full"></div>
              <div className="h-3 bg-gray-100 rounded w-3/4"></div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-700 text-sm">No se pudo cargar el monitor: {error}</p>
      </div>
    )
  }

  if (!data) return null

  const { alertas_sla, cuellos_botella, actividad_reciente } = data

  return (
    <div className="space-y-6">
      {/* ═════════════════════════════════════════════════════════════ */}
      {/* 1. ALERTAS SLA                                                */}
      {/* ═════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <h3 className="font-semibold text-gray-900">Alertas SLA</h3>
            {alertas_sla.length > 0 && (
              <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-red-100 text-red-700 text-xs font-bold">
                {alertas_sla.length}
              </span>
            )}
          </div>
          <Link
            href="/samples"
            className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1"
          >
            Ver todas las muestras <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        {alertas_sla.length === 0 ? (
          <div className="p-6 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-50 mb-3">
              <CheckCircleIcon />
            </div>
            <p className="text-sm font-medium text-gray-700">Sin alertas</p>
            <p className="text-xs text-gray-500 mt-1">Todas las muestras están dentro del plazo SLA.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-500 border-b border-gray-100">
                  <th className="py-2 px-4">Código</th>
                  <th className="py-2 px-2">Especie</th>
                  <th className="py-2 px-2">Cliente</th>
                  <th className="py-2 px-2">Estado SLA</th>
                  <th className="py-2 px-2">Vencimiento</th>
                  <th className="py-2 px-2">Etapa actual</th>
                </tr>
              </thead>
              <tbody>
                {alertas_sla.map((a) => (
                  <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="py-2 px-4 font-medium text-gray-900">{a.code}</td>
                    <td className="py-2 px-2 text-gray-600 max-w-[120px] truncate">{a.species}</td>
                    <td className="py-2 px-2 text-gray-600 max-w-[140px] truncate">{a.client_name}</td>
                    <td className="py-2 px-2">
                      {a.sla_status === 'breached' ? (
                        <span className="inline-flex items-center gap-1 text-red-700">
                          <XCircle className="h-3.5 w-3.5" /> Vencida
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-yellow-700">
                          <AlertTriangle className="h-3.5 w-3.5" /> En riesgo
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-gray-500 tabular-nums">{fechaCorta(a.due_date)}</td>
                    <td className="py-2 px-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                        {a.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* 2. CUELLOS DE BOTELLA                                         */}
      {/* ═════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Timer className="h-5 w-5 text-yellow-500" />
            <h3 className="font-semibold text-gray-900">Cuellos de botella</h3>
            {cuellos_botella.length > 0 && (
              <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-yellow-100 text-yellow-700 text-xs font-bold">
                {cuellos_botella.reduce((sum, c) => sum + c.cantidad, 0)}
              </span>
            )}
          </div>
          <span className="text-xs text-gray-400">Muestras sin cambio de estado por más de 5 días</span>
        </div>

        {cuellos_botella.length === 0 ? (
          <div className="p-6 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-50 mb-3">
              <CheckCircleIcon />
            </div>
            <p className="text-sm font-medium text-gray-700">Flujo normal</p>
            <p className="text-xs text-gray-500 mt-1">No hay muestras estancadas en ninguna etapa.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {cuellos_botella.map((cuello) => (
              <div key={cuello.status} className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    {cuello.label}
                  </span>
                  <span className="text-sm text-gray-500">
                    {cuello.cantidad} muestra{cuello.cantidad !== 1 ? 's' : ''} estancada{cuello.cantidad !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {cuello.muestras.map((m) => (
                    <Link
                      key={m.id}
                      href={`/samples`}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-colors text-sm"
                      title={`${m.species} — ${m.client_name}`}
                    >
                      <FlaskConical className="h-3.5 w-3.5 text-gray-400" />
                      <span className="font-medium text-gray-900">{m.code}</span>
                      <span className="text-gray-400">·</span>
                      <span className="text-red-600 font-medium">{m.dias_estancado}d</span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* 3. ACTIVIDAD RECIENTE                                         */}
      {/* ═════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-100 flex items-center gap-2">
          <Activity className="h-5 w-5 text-blue-500" />
          <h3 className="font-semibold text-gray-900">Actividad reciente</h3>
        </div>

        {actividad_reciente.length === 0 ? (
          <div className="p-6 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-50 mb-3">
              <Activity className="h-6 w-6 text-gray-300" />
            </div>
            <p className="text-sm font-medium text-gray-700">Sin actividad registrada</p>
            <p className="text-xs text-gray-500 mt-1">La actividad del equipo aparecerá aquí.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {actividad_reciente.map((act) => (
              <div key={act.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors">
                <span className="text-base flex-shrink-0" title={act.accion}>
                  {accionIcono(act.accion)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 truncate">
                    <span className="font-medium">{act.usuario}</span>
                    {' '}
                    <span className="text-gray-500">{act.accion}</span>
                    {act.muestra_codigo && (
                      <>
                        {' '}
                        <span className="font-mono text-xs text-gray-600 bg-gray-100 px-1 py-0.5 rounded">
                          {act.muestra_codigo}
                        </span>
                      </>
                    )}
                  </p>
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0 tabular-nums">
                  {fechaRelativa(act.fecha)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Icono de verificación (sin lucide-react para mantener consistencia)
function CheckCircleIcon() {
  return (
    <svg className="h-6 w-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}
