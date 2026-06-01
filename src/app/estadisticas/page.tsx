'use client'

import { useState, useEffect, useCallback } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import {
  TrendingUp,
  Users,
  TestTube,
  Calendar,
  Clock,
  CheckCircle,
  Loader2,
  ChevronDown
} from 'lucide-react'
import {
  SamplesByMonthChart,
  type SamplesByMonthRow
} from '@/components/estadisticas/SamplesByMonthChart'
import {
  ResultsByTypeChart,
  type ResultsByTypeRow
} from '@/components/estadisticas/ResultsByTypeChart'
import { KpiTatCard, type TatData } from '@/components/estadisticas/KpiTatCard'
import { KpiPositivityChart, type PositivityData } from '@/components/estadisticas/KpiPositivityChart'
import { KpiSlaGauge, type SlaData } from '@/components/estadisticas/KpiSlaGauge'
import { KpiThroughputChart, type ThroughputData } from '@/components/estadisticas/KpiThroughputChart'
import { ClientTypeFilter } from '@/components/estadisticas/ClientTypeFilter'
import type { ClientTypeFilter as ClientTypeFilterValue } from '@/types/analytics'

type KpiMetric = 'tat' | 'positivity' | 'sla' | 'throughput'

const KPI_METRICS: { key: KpiMetric; label: string }[] = [
  { key: 'tat', label: 'Tiempo de ciclo' },
  { key: 'positivity', label: 'Positividad' },
  { key: 'sla', label: 'Cumplimiento SLA' },
  { key: 'throughput', label: 'Throughput' }
]

const PERIOD_OPTIONS = [
  { days: 7, label: '7 días' },
  { days: 30, label: '30 días' },
  { days: 90, label: '90 días' }
]

function buildClientTypeParam(filter: ClientTypeFilterValue): string | null {
  if (filter === 'all') return null  // null = no enviar param, API usa 'all' por defecto
  return filter.join(',')
}

