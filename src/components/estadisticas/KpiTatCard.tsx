'use client'

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CLIENT_TYPE_BADGE_CLASSES } from '@/lib/constants/client-types'
import type { TatByClientType } from '@/types/analytics'

export type TatAreaRow = {
  label: string
  count: number
  p50: number
  p90: number
  p95: number
  avg: number
}

export type TatData = {
  unit: string
  count: number
  p50: number
  p90: number
  p95: number
  avg: number
  byArea: Record<string, TatAreaRow>
  byClientType?: TatByClientType[]
}

type KpiTatCardProps = {
  data: TatData | null
}

const BAR_COLORS = {
  p50: '#16a34a',
  p90: '#ca8a04',
  p95: '#dc2626'
}

export function KpiTatCard({ data }: KpiTatCardProps) {
  if (!data || data.count === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-gray-500">
        No hay datos de tiempo de procesamiento disponibles.
      </div>
    )
  }

  const areaList = Object.values(data.byArea).filter((a) => a.count >= 3)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        {([
          { key: 'p50', label: 'Mediana (P50)', value: data.p50 },
          { key: 'p90', label: 'Percentil 90', value: data.p90 },
          { key: 'p95', label: 'Percentil 95', value: data.p95 }
        ] as const).map((item) => (
          <div key={item.key} className="rounded-lg bg-gray-50 p-4 text-center">
            <p className="text-xs font-medium text-gray-500">{item.label}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {Math.round(item.value)}<span className="text-sm font-normal text-gray-500"> h</span>
            </p>
          </div>
        ))}
      </div>

      <div className="text-xs text-gray-500">
        Basado en {data.count} resultados validados. Promedio general: {data.avg} h.
      </div>

      {areaList.length > 0 && (
        <div>
          <p className="mb-3 text-sm font-medium text-gray-700">Tiempo por tipo de análisis</p>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={areaList} margin={{ top: 4, right: 8, left: 0, bottom: 4 }} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#6b7280' }} unit=" h" />
                <YAxis dataKey="label" type="category" tick={{ fontSize: 10, fill: '#6b7280' }} width={110} />
                <Tooltip
                  formatter={(value) => [Number(value).toFixed(1) + ' h', '']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px' }}
                />
                <Bar dataKey="p50" name="P50" fill={BAR_COLORS.p50} radius={[0, 2, 2, 0]} barSize={14} />
                <Bar dataKey="p90" name="P90" fill={BAR_COLORS.p90} radius={[0, 2, 2, 0]} barSize={14} />
                <Bar dataKey="p95" name="P95" fill={BAR_COLORS.p95} radius={[0, 2, 2, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Desglose por tipo de cliente */}
      {data.byClientType && data.byClientType.length > 1 && (
        <div>
          <p className="mb-3 text-sm font-medium text-gray-700">Tiempo por tipo de cliente</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500">
                  <th className="pb-2 pr-3">Tipo de cliente</th>
                  <th className="pb-2 px-2 text-right">Muestras</th>
                  <th className="pb-2 px-2 text-right">Mediana</th>
                  <th className="pb-2 px-2 text-right">P90</th>
                  <th className="pb-2 px-2 text-right">P95</th>
                  <th className="pb-2 pl-2 text-right">Promedio</th>
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
                    <td className="py-2 px-2 text-right tabular-nums text-gray-700">{row.count}</td>
                    <td className="py-2 px-2 text-right tabular-nums text-gray-700">{Math.round(row.p50)} h</td>
                    <td className="py-2 px-2 text-right tabular-nums text-gray-700">{Math.round(row.p90)} h</td>
                    <td className="py-2 px-2 text-right tabular-nums text-gray-700">{Math.round(row.p95)} h</td>
                    <td className="py-2 pl-2 text-right tabular-nums text-gray-700">{row.avg} h</td>
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
