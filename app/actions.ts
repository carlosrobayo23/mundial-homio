'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

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
