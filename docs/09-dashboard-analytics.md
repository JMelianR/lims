# 09 — Dashboard de Analytics y KPIs

> **Rama**: `kpis-estadisticos`  
> **Autor**: Diego Estadístico  
> **Fecha**: Junio 2026  
> **Estado**: En desarrollo — listo para prueba del equipo

---

## Contexto interpretable

### ¿De dónde viene esto?

El README.md del proyecto lista "Dashboard de analytics" como una de las próximas características. Chalo (commit `8bdf8af`, 27 abr 2026) creó la primera iteración:

- Endpoint `/api/estadisticas/charts` con 3 datasets: `samplesByMonth`, `resultsByType`, `averageLeadTimeHours`
- Componentes `SamplesByMonthChart` y `ResultsByTypeChart`
- Página `/estadisticas` con tarjetas de resumen

Esa primera versión era **exclusivamente para control interno** del laboratorio. Los clientes (rol `consumidor`) no pueden acceder: son redirigidos automáticamente a `/reports` (ver `src/app/dashboard/page.tsx`, línea 74-78).

### ¿Qué agrega esta rama?

Cuatro KPIs con segmentación por los 5 tipos de cliente del sistema. Todo es **control interno**: mide desempeño del laboratorio, no se muestra al cliente.

| KPI | Qué mide | Pregunta operativa |
|---|---|---|
| **TAT** (Turnaround Time) | Horas desde ingreso de muestra hasta validación del resultado | ¿Somos rápidos? |
| **Positividad** | % de resultados positivos por patógeno / especie / tipo de cliente | ¿Qué encontramos? ¿A quién? |
| **SLA** | % de muestras entregadas a tiempo | ¿Cumplimos los plazos? |
| **Throughput** | Muestras recibidas y completadas por día | ¿Cuánto volumen manejamos? |

Además, se agregó un **Monitor de Laboratorio** en el dashboard (`/dashboard`) con tres paneles:

1. **Alertas SLA**: muestras vencidas o en riesgo de vencer
2. **Cuellos de botella**: muestras estancadas más de 5 días en una misma etapa
3. **Actividad reciente**: últimas 20 acciones del equipo (desde `action_logs`)

### ¿Por qué segmentar por tipo de cliente si es interno?

El `client_type` existe en la base de datos desde el día 1 (`farmer`, `agricultural_company`, `research_institution`, `government_agency`, `consultant`), pero ningún análisis lo usaba. Segmentar permite responder preguntas operativas relevantes:

- ¿Atendemos igual de rápido al pequeño agricultor que a la gran exportadora?
- ¿El SAG (gobierno) tiene mejor SLA compliance porque es más fiscalizado?
- ¿Las instituciones de investigación mandan casos más complejos (mayor positividad)?
- ¿Qué tipo de cliente está creciendo más?

---

## Decisiones de diseño

### 1. Modo dual del filtro `client_type`

El parámetro `?client_type=all` (default) devuelve datos globales **más** un array `byClientType` con el desglose. `?client_type=farmer,consultant` filtra a esos tipos específicos.

**Por qué**: backward compatible. Quien consumía la API sin el parámetro sigue recibiendo la misma estructura; simplemente ignora el campo nuevo `byClientType`.

### 2. Join anidado en Supabase

Para obtener `client_type` desde `results` o `samples`, se agregó un join anidado:

```
samples!inner(..., clients(client_type))
```

Esto resuelve el `client_type` en una sola query sin round-trips adicionales.

### 3. Colores consistentes

Los 5 tipos de cliente usan los mismos colores de badge definidos en `src/app/clients/page.tsx`:

| Tipo | Color | Hex |
|---|---|---|
| Agricultor | Verde | `#16a34a` |
| Empresa Agrícola | Azul | `#2563eb` |
| Institución de Investigación | Púrpura | `#9333ea` |
| Agencia Gubernamental | Rojo | `#dc2626` |
| Consultor | Amarillo | `#ca8a04` |

Fuente única de verdad: `src/lib/constants/client-types.ts`.

### 4. Tablas, no gráficos complejos

En los componentes KPI, el desglose por tipo de cliente se muestra como **tablas numéricas**, no como gráficos de barras stacked. Decisión deliberada: los datos son el foco, la visualización compleja se deja para una iteración futura.

### 5. Seed data con perfiles diferenciados

El script `src/scripts/seed-kpi-data.ts` genera ~120 muestras distribuidas entre los 5 tipos con **perfiles de comportamiento distintos** (distinta distribución de áreas, tasa de SLA express, tasa de positividad). Esto permite ver diferencias reales en los KPIs apenas se siembran los datos.

---

## Arquitectura de archivos

### Nuevos (11 archivos)

