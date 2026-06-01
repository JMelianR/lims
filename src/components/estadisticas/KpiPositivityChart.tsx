'use client'

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CLIENT_TYPE_BADGE_CLASSES } from '@/lib/constants/client-types'
import type { PositivityByClientType } from '@/types/analytics'

export type PositivityGroupRow = {
  key: string
  total: number
  positive: number
  negative: number
  inconclusive: number
  positivityRate: number
}

export type PositivityData = {
  overall: {
    total: number
    positive: number
    negative: number
    inconclusive: number
    positivityRate: number
  }
  byPathogen: PositivityGroupRow[]
  bySpecies: PositivityGroupRow[]
  byClientType?: PositivityByClientType[]
}

type KpiPositivityChartProps = {
  data: PositivityData | null
  groupBy: 'pathogen' | 'species' | 'clientType'
}

export function KpiPositivityChart({ data, groupBy }: KpiPositivityChartProps) {
  const title =
    groupBy === 'pathogen' ? 'por patógeno' :
    groupBy === 'species' ? 'por especie' : 'por tipo de cliente'

  // Si groupBy es clientType, usar el desglose específico
  if (groupBy === 'clientType') {
    if (!data || data.overall.total === 0) {
      return (
        <div className="flex h-64 items-center justify-center text-sm text-gray-500">
          No hay resultados para calcular la tasa de positividad.
        </div>
      )
    }

    const rows = data.byClientType

    if (!rows || rows.length === 0) {
      return (
        <div className="flex h-64 items-center justify-center text-sm text-gray-500">
          No hay suficientes datos para desglosar {title}.
        </div>
      )
    }

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-green-50 p-3 text-center">
            <p className="text-xs font-medium text-green-700">Positivos</p>
            <p className="text-xl font-bold text-green-900">{data.overall.positive}</p>
            <p className="text-xs text-green-600">{data.overall.positivityRate}%</p>
          </div>
          <div className="rounded-lg bg-red-50 p-3 text-center">
            <p className="text-xs font-medium text-red-700">Negativos</p>
            <p className="text-xl font-bold text-red-900">{data.overall.negative}</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3 text-center">
            <p className="text-xs font-medium text-gray-600">Inconclusos</p>
            <p className="text-xl font-bold text-gray-700">{data.overall.inconclusive}</p>
          </div>
        </div>

        <p className="text-sm font-medium text-gray-700">Tasa de positividad {title}</p>

        {/* Tabla de desglose por tipo de cliente */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500">
                <th className="pb-2 pr-3">Tipo de cliente</th>
                <th className="pb-2 px-2 text-right">Total</th>
                <th className="pb-2 px-2 text-right">Positivos</th>
                <th className="pb-2 px-2 text-right">Negativos</th>
                <th className="pb-2 px-2 text-right">Inconclusos</th>
                <th className="pb-2 pl-2 text-right">% Positividad</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.clientType} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2 pr-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${CLIENT_TYPE_BADGE_CLASSES[row.clientType as keyof typeof CLIENT_TYPE_BADGE_CLASSES] || 'bg-gray-100 text-gray-800'}`}>
                      {row.label}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums text-gray-700">{row.total}</td>
                  <td className="py-2 px-2 text-right tabular-nums text-green-700">{row.positive}</td>
                  <td className="py-2 px-2 text-right tabular-nums text-red-700">{row.negative}</td>
                  <td className="py-2 px-2 text-right tabular-nums text-gray-500">{row.inconclusive}</td>
                  <td className="py-2 pl-2 text-right tabular-nums font-medium text-gray-900">
                    {row.positivityRate}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-gray-500">Total: {data.overall.total} resultados</p>
      </div>
    )
  }

  // Código original para pathogen y species
  const rows = groupBy === 'pathogen' ? data?.byPathogen : data?.bySpecies

  if (!data || data.overall.total === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-gray-500">
        No hay resultados para calcular la tasa de positividad.
      </div>
    )
  }

  if (!rows || rows.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-gray-500">
        No hay suficientes datos para desglosar {title}.
      </div>
    )
  }

  const top = rows.slice(0, 10)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-green-50 p-3 text-center">
          <p className="text-xs font-medium text-green-700">Positivos</p>
          <p className="text-xl font-bold text-green-900">{data.overall.positive}</p>
          <p className="text-xs text-green-600">{data.overall.positivityRate}%</p>
        </div>
        <div className="rounded-lg bg-red-50 p-3 text-center">
          <p className="text-xs font-medium text-red-700">Negativos</p>
          <p className="text-xl font-bold text-red-900">{data.overall.negative}</p>
        </div>
        <div className="rounded-lg bg-gray-50 p-3 text-center">
          <p className="text-xs font-medium text-gray-600">Inconclusos</p>
          <p className="text-xl font-bold text-gray-700">{data.overall.inconclusive}</p>
        </div>
      </div>

      <p className="text-sm font-medium text-gray-700">Tasa de positividad {title}</p>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={top} margin={{ top: 4, right: 8, left: 0, bottom: 4 }} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
            <XAxis type="number" tick={{ fontSize: 10, fill: '#6b7280' }} unit="%" domain={[0, 100]} />
            <YAxis dataKey="key" type="category" tick={{ fontSize: 10, fill: '#6b7280' }} width={100} />
            <Tooltip
              formatter={(value, name) => {
                if (name === 'Tasa') return [Number(value).toFixed(1) + '%', 'Positividad']
                return [value, name]
              }}
              contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px' }}
            />
            <Bar dataKey="positivityRate" name="Tasa" fill="#16a34a" radius={[0, 2, 2, 0]} barSize={16} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-gray-500">Total: {data.overall.total} resultados</p>
    </div>
  )
}
