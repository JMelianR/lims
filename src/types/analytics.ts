import type { ClientType } from './database'

// ============================================================
// Desgloses por tipo de cliente para cada métrica KPI
// ============================================================

export interface TatByClientType {
  clientType: ClientType | string
  label: string
  count: number
  p50: number
  p90: number
  p95: number
  avg: number
}

export interface PositivityByClientType {
  clientType: ClientType | string
  label: string
  total: number
  positive: number
  negative: number
  inconclusive: number
  positivityRate: number
}

export interface SlaByClientType {
  clientType: ClientType | string
  label: string
  total: number
  onTime: number
  atRisk: number
  breached: number
  complianceRate: number
}

export interface ThroughputByClientType {
  clientType: ClientType | string
  label: string
  received: number
  completed: number
}

// ============================================================
// Filtro de tipo de cliente (usado en el UI)
// ============================================================

export type ClientTypeFilter = ClientType[] | 'all'

// ============================================================
// Conteos por tipo de cliente para los gráficos existentes
// ============================================================

export type ClientTypeCounts = Partial<Record<ClientType, number>>
