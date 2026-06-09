import type { ClientType } from '@/types/database'

export const CLIENT_TYPES: ClientType[] = [
  'farmer',
  'agricultural_company',
  'research_institution',
  'government_agency',
  'consultant',
]

export const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  farmer: 'Agricultor',
  agricultural_company: 'Empresa Agrícola',
  research_institution: 'Institución de Investigación',
  government_agency: 'Agencia Gubernamental',
  consultant: 'Consultor',
}

export const CLIENT_TYPE_COLORS: Record<ClientType, string> = {
  farmer: '#16a34a',
  agricultural_company: '#2563eb',
  research_institution: '#9333ea',
  government_agency: '#dc2626',
  consultant: '#ca8a04',
}

export const CLIENT_TYPE_BADGE_CLASSES: Record<ClientType, string> = {
  farmer: 'bg-green-100 text-green-800',
  agricultural_company: 'bg-blue-100 text-blue-800',
  research_institution: 'bg-purple-100 text-purple-800',
  government_agency: 'bg-red-100 text-red-800',
  consultant: 'bg-yellow-100 text-yellow-800',
}
