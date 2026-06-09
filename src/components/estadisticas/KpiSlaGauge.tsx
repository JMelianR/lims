'use client'

import { CLIENT_TYPE_BADGE_CLASSES } from '@/lib/constants/client-types'
import type { SlaByClientType } from '@/types/analytics'

export type SlaByType = {
  type: string
  total: number
  onTime: number
  atRisk: number
  breached: number
  complianceRate: number
}

export type SlaData = {
  total: number
  onTime: number
  atRisk: number
  breached: number
  complianceRate: number
  byType: SlaByType[]
  byClientType?: SlaByClientType[]
}

type KpiSlaGaugeProps = {
  data: SlaData | null
}

export function KpiSlaGauge({ data }: KpiSlaGaugeProps) {
  if (!data || data.total === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-gray-500">
        No hay datos de SLA disponibles.
      </div>
    )
  }

  const onTimePct = data.complianceRate
  const atRiskPct = data.total > 0 ? Math.round((data.atRisk / data.total) * 1000) / 10 : 0
  const breachedPct = data.total > 0 ? Math.round((data.breached / data.total) * 1000) / 10 : 0

  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="text-sm font-medium text-gray-500">Cumplimiento SLA</p>
        <p className={`text-4xl font-bold ${onTimePct >= 90 ? 'text-green-600' : onTimePct >= 75 ? 'text-yellow-600' : 'text-red-600'}`}>
          {onTimePct}%
        </p>
        <p className="text-xs text-gray-400">de {data.total} muestras a tiempo</p>
      </div>

      <div className="h-4 w-full flex rounded-full overflow-hidden">
        <div
          className="bg-green-500 transition-all"
          style={{ width: `${Math.max(onTimePct, 2)}%` }}
          title={`A tiempo: ${data.onTime}`}
        />
        <div
          className="bg-yellow-400 transition-all"
          style={{ width: `${Math.max(atRiskPct, data.atRisk > 0 ? 2 : 0)}%` }}
          title={`En riesgo: ${data.atRisk}`}
        />
        <div
          className="bg-red-500 transition-all"
          style={{ width: `${Math.max(breachedPct, data.breached > 0 ? 2 : 0)}%` }}
          title={`Vencidas: ${data.breached}`}
        />
      </div>

      <div className="grid grid-cols-3 gap-3 text-center text-sm">
        <div>
          <span className="inline-block w-3 h-3 rounded-sm bg-green-500 mr-1" />
          <span className="font-medium text-gray-700">{data.onTime}</span>
          <span className="text-gray-400 ml-1">a tiempo</span>
        </div>
        <div>
          <span className="inline-block w-3 h-3 rounded-sm bg-yellow-400 mr-1" />
          <span className="font-medium text-gray-700">{data.atRisk}</span>
          <span className="text-gray-400 ml-1">en riesgo</span>
        </div>
        <div>
          <span className="inline-block w-3 h-3 rounded-sm bg-red-500 mr-1" />
          <span className="font-medium text-gray-700">{data.breached}</span>
          <span className="text-gray-400 ml-1">vencidas</span>
        </div>
      </div>

      {data.byType.length > 1 && (
        <div>
          <p className="mb-2 text-sm font-medium text-gray-700">Por tipo de SLA</p>
          <div className="space-y-2">
            {data.byType.map((row) => (
              <div key={row.type} className="flex items-center gap-3">
                <span className="w-16 text-xs font-medium text-gray-600 capitalize">{row.type}</span>
                <div className="flex-1 h-3 flex rounded-full overflow-hidden bg-gray-100">
                  <div
                    className="bg-green-500 transition-all"
                    style={{ width: `${Math.max(row.complianceRate, 2)}%` }}
                  />
                </div>
                <span className="text-xs font-medium tabular-nums text-gray-700 w-12 text-right">
                  {row.complianceRate}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Desglose por tipo de cliente */}
      {data.byClientType && data.byClientType.length > 1 && (
        <div>
          <p className="mb-3 text-sm font-medium text-gray-700">Cumplimiento por tipo de cliente</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500">
                  <th className="pb-2 pr-3">Tipo de cliente</th>
                  <th className="pb-2 px-2 text-right">Total</th>
                  <th className="pb-2 px-2 text-right">A tiempo</th>
                  <th className="pb-2 px-2 text-right">En riesgo</th>
                  <th className="pb-2 px-2 text-right">Vencidas</th>
                  <th className="pb-2 pl-2 text-right">% Cumplimiento</th>
                </tr>
              </thead>
              <tbody>
                {data.byClientType.map((row) => (
                  <tr key={row.clientType} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 pr-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${CLIENT_TYPE_BADGE_CLASSES[row.clientType as keyof typeof CLIENT_TYPE_BADGE_CLASSES] || 'bg-gray-100 text-gray-800'}`}>
                        {row.label}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums text-gray-700">{row.total}</td>
                    <td className="py-2 px-2 text-right tabular-nums text-green-700">{row.onTime}</td>
                    <td className="py-2 px-2 text-right tabular-nums text-yellow-700">{row.atRisk}</td>
                    <td className="py-2 px-2 text-right tabular-nums text-red-700">{row.breached}</td>
                    <td className="py-2 pl-2 text-right tabular-nums font-medium">
                      <span className={`${row.complianceRate >= 90 ? 'text-green-600' : row.complianceRate >= 75 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {row.complianceRate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
