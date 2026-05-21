import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'LIMS <onboarding@resend.dev>'
const TEST_RECIPIENT = process.env.RESEND_TEST_RECIPIENT || null

type NotificationChannel = 'email'
type NotificationStatus = 'queued' | 'sent' | 'error'

interface EnqueueParams {
  userId: string
  email: string
  templateCode: string
  payload: Record<string, unknown>
  channel?: NotificationChannel
}

export async function enqueueNotification(params: EnqueueParams) {
  const supabase = await createClient()

  const { error } = await supabase.from('notifications').insert({
    channel: params.channel || 'email',
    to_ref: { email: params.email, user_id: params.userId },
    template_code: params.templateCode,
    payload: params.payload,
    status: 'queued'
  })

  if (error) {
    console.error('Error enqueuing notification:', error)
    return
  }

  // Send immediately (fire-and-forget)
  sendEmailNotification({
    email: params.email,
    templateCode: params.templateCode,
    payload: params.payload
  }).catch(err => console.error('Async email send failed:', err))
}

export async function sendEmailNotification(params: {
  email: string
  templateCode: string
  payload: Record<string, unknown>
}) {
  const { email, templateCode, payload } = params

  // In test mode, redirect all emails to the test recipient
  const toEmail = TEST_RECIPIENT || email
  const isTestMode = !!TEST_RECIPIENT && toEmail !== email

  const subject = (isTestMode ? '[TEST] ' : '') + getSubject(templateCode, payload)
  const html = (isTestMode
    ? `<div style="background:#fef3c7;border:1px solid #f59e0b;padding:10px;margin-bottom:16px;border-radius:6px;font-size:13px;color:#92400e"><strong>MODO PRUEBA</strong> — Este correo iba dirigido a: ${email}</div>`
    : '') + renderTemplate(templateCode, payload)

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [toEmail],
      subject,
      html
    })

    // Update notification status
    const supabase = await createClient()
    if (error) {
      await supabase.from('notifications')
        .update({ status: 'error', error: error.message })
        .eq('to_ref->>email', email)
        .eq('template_code', templateCode)
        .eq('status', 'queued')
        .order('created_at', { ascending: false })
        .limit(1)
    } else {
      await supabase.from('notifications')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('to_ref->>email', email)
        .eq('template_code', templateCode)
        .eq('status', 'queued')
        .order('created_at', { ascending: false })
        .limit(1)
    }

    return { success: !error, error, data }
  } catch (err) {
    console.error('Resend send error:', err)
    return { success: false, error: err }
  }
}

function getSubject(templateCode: string, payload: Record<string, unknown>): string {
  const sampleCode = (payload.sample_code as string) || ''
  const clientName = (payload.client_name as string) || ''

  switch (templateCode) {
    case 'sample_received':
      return `Muestra ${sampleCode} recibida - LIMS`
    case 'sample_status_change':
      return `Estado actualizado: ${sampleCode} - LIMS`
    case 'sample_completed':
      return `Muestra ${sampleCode} completada - LIMS`
    case 'results_ready':
      return `Resultados disponibles: ${sampleCode} - LIMS`
    case 'results_validated':
      return `Resultados validados: ${sampleCode} - LIMS`
    default:
      return `Notificación LIMS - ${sampleCode}`
  }
}

