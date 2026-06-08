'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

const ANNOUNCEMENT_FROM = 'Mundial Homio <notifications@homio.ca>'

export async function setParticipantPaid(participantId: string, paid: boolean) {
  // 1. Identificar a quien hace la peticion
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) {
    return { ok: false, error: 'No autenticado' }
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 2. Verificar que quien llama es admin
  const { data: me } = await admin
    .schema('homio')
    .from('participants')
    .select('is_admin')
    .eq('email', user.email)
    .single()

  if (!me?.is_admin) {
    return { ok: false, error: 'No autorizado' }
  }

  // 3. Actualizar el estado de pago del participante
  const { error } = await admin
    .schema('homio')
    .from('participants')
    .update({
      has_paid: paid,
      paid_at: paid ? new Date().toISOString() : null,
      payment_method: paid ? 'admin' : null,
    })
    .eq('id', participantId)

  if (error) {
    return { ok: false, error: error.message }
  }

  revalidatePath('/')
  return { ok: true }
}

type AnnouncementScope = 'all' | 'paid' | 'pending'

type SendAnnouncementInput = {
  subject: string
  body: string
  scope: AnnouncementScope
  testOnly: boolean
}

type SendAnnouncementResult =
  | { ok: true; sent: number; failed: number }
  | { ok: false; error: string }

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderAnnouncementHtml(name: string, body: string) {
  const safeName = escapeHtml(name || 'crack')
  const safeBody = escapeHtml(body).replace(/\n/g, '<br>')
  return `<div style="background:#080810;padding:24px 0;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#0d0d14;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;">
    <div style="padding:20px 24px;border-bottom:1px solid rgba(255,255,255,0.08);">
      <div style="font-size:18px;letter-spacing:2px;color:#ffffff;font-weight:700;">MUNDIAL HOMIO</div>
      <div style="font-size:11px;letter-spacing:3px;color:#00e87a;">2026</div>
    </div>
    <div style="padding:24px;color:#e6e6e6;font-size:15px;line-height:1.6;">
      <p style="margin:0 0 16px;color:#ffffff;">Hola ${safeName},</p>
      <div style="color:rgba(255,255,255,0.85);">${safeBody}</div>
    </div>
    <div style="padding:16px 24px;border-top:1px solid rgba(255,255,255,0.08);font-size:12px;color:rgba(255,255,255,0.4);">
      Mundial Homio 2026 · <a href="https://mundial.homio.ca" style="color:#00e87a;text-decoration:none;">mundial.homio.ca</a>
    </div>
  </div>
</div>`
}

// Envia un anuncio por correo a los participantes usando Resend.
// Solo admins. Llama a Resend directamente (no via API route interna).
export async function sendAnnouncement(input: SendAnnouncementInput): Promise<SendAnnouncementResult> {
  const subject = (input.subject || '').trim()
  const body = (input.body || '').trim()

  if (!subject || !body) {
    return { ok: false, error: 'Asunto y mensaje son obligatorios' }
  }
  if (!process.env.RESEND_API_KEY) {
    return { ok: false, error: 'Falta RESEND_API_KEY en el entorno' }
  }

  // 1. Identificar a quien hace la peticion
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) {
    return { ok: false, error: 'No autenticado' }
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 2. Verificar que quien llama es admin y obtener su nombre
  const { data: me } = await admin
    .schema('homio')
    .from('participants')
    .select('is_admin, name')
    .eq('email', user.email)
    .single()

  if (!me?.is_admin) {
    return { ok: false, error: 'No autorizado' }
  }

  // 3. Armar la lista de destinatarios
  let recipients: { email: string; name: string }[] = []

  if (input.testOnly) {
    recipients = [{ email: user.email, name: me.name || 'crack' }]
  } else {
    let query = admin
      .schema('homio')
      .from('participants')
      .select('email, name')
      .not('email', 'is', null)

    if (input.scope === 'paid') query = query.eq('has_paid', true)
    if (input.scope === 'pending') query = query.eq('has_paid', false)

    const { data: rows, error: rowsError } = await query
    if (rowsError) {
      return { ok: false, error: rowsError.message }
    }
    recipients = (rows || [])
      .filter(r => !!r.email)
      .map(r => ({ email: r.email as string, name: (r.name as string) || 'crack' }))
  }

  if (recipients.length === 0) {
    return { ok: false, error: 'No hay destinatarios para ese filtro' }
  }

  // 4. Enviar por Resend en lotes de hasta 100 (endpoint batch)
  let sent = 0
  let failed = 0
  const chunkSize = 100

  for (let i = 0; i < recipients.length; i += chunkSize) {
    const chunk = recipients.slice(i, i + chunkSize)
    const payload = chunk.map(r => ({
      from: ANNOUNCEMENT_FROM,
      to: [r.email],
      reply_to: user.email,
      subject,
      html: renderAnnouncementHtml(r.name, body),
    }))

    try {
      const res = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        sent += chunk.length
      } else {
        failed += chunk.length
        const detail = await res.text()
        console.error('Resend batch error:', res.status, detail)
      }
    } catch (e) {
      failed += chunk.length
      console.error('Resend batch exception:', e)
    }
  }

  if (sent === 0) {
    return { ok: false, error: 'No se pudo enviar ningun correo. Revisa los logs en Vercel.' }
  }

  return { ok: true, sent, failed }
}
