import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import DashboardClient from '@/components/DashboardClient'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const [
    { data: participant },
    { data: leaderboard },
    { data: matches },
  ] = await Promise.all([
    admin.schema('homio').from('participants').select('*').eq('email', user.email!).single(),
    admin.schema('homio').from('leaderboard').select('*'),
    admin.schema('homio').from('matches').select('*').order('match_date', { ascending: true }),
  ])

  let myPredictions: any[] = []
  if (participant) {
    const { data } = await admin.schema('homio').from('predictions').select('*').eq('participant_id', participant.id)
    myPredictions = data || []
  }

  let allParticipants: any[] = []
  if (participant?.is_admin) {
    const { data } = await admin
      .schema('homio')
      .from('participants')
      .select('*')
      .order('has_paid', { ascending: true })
      .order('created_at', { ascending: true })
    allParticipants = data || []
  }

  return (
    <DashboardClient
      participant={participant}
      leaderboard={leaderboard || []}
      matches={matches || []}
      myPredictions={myPredictions}
      allParticipants={allParticipants}
    />
  )
}
