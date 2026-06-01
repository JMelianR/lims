'use client'

import { CLIENT_TYPES, CLIENT_TYPE_LABELS, CLIENT_TYPE_BADGE_CLASSES } from '@/lib/constants/client-types'
import type { ClientType } from '@/types/database'
import type { ClientTypeFilter as ClientTypeFilterValue } from '@/types/analytics'

type ClientTypeFilterProps = {
  selected: ClientTypeFilterValue
  onChange: (selected: ClientTypeFilterValue) => void
}

export function ClientTypeFilter({ selected, onChange }: ClientTypeFilterProps) {
  const isAll = selected === 'all'

  function handleToggleAll() {
    onChange('all')
  }

  function handleToggleType(type: ClientType) {
    if (selected === 'all') {
      // Si estaba en "Todos", seleccionar solo este tipo
      onChange([type])
      return
    }

    const current = selected as ClientType[]
    if (current.includes(type)) {
      // Quitar el tipo; si queda vacío, volver a "Todos"
      const next = current.filter((t) => t !== type)
      onChange(next.length === 0 ? 'all' : next)
    } else {
      // Agregar el tipo
      const next = [...current, type]
      // Si seleccionó los 5, volver a "Todos"
      onChange(next.length === CLIENT_TYPES.length ? 'all' : next)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={handleToggleAll}
        className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
          isAll
            ? 'bg-gray-800 text-white shadow-sm'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        Todos
      </button>

      {CLIENT_TYPES.map((type) => {
        const isActive = selected !== 'all' && (selected as ClientType[]).includes(type)
        const badgeClass = CLIENT_TYPE_BADGE_CLASSES[type]
        // Extraer clases de fondo y texto del badge para usarlas como activo/inactivo
        const [bgClass, textClass] = badgeClass.split(' ')

        return (
          <button
            key={type}
            type="button"
            onClick={() => handleToggleType(type)}
            className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              isActive
                ? `${bgClass} ${textClass} shadow-sm ring-1 ring-inset ring-current/20`
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {CLIENT_TYPE_LABELS[type]}
          </button>
        )
      })}
    </div>
  )
}