function renderTemplate(templateCode: string, payload: Record<string, unknown>): string {
  const sampleCode = (payload.sample_code as string) || ''
  const clientName = (payload.client_name as string) || ''
  const species = (payload.species as string) || ''
  const variety = (payload.variety as string) || ''

  switch (templateCode) {
    case 'sample_received':
      return buildEmail(`
        <h2>Muestra recibida</h2>
        <p>Estimado/a <strong>${clientName}</strong>,</p>
        <p>Su muestra ha sido registrada en nuestro sistema:</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0">
          <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Código</td><td style="padding:8px;border:1px solid #ddd">${sampleCode}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Especie</td><td style="padding:8px;border:1px solid #ddd">${species}${variety ? ` var. ${variety}` : ''}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Fecha</td><td style="padding:8px;border:1px solid #ddd">${payload.received_date || '-'}</td></tr>
        </table>
        <p>Le notificaremos cuando haya actualizaciones.</p>
      `)

    case 'sample_status_change':
      return buildEmail(`
        <h2>Actualización de estado</h2>
        <p>Estimado/a <strong>${clientName}</strong>,</p>
        <p>El estado de su muestra ha cambiado:</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0">
          <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Muestra</td><td style="padding:8px;border:1px solid #ddd">${sampleCode}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Estado</td><td style="padding:8px;border:1px solid #ddd;color:#2563eb;font-weight:bold">${payload.status_label || payload.new_status}</td></tr>
        </table>
      `)

    case 'sample_completed':
      return buildEmail(`
        <h2>Análisis completado</h2>
        <p>Estimado/a <strong>${clientName}</strong>,</p>
        <p>El análisis de su muestra ha finalizado:</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0">
          <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Muestra</td><td style="padding:8px;border:1px solid #ddd">${sampleCode}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Especie</td><td style="padding:8px;border:1px solid #ddd">${species}</td></tr>
        </table>
        <p>Los resultados están siendo validados y se los enviaremos a la brevedad.</p>
      `)

    case 'results_ready':
      return buildEmail(`
        <h2>Resultados disponibles</h2>
        <p>Estimado/a <strong>${clientName}</strong>,</p>
        <p>Los resultados de su muestra están listos:</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0">
          <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Muestra</td><td style="padding:8px;border:1px solid #ddd">${sampleCode}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Diagnóstico</td><td style="padding:8px;border:1px solid #ddd">${payload.diagnosis || 'Ver informe adjunto'}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Patógeno</td><td style="padding:8px;border:1px solid #ddd">${payload.pathogen || 'No detectado'}</td></tr>
        </table>
        <p>Ingrese al sistema para ver el informe completo.</p>
        ${payload.recommendations ? `<div style="background:#f0fdf4;padding:12px;border-radius:8px;margin-top:12px"><strong>Recomendaciones:</strong><br>${payload.recommendations}</div>` : ''}
      `)

    case 'results_validated':
      return buildEmail(`
        <h2>Resultados validados</h2>
        <p>Estimado/a <strong>${clientName}</strong>,</p>
        <p>Los resultados de su muestra han sido validados y están disponibles para descarga:</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0">
          <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Muestra</td><td style="padding:8px;border:1px solid #ddd">${sampleCode}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Conclusión</td><td style="padding:8px;border:1px solid #ddd">${payload.conclusion || 'Ver informe'}</td></tr>
        </table>
      `)

    default:
      return buildEmail(`<p>Notificación de LIMS para muestra ${sampleCode}.</p>`)
  }
}

function buildEmail(body: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f9fafb;margin:0;padding:24px">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
    <div style="background:#16a34a;padding:20px;color:#fff">
      <h1 style="margin:0;font-size:20px">LIMS</h1>
      <p style="margin:4px 0 0;font-size:14px;opacity:0.9">Sistema de Gestión de Laboratorio</p>
    </div>
    <div style="padding:24px">${body}</div>
    <div style="background:#f3f4f6;padding:16px;text-align:center;font-size:12px;color:#6b7280">
      Este es un correo automático de LIMS. No responda a este mensaje.
    </div>
  </div>
</body>
</html>`
}

const STATUS_LABELS: Record<string, string> = {
  received: 'Recibida',
  processing: 'En procesamiento',
  microscopy: 'Microscopía',
  isolation: 'Aislamiento',
  identification: 'Identificación',
  molecular_analysis: 'Análisis molecular',
  validation: 'Validación',
  completed: 'Completada'
}

export async function notifyStatusChange(params: {
  sampleId: string
  sampleCode: string
  newStatus: string
  clientEmail: string
  clientName: string
  species: string
  variety?: string
}) {
  const label = STATUS_LABELS[params.newStatus] || params.newStatus

  await enqueueNotification({
    userId: '', // system-generated
    email: params.clientEmail,
    templateCode: params.newStatus === 'completed' ? 'sample_completed' : 'sample_status_change',
    payload: {
      sample_id: params.sampleId,
      sample_code: params.sampleCode,
      client_name: params.clientName,
      species: params.species,
      variety: params.variety || '',
      new_status: params.newStatus,
      status_label: label
    }
  })
}

export async function notifyResultsReady(params: {
  sampleId: string
  sampleCode: string
  clientEmail: string
  clientName: string
  species: string
  diagnosis?: string
  pathogen?: string
  recommendations?: string
  conclusion?: string
}) {
  await enqueueNotification({
    userId: '',
    email: params.clientEmail,
    templateCode: 'results_validated',
    payload: {
      sample_id: params.sampleId,
      sample_code: params.sampleCode,
      client_name: params.clientName,
      species: params.species,
      diagnosis: params.diagnosis || '',
      pathogen: params.pathogen || '',
      recommendations: params.recommendations || '',
      conclusion: params.conclusion || ''
    }
  })
}
