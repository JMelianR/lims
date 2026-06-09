'use client'

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CLIENT_TYPE_BADGE_CLASSES } from '@/lib/constants/client-types'
import type { ThroughputByClientType } from '@/types/analytics'

export type ThroughputDailyRow = {
  date: string
  received: number
  completed: number
}

export type ThroughputData = {
  periodDays: number
  totalReceived: number
  totalCompleted: number
  avgPerDay: number
  daily: ThroughputDailyRow[]
  byClientType?: ThroughputByClientType[]
}

type KpiThroughputChartProps = {
  data: ThroughputData | null
}

function shortDate(iso: string): string {
  const parts = iso.split('-')
  if (parts.length < 3) return iso
  return `${parts[2]}/${parts[1]}`
}

export function KpiThroughputChart({ data }: KpiThroughputChartProps) {
  if (!data || data.totalReceived === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-gray-500">
        No hay muestras registradas en el período seleccionado.
      </div>
    )
  }

  const chartData = data.daily.map((row) => ({
    ...row,
    shortDate: shortDate(row.date)
  }))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-blue-50 p-3 text-center">
          <p className="text-xs font-medium text-blue-700">Recibidas</p>
          <p className="text-xl font-bold text-blue-900">{data.totalReceived}</p>
          <p className="text-xs text-blue-600">{data.avgPerDay}/día</p>
        </div>
        <div className="rounded-lg bg-green-50 p-3 text-center">
          <p className="text-xs font-medium text-green-700">Completadas</p>
          <p className="text-xl font-bold text-green-900">{data.totalCompleted}</p>
        </div>
        <div className="rounded-lg bg-gray-50 p-3 text-center">
          <p className="text-xs font-medium text-gray-600">Período</p>
          <p className="text-xl font-bold text-gray-700">{data.periodDays}</p>
          <p className="text-xs text-gray-500">días</p>
        </div>
      </div>

      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis dataKey="shortDate" tick={{ fontSize: 10, fill: '#6b7280' }} interval="preserveStartEnd" />
            <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#6b7280' }} width={28} />
            <Tooltip
              labelFormatter={(label) => `Fecha: ${label}`}
              contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px' }}
            />
            <Area
              type="monotone"
              dataKey="received"
              name="Recibidas"
              stroke="#2563eb"
              fill="#2563eb"
              fillOpacity={0.1}
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="completed"
              name="Completadas"
              stroke="#16a34a"
              fill="#16a34a"
              fillOpacity={0.1}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Desglose por tipo de cliente */}
      {data.byClientType && data.byClientType.length > 1 && (
        <div>
          <p className="mb-3 text-sm font-medium text-gray-700">Distribución por tipo de cliente</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500">
                  <th className="pb-2 pr-3">Tipo de cliente</th>
                  <th className="pb-2 px-2 text-right">Recibidas</th>
                  <th className="pb-2 px-2 text-right">Completadas</th>
                  <th className="pb-2 pl-2 text-right">% Completado</th>
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
                    <td className="py-2 px-2 text-right tabular-nums text-gray-700">{row.received}</td>
                    <td className="py-2 px-2 text-right tabular-nums text-gray-700">{row.completed}</td>
                    <td className="py-2 pl-2 text-right tabular-nums font-medium text-gray-900">
                      {row.received > 0 ? Math.round((row.completed / row.received) * 100) : 0}%
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