```
src/
├── app/api/
│   ├── kpi/route.ts                         # Endpoint unificado de KPIs
│   └── dashboard/monitor/route.ts           # Endpoint del monitor
├── components/
│   ├── estadisticas/
│   │   ├── ClientTypeFilter.tsx             # Filtro de tipos de cliente (pills)
│   │   ├── KpiTatCard.tsx                   # KPI: tiempo de ciclo
│   │   ├── KpiPositivityChart.tsx           # KPI: tasa de positividad
│   │   ├── KpiSlaGauge.tsx                  # KPI: cumplimiento SLA
│   │   └── KpiThroughputChart.tsx           # KPI: volumen de muestras
│   └── dashboard/
│       └── MonitorLaboratorio.tsx           # Monitor: alertas + cuellos + actividad
├── lib/constants/
│   └── client-types.ts                      # Labels, colores, badges de tipos
├── types/
│   └── analytics.ts                         # Interfaces de desglose por tipo
└── scripts/
    ├── seed-kpi-data.ts                     # Semilla con 5 tipos y perfiles
    ├── create-user-diego.ts                 # Crear/actualizar usuario admin
    └── clean-seed-data.ts                   # Limpiar datos de semilla
```

### Modificados (3 archivos)

```
src/app/api/estadisticas/charts/route.ts     # +filtro client_type, +byClientType
src/app/estadisticas/page.tsx                # +ClientTypeFilter, +client_type en API calls
src/app/dashboard/page.tsx                   # +MonitorLaboratorio
```

---

## Cómo probar

### Requisitos previos

- `.env.local` configurado con `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`
- Usuario admin (usar `npx tsx src/scripts/create-user-diego.ts` si no existe)

### Paso 1: Sembrar datos

```bash
npx tsx src/scripts/seed-kpi-data.ts
```

Esto crea 7 clientes (todos los tipos), 120 muestras y ~104 resultados con perfiles diferenciados. Es idempotente: si ya existen datos con prefijo `SEED-5T-2026-`, no duplica. Para regenerar, usar `npx tsx src/scripts/clean-seed-data.ts` primero.

### Paso 2: Iniciar el servidor

```bash
npm run dev
# o en un puerto específico:
npx next dev -p 3003
```

### Paso 3: Probar el dashboard

1. Iniciar sesión con `diego.estadistico14@gmail.com`
2. Ir a `/dashboard` → verificar que aparece el **Monitor de Laboratorio** con 3 paneles
3. Ir a `/estadisticas` → verificar:
   - Filtro de tipos de cliente con 5 botones de colores + "Todos"
   - Al seleccionar "Todos", cada KPI muestra tabla de desglose por tipo
   - Al seleccionar un tipo específico (ej: "Agricultor"), los datos se filtran
   - Cambiar entre KPI tabs (Tiempo de ciclo, Positividad, Cumplimiento SLA, Throughput)
   - En Positividad, el selector "Por patógeno / Por especie / Por tipo de cliente"

### Paso 4: Verificar los endpoints

```bash
# KPIs con desglose por tipo
curl http://localhost:3003/api/kpi?metric=tat
curl http://localhost:3003/api/kpi?metric=positivity
curl http://localhost:3003/api/kpi?metric=sla
curl http://localhost:3003/api/kpi?metric=throughput&days=30

# KPIs filtrados por tipo
curl "http://localhost:3003/api/kpi?metric=sla&client_type=farmer,consultant"

# Monitor
curl http://localhost:3003/api/dashboard/monitor

# Charts con filtro
curl "http://localhost:3003/api/estadisticas/charts?client_type=agricultural_company"
```

Nota: todos los endpoints requieren autenticación (cookie de sesión de Supabase).

---

## Lo que NO cubre esta rama (próximos pasos)

- **Analytics de cara al cliente**: el README menciona "Dashboard de analytics", pero esta implementación es solo la mitad interna. Falta un panel para el rol `consumidor` que muestre sus propios datos (evolución de cultivos, mapa de patógenos en sus predios, comparación entre temporadas).
- **Dashboard stats**: el endpoint `/api/dashboard/stats` aún no soporta filtro `client_type`.
- **Visualizaciones avanzadas**: los gráficos de SamplesByMonth y ResultsByType no se modificaron para mostrar stacked bars por tipo de cliente.
- **Tendencias y predicciones**: no hay análisis de estacionalidad, comparación interanual, ni modelos predictivos.

---

## Referencias cruzadas

- [[02-autenticacion]] — roles y acceso a rutas
- [[03-api-routes]] — documentación de endpoints
- [[04-base-de-datos]] — esquema de tablas
- [[05-frontend]] — estructura de páginas y componentes
- [[06-multi-tenant]] — aislamiento por `company_id`