export default function EstadisticasPage() {
  const [stats, setStats] = useState({
    totalSamples: 0,
    totalResults: 0,
    totalClients: 0,
    pendingResults: 0,
    completedToday: 0,
    averageProcessingTime: null as number | null,
    averageLeadTimeResultCount: 0
  })
  const [samplesByMonth, setSamplesByMonth] = useState<SamplesByMonthRow[]>([])
  const [resultsByType, setResultsByType] = useState<ResultsByTypeRow[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [selectedMetric, setSelectedMetric] = useState<KpiMetric>('tat')
  const [kpiData, setKpiData] = useState<TatData | PositivityData | SlaData | ThroughputData | null>(null)
  const [isLoadingKpi, setIsLoadingKpi] = useState(false)
  const [throughputDays, setThroughputDays] = useState(30)
  const [selectedClientTypes, setSelectedClientTypes] = useState<ClientTypeFilterValue>('all')
  const [positivityGroupBy, setPositivityGroupBy] = useState<'pathogen' | 'species' | 'clientType'>('pathogen')

  // Reiniciar groupBy si el usuario cambia de métrica
  useEffect(() => {
    if (selectedMetric === 'positivity') {
      setPositivityGroupBy('pathogen')
    }
  }, [selectedMetric])

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const now = new Date()
        const completedDayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
        const completedDayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
        const statsQuery = new URLSearchParams({
          completedDayStart: completedDayStart.toISOString(),
          completedDayEnd: completedDayEnd.toISOString()
        })

        const ctParam = buildClientTypeParam(selectedClientTypes)
        const chartsQuery = new URLSearchParams()
        if (ctParam) chartsQuery.set('client_type', ctParam)

        const [dashboardStatsResponse, chartsResponse] =
          await Promise.all([
            fetch(`/api/dashboard/stats?${statsQuery.toString()}`),
            fetch(`/api/estadisticas/charts?${chartsQuery.toString()}`)
          ])

        let totalSamples = 0
        let totalResults = 0
        let totalClients = 0
        let pendingWork = 0
        let completedTodayCount = 0
        if (dashboardStatsResponse.ok) {
          const dashboardStats = await dashboardStatsResponse.json()
          totalSamples = dashboardStats?.samples?.total ?? 0
          totalResults = dashboardStats?.results?.total ?? 0
          totalClients = dashboardStats?.overview?.totalClients ?? 0
          pendingWork = dashboardStats?.overview?.pendingWork ?? 0
          completedTodayCount = dashboardStats?.overview?.completedToday ?? 0
        }

        let samplesByMonthData: SamplesByMonthRow[] = []
        let resultsByTypeData: ResultsByTypeRow[] = []
        let averageHours: number | null = null
        let averageLeadCount = 0

        if (chartsResponse.ok) {
          const chartsPayload = await chartsResponse.json()
          samplesByMonthData = Array.isArray(chartsPayload.samplesByMonth) ? chartsPayload.samplesByMonth : []
          resultsByTypeData = Array.isArray(chartsPayload.resultsByType) ? chartsPayload.resultsByType : []
          const rawAvg = chartsPayload.averageLeadTimeHours
          const rawCount = chartsPayload.averageLeadTimeResultCount
          if (typeof rawAvg === 'number' && !Number.isNaN(rawAvg)) {
            averageHours = rawAvg
          }
          if (typeof rawCount === 'number') {
            averageLeadCount = rawCount
          }
        }

        setSamplesByMonth(samplesByMonthData)
        setResultsByType(resultsByTypeData)
        setStats({
          totalSamples,
          totalResults,
          totalClients,
          pendingResults: pendingWork,
          completedToday: completedTodayCount,
          averageProcessingTime: averageHours,
          averageLeadTimeResultCount: averageLeadCount
        })
      } catch (error) {
        console.error('Error fetching statistics:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchStats()
  }, [selectedClientTypes])

  const fetchKpi = useCallback(async (metric: KpiMetric, days: number, clientTypeFilter: ClientTypeFilterValue) => {
    setIsLoadingKpi(true)
    setKpiData(null)
    try {
      const params = new URLSearchParams({ metric })
      if (metric === 'throughput') params.set('days', String(days))
      const ctParam = buildClientTypeParam(clientTypeFilter)
      if (ctParam) params.set('client_type', ctParam)
      const response = await fetch(`/api/kpi?${params.toString()}`)
      if (response.ok) {
        const payload = await response.json()
        setKpiData(payload)
      }
    } catch (error) {
      console.error('Error fetching KPI:', error)
    } finally {
      setIsLoadingKpi(false)
    }
  }, [])

  useEffect(() => {
    fetchKpi(selectedMetric, throughputDays, selectedClientTypes)
  }, [selectedMetric, throughputDays, selectedClientTypes, fetchKpi])

  // Forzar re-fetch de KPI cuando cambia el filtro (incluso misma métrica)
  const handleClientTypeChange = useCallback((filter: ClientTypeFilterValue) => {
    setSelectedClientTypes(filter)
    setIsLoading(true)  // re-fetch charts también
  }, [])

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Estadísticas</h1>
          <p className="text-gray-600">Resumen general del laboratorio</p>
        </div>

        {/* Client Type Filter */}
        <div className="mb-6">
          <p className="text-sm font-medium text-gray-700 mb-2">Filtrar por tipo de cliente</p>
          <ClientTypeFilter selected={selectedClientTypes} onChange={handleClientTypeChange} />
          {selectedClientTypes !== 'all' && (
            <p className="mt-2 text-xs text-gray-400">
              Mostrando datos de: {selectedClientTypes.length} tipo{selectedClientTypes.length > 1 ? 's' : ''} de cliente
            </p>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <TestTube className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Muestras</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalSamples}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Resultados</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalResults}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Clientes</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalClients}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Pendientes</p>
                <p className="text-2xl font-bold text-gray-900">{stats.pendingResults}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <Calendar className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Completados Hoy</p>
                <p className="text-2xl font-bold text-gray-900">{stats.completedToday}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <TrendingUp className="h-6 w-6 text-indigo-600" />
              </div>
              <div className="ml-4 min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-600">Tiempo promedio</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.averageLeadTimeResultCount === 0
                    ? '—'
                    : `${stats.averageProcessingTime?.toLocaleString('es', {
                        maximumFractionDigits: 1
                      })} h`}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {stats.averageLeadTimeResultCount > 0
                    ? `Ingreso de muestra → validación del resultado · ${stats.averageLeadTimeResultCount} validado${
                        stats.averageLeadTimeResultCount === 1 ? '' : 's'
                      }`
                    : 'Solo resultados con validación e ingreso de muestra fechados'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Muestras por mes</h3>
              <p className="text-sm text-gray-500">Últimos 12 meses según fecha de registro</p>
            </div>
            <SamplesByMonthChart data={samplesByMonth} />
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Resultados por tipo de análisis</h3>
              <p className="text-sm text-gray-500">
                Cantidad de resultados según área / tipo de análisis registrado en cada resultado
              </p>
            </div>
            <ResultsByTypeChart data={resultsByType} />
          </div>
        </div>

        {/* KPIs Section */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h3 className="text-lg font-semibold text-gray-900">Indicadores de rendimiento (KPI)</h3>
              <div className="flex items-center gap-2 flex-wrap">
                {selectedMetric === 'throughput' && (
                  <div className="relative">
                    <select
                      value={throughputDays}
                      onChange={(e) => setThroughputDays(Number(e.target.value))}
                      className="appearance-none bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 pr-8 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      {PERIOD_OPTIONS.map((opt) => (
                        <option key={opt.days} value={opt.days}>{opt.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                  </div>
                )}

                {/* Toggle de agrupación para positividad */}
                {selectedMetric === 'positivity' && (
                  <div className="relative">
                    <select
                      value={positivityGroupBy}
                      onChange={(e) => setPositivityGroupBy(e.target.value as typeof positivityGroupBy)}
                      className="appearance-none bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 pr-8 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="pathogen">Por patógeno</option>
                      <option value="species">Por especie</option>
                      <option value="clientType">Por tipo de cliente</option>
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                  </div>
                )}

                <div className="flex bg-gray-100 rounded-lg p-1">
                  {KPI_METRICS.map((m) => (
                    <button
                      key={m.key}
                      onClick={() => setSelectedMetric(m.key)}
                      className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
                        selectedMetric === m.key
                          ? 'bg-white text-green-700 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="p-6">
            {isLoadingKpi ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-green-600" />
              </div>
            ) : (
              <>
                {selectedMetric === 'tat' && <KpiTatCard data={kpiData as TatData | null} />}
                {selectedMetric === 'positivity' && (
                  <KpiPositivityChart data={kpiData as PositivityData | null} groupBy={positivityGroupBy} />
                )}
                {selectedMetric === 'sla' && <KpiSlaGauge data={kpiData as SlaData | null} />}
                {selectedMetric === 'throughput' && <KpiThroughputChart data={kpiData as ThroughputData | null} />}
              </>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
