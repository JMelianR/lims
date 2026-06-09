import { beforeAll } from 'vitest'

/**
 * Setup global para tests de integración.
 *
 * Se ejecuta UNA SOLA VEZ antes de todos los archivos de test
 * (configurado en vitest.config.ts → setupFiles).
 *
 * Responsabilidades:
 * 1. Validar que las variables de entorno necesarias existen
 *
 * Las variables de entorno se cargan automáticamente desde .env.local
 * cuando se ejecuta `next dev`, pero vitest no lo hace.
 * Para los tests de integración, las variables deben estar disponibles
 * en el entorno del proceso (shell, .env.local cargado por vitest, etc.).
 *
 * En vitest.config.ts se pasan explícitamente desde process.env.
 */

beforeAll(() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    console.warn(
      '\n' +
      '══════════════════════════════════════════════════════\n' +
      '  AVISO: Variables de entorno no configuradas\n' +
      '  Los tests de integración necesitan:\n' +
      '    NEXT_PUBLIC_SUPABASE_URL\n' +
      '    SUPABASE_SERVICE_ROLE_KEY\n' +
      '  Si no existen, los tests de integración fallarán.\n' +
      '  Agrégalas a .env.local o .env.test.local\n' +
      '══════════════════════════════════════════════════════\n'
    )
  } else {
    console.log(`[tests] Conectando a: ${url}`)
  }
})
