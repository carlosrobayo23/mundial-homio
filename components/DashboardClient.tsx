'use client'
import { useState, useEffect } from 'react'
import { Participant, LeaderboardEntry, Match, PredictionRow, Prediction } from '@/lib/types'
import { createClient } from '@/lib/supabase'
import { setParticipantPaid, sendAnnouncement } from '@/app/actions'
import Flag from '@/components/Flag'

interface Props {
  participant: Participant | null
  leaderboard: LeaderboardEntry[]
  matches: Match[]
  myPredictions: PredictionRow[]
  allParticipants: Participant[]
}

type Tab = 'picks' | 'bonus' | 'standings' | 'results' | 'reglas' | 'payment' | 'admin'

// Bonus Picks
const BONUS_POINTS = 100

type PointKey = 'champion_points' | 'mvp_points' | 'top_scorer_points'

type PlayerGroup = { country: string; players: string[] }

type SpecialRow = {
  id: string
  participant_id: string
  champion: string | null
  mvp: string | null
  top_scorer: string | null
  champion_points: number
  mvp_points: number
  top_scorer_points: number
  updated_at: string | null
}

const MVP_OPTIONS: PlayerGroup[] = [
  { country: 'Argentina', players: ['Messi'] },
  { country: 'Bélgica', players: ['De Bruyne', 'Doku'] },
  { country: 'Brasil', players: ['Vinícius Júnior', 'Raphinha'] },
  { country: 'Colombia', players: ['Luis Díaz', 'James Rodríguez'] },
  { country: 'Croacia', players: ['Modrić'] },
  { country: 'Egipto', players: ['Salah'] },
  { country: 'Inglaterra', players: ['Kane', 'Bellingham', 'Declan Rice', 'Saka'] },
  { country: 'Francia', players: ['Mbappé', 'Olise', 'Cherki', 'Dembélé'] },
  { country: 'Alemania', players: ['Wirtz'] },
  { country: 'México', players: ['Edson Álvarez'] },
  { country: 'Marruecos', players: ['Hakimi'] },
  { country: 'Noruega', players: ['Haaland'] },
  { country: 'Portugal', players: ['Bruno Fernandes', 'Vitinha', 'Cristiano Ronaldo'] },
  { country: 'España', players: ['Lamine Yamal', 'Pedri', 'Rodri'] },
  { country: 'Uruguay', players: ['Valverde'] },
  { country: 'USA', players: ['Pulisic'] },
]

const SCORER_OPTIONS: PlayerGroup[] = [
  { country: 'Argentina', players: ['Messi', 'Julián Álvarez', 'Lautaro Martínez'] },
  { country: 'Brasil', players: ['Vinícius Júnior', 'Raphinha'] },
  { country: 'Canadá', players: ['Jonathan David'] },
  { country: 'Colombia', players: ['Luis Suárez', 'Luis Díaz', 'James Rodríguez'] },
  { country: 'Egipto', players: ['Salah'] },
  { country: 'Inglaterra', players: ['Kane', 'Saka'] },
  { country: 'Francia', players: ['Mbappé', 'Dembélé', 'Cherki'] },
  { country: 'Alemania', players: ['Wirtz'] },
  { country: 'México', players: ['Raúl Jiménez', 'Santiago Giménez'] },
  { country: 'Noruega', players: ['Haaland'] },
  { country: 'Portugal', players: ['Cristiano Ronaldo', 'Bruno Fernandes'] },
  { country: 'España', players: ['Lamine Yamal', 'Oyarzabal'] },
  { country: 'Uruguay', players: ['Valverde'] },
  { country: 'USA', players: ['Pulisic'] },
]

const TEAM_ES: Record<string, string> = {
  'Algeria': 'Argelia', 'Argentina': 'Argentina', 'Australia': 'Australia', 'Austria': 'Austria',
  'Belgium': 'Bélgica', 'Bosnia and Herzegovina': 'Bosnia y Herzegovina', 'Brazil': 'Brasil',
  'Canada': 'Canadá', 'Cape Verde': 'Cabo Verde', 'Colombia': 'Colombia', 'Croatia': 'Croacia',
  'Curacao': 'Curazao', 'Czechia': 'Chequia', 'DR Congo': 'RD Congo', 'Ecuador': 'Ecuador',
  'Egypt': 'Egipto', 'England': 'Inglaterra', 'France': 'Francia', 'Germany': 'Alemania',
  'Ghana': 'Ghana', 'Haiti': 'Haití', 'Iran': 'Irán', 'Iraq': 'Irak', 'Ivory Coast': 'Costa de Marfil',
  'Japan': 'Japón', 'Jordan': 'Jordania', 'Mexico': 'México', 'Morocco': 'Marruecos',
  'Netherlands': 'Países Bajos', 'New Zealand': 'Nueva Zelanda', 'Norway': 'Noruega',
  'Panama': 'Panamá', 'Paraguay': 'Paraguay', 'Portugal': 'Portugal', 'Qatar': 'Catar',
  'Saudi Arabia': 'Arabia Saudita', 'Scotland': 'Escocia', 'Senegal': 'Senegal',
  'South Africa': 'Sudáfrica', 'South Korea': 'Corea del Sur', 'Spain': 'España',
  'Sweden': 'Suecia', 'Switzerland': 'Suiza', 'Tunisia': 'Túnez', 'Turkiye': 'Turquía',
  'United States': 'Estados Unidos', 'Uruguay': 'Uruguay', 'Uzbekistan': 'Uzbekistán',
}

function teamName(en: string): string {
  if (TEAM_ES[en]) return TEAM_ES[en]
  if (en.startsWith('W Group ')) return '1° Grupo ' + en.slice(8)
  if (en.startsWith('RU Group ')) return '2° Grupo ' + en.slice(9)
  if (en.startsWith('3rd ')) return '3° ' + en.slice(4)
  if (en.startsWith('TBD')) return 'Por definir'
  return en
}

const SHORT_ES: Record<string, string> = {
  'Estados Unidos': 'EE.UU.', 'Corea del Sur': 'Corea S.', 'Bosnia y Herzegovina': 'Bosnia',
  'Países Bajos': 'P. Bajos', 'Nueva Zelanda': 'N. Zelanda', 'Arabia Saudita': 'A. Saudita',
  'Costa de Marfil': 'C. Marfil', 'Cabo Verde': 'C. Verde',
}

function abbreviate(en: string): string {
  const es = teamName(en)
  return SHORT_ES[es] || (es.length > 10 ? es.split(' ')[0] : es)
}

function formatTime(dateStr: string) {
  const date = new Date(dateStr)
  const day = date.toLocaleDateString('es', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/Bogota' })
  const time = date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'America/Bogota' })
  return { day, time }
}

function formatSaved(iso: string) {
  return new Date(iso).toLocaleString('es', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'America/Bogota',
  }) + ' COT'
}

function groupByDay(matches: Match[]) {
  const sorted = [...matches].sort((a, b) => new Date(a.match_date).getTime() - new Date(b.match_date).getTime())
  const groups: Record<string, Match[]> = {}
  sorted.forEach(m => {
    const day = new Date(m.match_date).toLocaleDateString('es', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/Bogota' })
    if (!groups[day]) groups[day] = []
    groups[day].push(m)
  })
  return groups
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return isMobile
}

export default function DashboardClient({ participant, leaderboard, matches, myPredictions, allParticipants = [] }: Props) {
  const [tab, setTab] = useState<Tab>(participant?.has_paid ? 'picks' : 'payment')
  const [predictions, setPredictions] = useState<Record<string, Prediction | null>>(
    Object.fromEntries(myPredictions.map(p => [p.match_id, p.prediction]))
  )
  const [saving, setSaving] = useState<string | null>(null)
  const [participants, setParticipants] = useState<Participant[]>(allParticipants)
  const [savingPaid, setSavingPaid] = useState<string | null>(null)

  // Bonus Picks state
  const [bonusChampion, setBonusChampion] = useState('')
  const [bonusMvp, setBonusMvp] = useState('')
  const [bonusScorer, setBonusScorer] = useState('')
  const [bonusSavedAt, setBonusSavedAt] = useState<string | null>(null)
  const [savingBonus, setSavingBonus] = useState(false)
  const [allBonus, setAllBonus] = useState<SpecialRow[]>([])
  const [bonusAdminEdits, setBonusAdminEdits] = useState<Record<string, { champion_points: number; mvp_points: number; top_scorer_points: number }>>({})
  const [savingBonusAdmin, setSavingBonusAdmin] = useState<string | null>(null)

  // Anuncio por correo (admin)
  const [annSubject, setAnnSubject] = useState('')
  const [annBody, setAnnBody] = useState('')
  const [annScope, setAnnScope] = useState<'all' | 'paid' | 'pending'>('all')
  const [annSending, setAnnSending] = useState<'test' | 'send' | null>(null)
  const [annResult, setAnnResult] = useState<string | null>(null)

  const supabase = createClient()
  const isMobile = useIsMobile()

  // Carga las Bonus Picks del usuario (y todas, si es admin)
  useEffect(() => {
    if (!participant) return
    let active = true
    ;(async () => {
      const { data: mine } = await supabase.schema('homio').from('special_predictions')
        .select('*').eq('participant_id', participant.id).maybeSingle()
      if (active && mine) {
        setBonusChampion(mine.champion || '')
        setBonusMvp(mine.mvp || '')
        setBonusScorer(mine.top_scorer || '')
        setBonusSavedAt(mine.updated_at)
      }
      if (participant.is_admin) {
        const { data: all } = await supabase.schema('homio').from('special_predictions').select('*')
        if (active && all) setAllBonus(all as SpecialRow[])
      }
    })()
    return () => { active = false }
  }, [participant?.id])

  async function togglePrediction(matchId: string, value: Prediction) {
    if (!participant?.has_paid) { setTab('payment'); return }
    if (!participant) return
    setSaving(matchId)
    const current = predictions[matchId]
    if (current === value) {
      setPredictions(prev => ({ ...prev, [matchId]: null }))
      await supabase.schema('homio').from('predictions').delete().match({ participant_id: participant.id, match_id: matchId })
    } else {
      setPredictions(prev => ({ ...prev, [matchId]: value }))
      await supabase.schema('homio').from('predictions').upsert({
        participant_id: participant.id, match_id: matchId, prediction: value,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'participant_id,match_id' })
    }
    setSaving(null)
  }

  async function togglePaid(p: Participant) {
    setSavingPaid(p.id)
    const newPaid = !p.has_paid
    const res = await setParticipantPaid(p.id, newPaid)
    if (res.ok) {
      setParticipants(prev => prev.map(x => x.id === p.id
        ? { ...x, has_paid: newPaid, paid_at: newPaid ? new Date().toISOString() : undefined }
        : x))
    } else {
      alert(res.error || 'Error al actualizar el pago')
    }
    setSavingPaid(null)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  async function saveBonus() {
    if (!participant) return
    if (!participant.has_paid) { setTab('payment'); return }
    if (bonusLocked) return
    if (!bonusChampion || !bonusMvp || !bonusScorer) {
      alert('Selecciona Campeón, MVP y Goleador antes de guardar.')
      return
    }
    setSavingBonus(true)
    const nowIso = new Date().toISOString()
    const { data, error } = await supabase.schema('homio').from('special_predictions').upsert({
      participant_id: participant.id,
      champion: bonusChampion,
      mvp: bonusMvp,
      top_scorer: bonusScorer,
      updated_at: nowIso,
    }, { onConflict: 'participant_id' }).select().maybeSingle()
    if (error) {
      alert('No se pudo guardar: ' + error.message)
    } else if (data) {
      const row = data as SpecialRow
      setBonusSavedAt(row.updated_at)
      setAllBonus(prev => {
        const others = prev.filter(r => r.participant_id !== row.participant_id)
        return [...others, row]
      })
    }
    setSavingBonus(false)
  }

  function bonusEditFor(row: SpecialRow) {
    return bonusAdminEdits[row.id] || {
      champion_points: row.champion_points,
      mvp_points: row.mvp_points,
      top_scorer_points: row.top_scorer_points,
    }
  }

  function setBonusEdit(rowId: string, key: PointKey, value: number) {
    setBonusAdminEdits(prev => {
      const r = allBonus.find(x => x.id === rowId)
      const base = prev[rowId] || {
        champion_points: r?.champion_points || 0,
        mvp_points: r?.mvp_points || 0,
        top_scorer_points: r?.top_scorer_points || 0,
      }
      return { ...prev, [rowId]: { ...base, [key]: value } }
    })
  }

  async function saveBonusPoints(row: SpecialRow) {
    setSavingBonusAdmin(row.id)
    const edit = bonusEditFor(row)
    const { data, error } = await supabase.schema('homio').from('special_predictions').update({
      champion_points: edit.champion_points,
      mvp_points: edit.mvp_points,
      top_scorer_points: edit.top_scorer_points,
    }).eq('id', row.id).select().maybeSingle()
    if (error) {
      alert('No se pudieron guardar los puntos: ' + error.message)
    } else if (data) {
      const updated = data as SpecialRow
      setAllBonus(prev => prev.map(r => r.id === updated.id ? updated : r))
      setBonusAdminEdits(prev => { const c = { ...prev }; delete c[row.id]; return c })
    }
    setSavingBonusAdmin(null)
  }

  async function handleSendAnnouncement(testOnly: boolean) {
    if (!annSubject.trim() || !annBody.trim()) {
      alert('Escribe asunto y mensaje antes de enviar.')
      return
    }
    if (!testOnly) {
      const count = annScope === 'all' ? participants.length : annScope === 'paid' ? paidCount : pendingCount
      if (!window.confirm(`Vas a enviar este anuncio a ${count} ${count === 1 ? 'persona' : 'personas'}. ¿Continuar?`)) return
    }
    setAnnSending(testOnly ? 'test' : 'send')
    setAnnResult(null)
    const res = await sendAnnouncement({ subject: annSubject, body: annBody, scope: annScope, testOnly })
    if (res.ok) {
      setAnnResult(testOnly ? 'Prueba enviada a tu correo.' : `Enviado a ${res.sent}. Fallidos: ${res.failed}.`)
    } else {
      setAnnResult('Error: ' + (res.error || 'no se pudo enviar'))
    }
    setAnnSending(null)
  }

  const groupedMatches = groupByDay(matches)
  const myPredCount = Object.values(predictions).filter(Boolean).length
  const totalMatches = matches.length
  const progress = totalMatches > 0 ? Math.round((myPredCount / totalMatches) * 100) : 0
  const myRank = leaderboard.findIndex(e => e.email === participant?.email) + 1
  const myEntry = leaderboard.find(e => e.email === participant?.email)
  const totalPool = leaderboard.filter(e => e.has_paid).length * 10
  const prizePool = Math.round(totalPool * 0.8)

  const isTeamConfirmed = (team: string) =>
    !['TBD', 'W Group', 'RU Group', 'Best', '3rd', 'Winner', 'Runner'].some(p => team.startsWith(p))

  const phaseLabel = (phase: string, group?: string) => {
    if (phase === 'groups') return `GRP ${group}`
    if (phase === 'round_of_32') return 'R32'
    if (phase === 'round_of_16') return 'R16'
    if (phase === 'quarterfinals') return 'CF'
    if (phase === 'semifinals') return 'SF'
    if (phase === 'third_place') return '3ER'
    if (phase === 'final') return 'FINAL'
    return phase
  }

  const paidCount = participants.filter(p => p.has_paid).length
  const pendingCount = participants.filter(p => !p.has_paid).length
  const sortedParticipants = [...participants].sort((a, b) => Number(a.has_paid) - Number(b.has_paid))

  // Bonus Picks: bloqueo por primer partido y opciones derivadas
  const firstMatchTime = matches.length ? Math.min(...matches.map(m => new Date(m.match_date).getTime())) : 0
  const bonusLocked = firstMatchTime > 0 && Date.now() >= firstMatchTime
  const bonusComplete = !!(bonusChampion && bonusMvp && bonusScorer)
  const championTeams = Array.from(
    new Set(matches.filter(m => m.phase === 'groups').flatMap(m => [m.home_team, m.away_team]))
  )
    .filter(t => isTeamConfirmed(t))
    .sort((a, b) => teamName(a).localeCompare(teamName(b), 'es'))
  const bonusSelectStyle = {
    width: '100%', padding: '13px 14px', background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', color: '#fff',
    fontSize: '15px', fontFamily: "'DM Sans', sans-serif",
  }
  const bonusOptStyle = { background: '#0d0d14', color: '#fff' }

  const bonusSummary = [
    { label: 'Campeón', value: bonusChampion ? teamName(bonusChampion) : null },
    { label: 'MVP', value: bonusMvp || null },
    { label: 'Goleador', value: bonusScorer || null },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#080810', fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <header style={{ background: 'rgba(13,13,20,0.97)', borderBottom: '1px solid rgba(255,255,255,0.06)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: isMobile ? '0 14px' : '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '64px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '24px' }}>⚽</span>
            <div>
              <div className="font-display" style={{ fontSize: '18px', letterSpacing: '2px', color: '#fff', lineHeight: 1 }}>MUNDIAL HOMIO</div>
              <div style={{ fontSize: '10px', color: '#00e87a', letterSpacing: '3px' }}>2026</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '12px' }}>
            {myRank > 0 && participant?.has_paid && (
              <div style={{ background: 'rgba(0,232,122,0.08)', border: '1px solid rgba(0,232,122,0.15)', borderRadius: '8px', padding: '5px 10px', fontSize: '12px', color: '#00e87a' }}>
                #{myRank} · {myEntry?.total_points || 0} pts
              </div>
            )}
            {!participant?.has_paid && (
              <div style={{ background: 'rgba(255,107,53,0.1)', border: '1px solid rgba(255,107,53,0.3)', borderRadius: '8px', padding: '5px 10px', fontSize: '11px', color: '#ff6b35' }}>
                Pago pendiente
              </div>
            )}
            {participant?.avatar_url ? (
              <img src={participant.avatar_url} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%', border: '1.5px solid rgba(0,232,122,0.4)' }} />
            ) : (
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(0,232,122,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: '#00e87a' }}>
                {participant?.name?.[0]?.toUpperCase()}
              </div>
            )}
            {!isMobile && <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>{participant?.name}</span>}
            <button onClick={handleLogout} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.35)', padding: '5px 10px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
              Salir
            </button>
          </div>
        </div>
      </header>

      {/* Progress bar */}
      {participant?.has_paid && (
        <div style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.04)', padding: '10px 24px' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ flex: 1, height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px' }}>
              <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, #00e87a, #00c866)', borderRadius: '2px', transition: 'width 0.4s' }} />
            </div>
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap' }}>{myPredCount} de {totalMatches} predicciones · {progress}%</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: isMobile ? '0 8px' : '0 24px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {([
            { key: 'picks', label: 'Mis Predicciones', icon: '✏️' },
            { key: 'bonus', label: 'Bonus Picks', icon: '🎯' },
            { key: 'standings', label: 'Clasificación', icon: '🏆' },
            { key: 'results', label: 'Resultados', icon: '📊' },
            { key: 'reglas', label: 'Reglas', icon: '📋' },
            { key: 'payment', label: 'Pagar', icon: '💳' },
            ...(participant?.is_admin ? [{ key: 'admin', label: 'Admin', icon: '🛠️' }] : []),
          ] as { key: Tab; label: string; icon: string }[]).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: isMobile ? '12px 13px' : '14px 18px', background: 'transparent', border: 'none',
              whiteSpace: 'nowrap', flexShrink: 0,
              borderBottom: tab === t.key ? '2px solid #00e87a' : '2px solid transparent',
              color: tab === t.key ? '#fff' : 'rgba(255,255,255,0.35)',
              cursor: 'pointer', fontSize: '13px', fontWeight: tab === t.key ? 600 : 400,
              fontFamily: "'DM Sans', sans-serif",
              display: 'flex', alignItems: 'center', gap: '6px',
              marginBottom: '-1px', transition: 'color 0.15s',
              position: 'relative',
            }}>
              {t.icon} {t.label}
              {t.key === 'payment' && !participant?.has_paid && (
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ff6b35', position: 'absolute', top: '10px', right: '6px' }} />
              )}
              {t.key === 'admin' && pendingCount > 0 && (
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#ff6b35', background: 'rgba(255,107,53,0.12)', borderRadius: '100px', padding: '1px 7px', marginLeft: '2px' }}>{pendingCount}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: isMobile ? '20px 14px' : '32px 24px' }}>

        {/* PICKS TAB */}
        {tab === 'picks' && (
          <div>
            <div style={{ marginBottom: '32px' }}>
              <h2 className="font-display" style={{ fontSize: '36px', letterSpacing: '2px', color: '#fff', marginBottom: '6px' }}>Mis Predicciones</h2>
              <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.35)' }}>
                {participant?.has_paid
                  ? 'Selecciona el resultado antes del inicio de cada partido. Haz click de nuevo para quitar tu predicción.'
                  : 'Debes completar tu pago para poder hacer predicciones.'}
              </p>
            </div>
            {!participant?.has_paid && (
              <div style={{
                background: 'rgba(255,107,53,0.08)', border: '1px solid rgba(255,107,53,0.25)',
                borderRadius: '14px', padding: '24px', textAlign: 'center', marginBottom: '32px',
              }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔒</div>
                <div style={{ fontSize: '16px', fontWeight: 600, color: '#fff', marginBottom: '8px' }}>Pago pendiente</div>
                <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', marginBottom: '16px' }}>Completa tu inscripción (10 USD, 14 CAD o 36.000 COP) para desbloquear las predicciones.</div>
                <button onClick={() => setTab('payment')} style={{
                  background: '#ff6b35', border: 'none', borderRadius: '10px', padding: '12px 24px',
                  color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                }}>Ver instrucciones de pago</button>
              </div>
            )}
            {participant?.has_paid && !bonusLocked && (
              <div style={{
                background: 'rgba(0,232,122,0.08)', border: '1px solid rgba(0,232,122,0.25)',
                borderRadius: '14px', padding: isMobile ? '16px' : '18px 24px', marginBottom: '32px',
                display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap',
              }}>
                <span style={{ fontSize: '28px' }}>🎯</span>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: '#fff', marginBottom: '4px' }}>
                    {bonusComplete ? 'Tus Bonus Picks están guardadas' : 'Nueva sección: Bonus Picks'}
                  </div>
                  <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>
                    {bonusComplete
                      ? 'Puedes cambiar tu Campeón, MVP y Goleador hasta que arranque el Mundial (11 de junio).'
                      : 'Elige Campeón, MVP y Goleador del torneo (100 puntos cada una). Se cierran al arrancar el Mundial.'}
                  </div>
                </div>
                <button onClick={() => setTab('bonus')} style={{
                  background: '#00e87a', border: 'none', borderRadius: '10px', padding: '12px 20px',
                  color: '#000', fontSize: '14px', fontWeight: 700, cursor: 'pointer',
                  fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap',
                }}>{bonusComplete ? 'Ver Bonus Picks' : 'Ir a Bonus Picks'}</button>
              </div>
            )}
            {Object.entries(groupedMatches).map(([day, dayMatches]) => (
              <div key={day} style={{ marginBottom: '40px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <span className="font-display" style={{ fontSize: '12px', letterSpacing: '3px', color: '#00e87a', background: 'rgba(0,232,122,0.08)', border: '1px solid rgba(0,232,122,0.15)', padding: '4px 10px', borderRadius: '4px' }}>
                    {day.toUpperCase()}
                  </span>
                  <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)' }}>Hora Colombia (COT)</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {dayMatches.map(match => {
                    const isPast = new Date(match.match_date) < new Date()
                    const current = predictions[match.id]
                    const confirmed = isTeamConfirmed(match.home_team) && isTeamConfirmed(match.away_team)
                    const { time } = formatTime(match.match_date)
                    const predictable = !isPast && confirmed && participant?.has_paid
                    const options = [
                      { value: '1' as Prediction, label: abbreviate(match.home_team) },
                      { value: 'X' as Prediction, label: 'Empate' },
                      { value: '2' as Prediction, label: abbreviate(match.away_team) },
                    ]

                    if (isMobile) {
                      return (
                        <div key={match.id} style={{
                          background: current ? 'rgba(0,232,122,0.04)' : 'rgba(255,255,255,0.02)',
                          border: current ? '1px solid rgba(0,232,122,0.15)' : '1px solid rgba(255,255,255,0.06)',
                          borderRadius: '12px', padding: '12px 14px',
                          opacity: isPast && match.status !== 'finished' ? 0.5 : 1,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', letterSpacing: '1px', fontWeight: 700 }}>
                              {phaseLabel(match.phase, match.group_name)}
                            </span>
                            {match.status === 'finished' ? (
                              <span className="font-display" style={{ fontSize: '16px', color: '#00e87a', letterSpacing: '1px' }}>
                                {match.home_score} - {match.away_score}
                              </span>
                            ) : (
                              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>{time} COT</span>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: predictable || (isPast && current) || !confirmed || !participant?.has_paid ? '10px' : '0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flex: 1, minWidth: 0 }}>
                              <Flag code={match.home_flag_code} size={22} />
                              <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>{teamName(match.home_team)}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flex: 1, minWidth: 0, justifyContent: 'flex-end' }}>
                              <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff', textAlign: 'right' }}>{teamName(match.away_team)}</span>
                              <Flag code={match.away_flag_code} size={22} />
                            </div>
                          </div>
                          {predictable ? (
                            <div style={{ display: 'flex', gap: '6px' }}>
                              {options.map(opt => (
                                <button key={opt.value} onClick={() => togglePrediction(match.id, opt.value)} disabled={saving === match.id} style={{
                                  flex: 1, padding: '10px 4px',
                                  background: current === opt.value ? '#00e87a' : 'rgba(255,255,255,0.05)',
                                  border: current === opt.value ? '1px solid #00e87a' : '1px solid rgba(255,255,255,0.1)',
                                  borderRadius: '8px', color: current === opt.value ? '#000' : 'rgba(255,255,255,0.5)',
                                  fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                                  fontFamily: "'DM Sans', sans-serif", transition: 'all 0.15s', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                }}>{opt.label}</button>
                              ))}
                            </div>
                          ) : isPast && current ? (
                            <div style={{ padding: '8px', textAlign: 'center', background: 'rgba(0,232,122,0.08)', border: '1px solid rgba(0,232,122,0.2)', borderRadius: '8px', fontSize: '12px', fontWeight: 700, color: '#00e87a' }}>
                              Tu pick: {current === '1' ? abbreviate(match.home_team) : current === 'X' ? 'Empate' : abbreviate(match.away_team)}
                            </div>
                          ) : !confirmed ? (
                            <div style={{ textAlign: 'center', fontSize: '11px', color: 'rgba(255,255,255,0.25)' }}>Por confirmar</div>
                          ) : !participant?.has_paid ? (
                            <div style={{ textAlign: 'center', fontSize: '11px', color: 'rgba(255,107,53,0.6)' }}>🔒 Completa tu pago para predecir</div>
                          ) : null}
                        </div>
                      )
                    }

                    return (
                      <div key={match.id} style={{
                        background: current ? 'rgba(0,232,122,0.04)' : 'rgba(255,255,255,0.02)',
                        border: current ? '1px solid rgba(0,232,122,0.15)' : '1px solid rgba(255,255,255,0.06)',
                        borderRadius: '12px', padding: '14px 20px',
                        opacity: isPast && match.status !== 'finished' ? 0.5 : 1,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>{teamName(match.home_team)}</span>
                            <Flag code={match.home_flag_code} size={24} />
                          </div>
                          <div style={{ textAlign: 'center', minWidth: '80px' }}>
                            {match.status === 'finished' ? (
                              <span className="font-display" style={{ fontSize: '20px', color: '#00e87a', letterSpacing: '2px' }}>
                                {match.home_score} - {match.away_score}
                              </span>
                            ) : (
                              <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '6px', padding: '4px 10px', display: 'inline-block' }}>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>{time}</div>
                                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', letterSpacing: '1px' }}>COT</div>
                              </div>
                            )}
                          </div>
                          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Flag code={match.away_flag_code} size={24} />
                            <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>{teamName(match.away_team)}</span>
                          </div>
                          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)', letterSpacing: '1px', minWidth: '48px', textAlign: 'center' }}>
                            {phaseLabel(match.phase, match.group_name)}
                          </span>
                          {!isPast && confirmed && participant?.has_paid ? (
                            <div style={{ display: 'flex', gap: '4px', marginLeft: '8px' }}>
                              {([
                                { value: '1' as Prediction, label: abbreviate(match.home_team) },
                                { value: 'X' as Prediction, label: 'Empate' },
                                { value: '2' as Prediction, label: abbreviate(match.away_team) },
                              ]).map(opt => (
                                <button key={opt.value} onClick={() => togglePrediction(match.id, opt.value)} disabled={saving === match.id} style={{
                                  padding: '6px 10px', height: '36px',
                                  background: current === opt.value ? '#00e87a' : 'rgba(255,255,255,0.05)',
                                  border: current === opt.value ? '1px solid #00e87a' : '1px solid rgba(255,255,255,0.1)',
                                  borderRadius: '8px', color: current === opt.value ? '#000' : 'rgba(255,255,255,0.5)',
                                  fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                                  fontFamily: "'DM Sans', sans-serif", transition: 'all 0.15s', whiteSpace: 'nowrap',
                                }}>{opt.label}</button>
                              ))}
                            </div>
                          ) : isPast && current ? (
                            <div style={{ marginLeft: '8px', padding: '6px 10px', height: '36px', display: 'flex', alignItems: 'center', background: 'rgba(0,232,122,0.08)', border: '1px solid rgba(0,232,122,0.2)', borderRadius: '8px', fontSize: '11px', fontWeight: 700, color: '#00e87a', whiteSpace: 'nowrap' }}>
                              {current === '1' ? abbreviate(match.home_team) : current === 'X' ? 'Empate' : abbreviate(match.away_team)}
                            </div>
                          ) : !confirmed ? (
                            <div style={{ marginLeft: '8px', padding: '6px 10px', fontSize: '10px', color: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px' }}>Por confirmar</div>
                          ) : !participant?.has_paid ? (
                            <div style={{ marginLeft: '8px', padding: '6px 10px', fontSize: '10px', color: 'rgba(255,107,53,0.5)', border: '1px solid rgba(255,107,53,0.1)', borderRadius: '8px' }}>🔒</div>
                          ) : null}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* BONUS PICKS TAB */}
        {tab === 'bonus' && (
          <div>
            <div style={{ marginBottom: '24px' }}>
              <h2 className="font-display" style={{ fontSize: '36px', letterSpacing: '2px', color: '#fff', marginBottom: '6px' }}>Bonus Picks</h2>
              <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.35)' }}>
                Tres selecciones especiales para todo el torneo: Campeón, MVP y Goleador. Valen 100 puntos cada una. Se cierran cuando arranca el Mundial (primer partido).
              </p>
            </div>

            {/* Recuadro verde fijo con las selecciones guardadas */}
            <div style={{
              position: 'sticky', top: '64px', zIndex: 10,
              background: 'rgba(0,232,122,0.08)', border: '1px solid rgba(0,232,122,0.25)',
              borderRadius: '14px', padding: isMobile ? '14px 16px' : '16px 20px', marginBottom: '24px',
              backdropFilter: 'blur(8px)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                <span className="font-display" style={{ fontSize: '12px', letterSpacing: '2px', color: '#00e87a' }}>TUS BONUS PICKS GUARDADOS</span>
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>
                  {bonusSavedAt ? `Último guardado: ${formatSaved(bonusSavedAt)}` : 'Aún no has guardado'}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '10px' }}>
                {bonusSummary.map(item => (
                  <div key={item.label} style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '10px 14px' }}>
                    <div style={{ fontSize: '10px', letterSpacing: '1px', color: 'rgba(255,255,255,0.35)', marginBottom: '4px' }}>{item.label.toUpperCase()} · 100 PTS</div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: item.value ? '#fff' : 'rgba(255,255,255,0.25)' }}>{item.value || 'Sin elegir'}</div>
                  </div>
                ))}
              </div>
            </div>

            {!participant?.has_paid ? (
              <div style={{
                background: 'rgba(255,107,53,0.08)', border: '1px solid rgba(255,107,53,0.25)',
                borderRadius: '14px', padding: '24px', textAlign: 'center',
              }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔒</div>
                <div style={{ fontSize: '16px', fontWeight: 600, color: '#fff', marginBottom: '8px' }}>Pago pendiente</div>
                <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', marginBottom: '16px' }}>Completa tu inscripción para desbloquear las Bonus Picks.</div>
                <button onClick={() => setTab('payment')} style={{
                  background: '#ff6b35', border: 'none', borderRadius: '10px', padding: '12px 24px',
                  color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                }}>Ver instrucciones de pago</button>
              </div>
            ) : bonusLocked ? (
              <div style={{
                background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '14px', padding: '24px', textAlign: 'center',
              }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔒</div>
                <div style={{ fontSize: '16px', fontWeight: 600, color: '#fff', marginBottom: '8px' }}>Bonus Picks cerradas</div>
                <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)' }}>El torneo ya comenzó, así que ya no se pueden modificar. Tus selecciones quedaron registradas arriba.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Campeón */}
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', padding: isMobile ? '16px' : '20px 24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontSize: '15px', fontWeight: 600, color: '#fff' }}>🏆 Campeón del torneo</span>
                    <span className="font-display" style={{ fontSize: '13px', color: '#00e87a' }}>100 pts</span>
                  </div>
                  <select value={bonusChampion} onChange={e => setBonusChampion(e.target.value)} style={bonusSelectStyle}>
                    <option value="" style={bonusOptStyle}>Selecciona un equipo</option>
                    {championTeams.map(t => (
                      <option key={t} value={t} style={bonusOptStyle}>{teamName(t)}</option>
                    ))}
                  </select>
                </div>

                {/* MVP */}
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', padding: isMobile ? '16px' : '20px 24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontSize: '15px', fontWeight: 600, color: '#fff' }}>⭐ MVP del torneo</span>
                    <span className="font-display" style={{ fontSize: '13px', color: '#00e87a' }}>100 pts</span>
                  </div>
                  <select value={bonusMvp} onChange={e => setBonusMvp(e.target.value)} style={bonusSelectStyle}>
                    <option value="" style={bonusOptStyle}>Selecciona un jugador</option>
                    {MVP_OPTIONS.map(g => (
                      <optgroup key={g.country} label={g.country} style={bonusOptStyle}>
                        {g.players.map(p => (
                          <option key={g.country + '_' + p} value={p} style={bonusOptStyle}>{p}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                {/* Goleador */}
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', padding: isMobile ? '16px' : '20px 24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontSize: '15px', fontWeight: 600, color: '#fff' }}>⚽ Goleador del torneo</span>
                    <span className="font-display" style={{ fontSize: '13px', color: '#00e87a' }}>100 pts</span>
                  </div>
                  <select value={bonusScorer} onChange={e => setBonusScorer(e.target.value)} style={bonusSelectStyle}>
                    <option value="" style={bonusOptStyle}>Selecciona un jugador</option>
                    {SCORER_OPTIONS.map(g => (
                      <optgroup key={g.country} label={g.country} style={bonusOptStyle}>
                        {g.players.map(p => (
                          <option key={g.country + '_' + p} value={p} style={bonusOptStyle}>{p}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                <button onClick={saveBonus} disabled={savingBonus} style={{
                  padding: '14px', borderRadius: '10px', border: 'none', background: '#00e87a', color: '#000',
                  fontSize: '15px', fontWeight: 700, cursor: savingBonus ? 'default' : 'pointer',
                  fontFamily: "'DM Sans', sans-serif", opacity: savingBonus ? 0.6 : 1,
                }}>
                  {savingBonus ? 'Guardando...' : 'Guardar Bonus Picks'}
                </button>

                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', textAlign: 'center', margin: 0 }}>
                  Puedes cambiar tus selecciones cuantas veces quieras hasta que arranque el torneo. Los puntos se asignan al final.
                </p>
              </div>
            )}
          </div>
        )}

        {/* STANDINGS TAB */}
        {tab === 'standings' && (
          <div>
            <div style={{ marginBottom: '24px' }}>
              <h2 className="font-display" style={{ fontSize: '36px', letterSpacing: '2px', color: '#fff', marginBottom: '6px' }}>Clasificación</h2>
              {prizePool > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: isMobile ? '10px' : '16px', marginTop: '16px' }}>
                  {[
                    { place: '1er lugar', pct: 60, color: '#ffd700' },
                    { place: '2do lugar', pct: 30, color: '#c0c0c0' },
                    { place: '3er lugar', pct: 10, color: '#cd7f32' },
                  ].map((p, i) => (
                    <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '12px 16px', textAlign: 'center' }}>
                      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginBottom: '4px' }}>{p.place}</div>
                      <div className="font-display" style={{ fontSize: '22px', color: p.color }}>${Math.round(prizePool * p.pct / 100)} USD</div>
                    </div>
                  ))}
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '12px 16px', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginBottom: '4px' }}>Participantes</div>
                    <div className="font-display" style={{ fontSize: '22px', color: '#fff' }}>{leaderboard.filter(e => e.has_paid).length}</div>
                  </div>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {leaderboard.filter(e => e.has_paid).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '64px', color: 'rgba(255,255,255,0.2)', fontSize: '14px' }}>
                  Aún no hay participantes con pago confirmado.
                </div>
              ) : leaderboard.filter(e => e.has_paid).map((entry, i) => {
                const isMe = entry.email === participant?.email
                const medals = ['🥇', '🥈', '🥉']
                const rankColors = ['#ffd700', '#c0c0c0', '#cd7f32']
                return (
                  <div key={entry.id} style={{
                    background: isMe ? 'rgba(0,232,122,0.06)' : 'rgba(255,255,255,0.02)',
                    border: isMe ? '1px solid rgba(0,232,122,0.2)' : '1px solid rgba(255,255,255,0.05)',
                    borderRadius: '12px', padding: '16px 20px',
                    display: 'flex', alignItems: 'center', gap: '16px',
                  }}>
                    <div style={{ width: '32px', textAlign: 'center', fontSize: i < 3 ? '22px' : '13px', color: i < 3 ? rankColors[i] : 'rgba(255,255,255,0.25)', fontWeight: 700 }}>
                      {i < 3 ? medals[i] : `#${i + 1}`}
                    </div>
                    {entry.avatar_url ? (
                      <img src={entry.avatar_url} alt="" style={{ width: '38px', height: '38px', borderRadius: '50%' }} />
                    ) : (
                      <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>
                        {entry.name[0]}
                      </div>
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>{entry.name}</span>
                        {isMe && <span style={{ fontSize: '10px', color: '#00e87a', background: 'rgba(0,232,122,0.1)', padding: '2px 8px', borderRadius: '100px', letterSpacing: '1px' }}>TU</span>}
                      </div>
                      <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', marginTop: '1px' }}>
                        {entry.correct_predictions} aciertos · {entry.total_predictions} predicciones
                        {entry.bonus_points > 0 && ` · +${entry.bonus_points} bonus`}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="font-display" style={{ fontSize: '28px', letterSpacing: '1px', color: i === 0 ? '#ffd700' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : '#fff' }}>
                        {entry.total_points}
                      </div>
                      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)' }}>pts</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* RESULTS TAB */}
        {tab === 'results' && (
          <div>
            <h2 className="font-display" style={{ fontSize: '36px', letterSpacing: '2px', color: '#fff', marginBottom: '24px' }}>Resultados</h2>
            {matches.filter(m => m.status === 'finished').length === 0 ? (
              <div style={{ textAlign: 'center', padding: '64px', color: 'rgba(255,255,255,0.2)', fontSize: '14px' }}>
                El torneo arranca el 11 de junio. Los resultados aparecerán aquí.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {matches.filter(m => m.status === 'finished').map(match => (
                  <div key={match.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Flag code={match.home_flag_code} size={22} />
                    <span style={{ flex: 1, textAlign: 'right', fontSize: '14px', fontWeight: 600, color: '#fff' }}>{teamName(match.home_team)}</span>
                    <span className="font-display" style={{ fontSize: '22px', color: '#00e87a', minWidth: '64px', textAlign: 'center', letterSpacing: '2px' }}>
                      {match.home_score} - {match.away_score}
                    </span>
                    <span style={{ flex: 1, fontSize: '14px', fontWeight: 600, color: '#fff' }}>{teamName(match.away_team)}</span>
                    <Flag code={match.away_flag_code} size={22} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* REGLAS TAB */}
        {tab === 'reglas' && (
          <div>
            <h2 className="font-display" style={{ fontSize: '36px', letterSpacing: '2px', color: '#fff', marginBottom: '24px' }}>Reglas</h2>

            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: isMobile ? '16px' : '20px 24px', marginBottom: '16px' }}>
              <div className="font-display" style={{ fontSize: '14px', letterSpacing: '2px', color: '#00e87a', marginBottom: '14px' }}>CÓMO FUNCIONA</div>
              <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '10px', color: 'rgba(255,255,255,0.7)', fontSize: '14px', lineHeight: 1.5 }}>
                <li>En cada partido eliges el resultado: gana el <strong style={{ color: '#fff' }}>local</strong>, <strong style={{ color: '#fff' }}>empate</strong>, o gana el <strong style={{ color: '#fff' }}>visitante</strong>. No se predice el marcador exacto.</li>
                <li>Puedes elegir, cambiar o quitar tu predicción las veces que quieras, pero solo <strong style={{ color: '#fff' }}>hasta que el partido empieza</strong>. Al arrancar queda bloqueada.</li>
                <li>Si no predices un partido antes de que comience, ese partido queda en cero para ti.</li>
                <li>Todos los horarios se muestran en <strong style={{ color: '#fff' }}>hora Colombia (COT)</strong>.</li>
              </ul>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: isMobile ? '16px' : '20px 24px', marginBottom: '16px' }}>
              <div className="font-display" style={{ fontSize: '14px', letterSpacing: '2px', color: '#00e87a', marginBottom: '6px' }}>PUNTAJE POR FASE</div>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginTop: 0, marginBottom: '16px', lineHeight: 1.5 }}>Ganas los puntos completos si aciertas el resultado. Si fallas, ese partido vale 0. Las fases finales valen mucho más, así que la quiniela se puede definir al final.</p>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '10px' }}>
                {[
                  { fase: 'Fase de grupos', pts: 3 },
                  { fase: 'Dieciseisavos', pts: 5 },
                  { fase: 'Octavos', pts: 10 },
                  { fase: 'Cuartos', pts: 20 },
                  { fase: 'Semifinales', pts: 40 },
                  { fase: 'Tercer lugar', pts: 20 },
                  { fase: 'Final', pts: 80 },
                ].map(x => (
                  <div key={x.fase} style={{ background: 'rgba(0,232,122,0.04)', border: '1px solid rgba(0,232,122,0.12)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                    <div className="font-display" style={{ fontSize: '26px', color: '#00e87a', letterSpacing: '1px' }}>{x.pts}</div>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>{x.fase}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: isMobile ? '16px' : '20px 24px', marginBottom: '16px' }}>
              <div className="font-display" style={{ fontSize: '14px', letterSpacing: '2px', color: '#00e87a', marginBottom: '6px' }}>BONUS PICKS</div>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginTop: 0, marginBottom: '16px', lineHeight: 1.5 }}>Tres predicciones especiales para todo el torneo. Cada acierto vale 100 puntos. Se eligen una sola vez y quedan bloqueadas cuando arranca el Mundial (primer partido).</p>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(3, 1fr)', gap: '10px' }}>
                {[
                  { sel: 'Campeón', pts: 100 },
                  { sel: 'MVP', pts: 100 },
                  { sel: 'Goleador', pts: 100 },
                ].map(x => (
                  <div key={x.sel} style={{ background: 'rgba(0,232,122,0.04)', border: '1px solid rgba(0,232,122,0.12)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                    <div className="font-display" style={{ fontSize: '26px', color: '#00e87a', letterSpacing: '1px' }}>{x.pts}</div>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>{x.sel}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: isMobile ? '16px' : '20px 24px' }}>
              <div className="font-display" style={{ fontSize: '14px', letterSpacing: '2px', color: '#00e87a', marginBottom: '14px' }}>CLASIFICACIÓN Y PREMIOS</div>
              <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '10px', color: 'rgba(255,255,255,0.7)', fontSize: '14px', lineHeight: 1.5 }}>
                <li>La tabla se ordena por puntos totales. En caso de empate, queda por encima quien tenga más aciertos.</li>
                <li>El 80% de lo recaudado va al pozo de premios: <strong style={{ color: '#fff' }}>60% para el 1er lugar, 30% para el 2do y 10% para el 3ro</strong>.</li>
              </ul>
            </div>
          </div>
        )}

        {/* PAYMENT TAB */}
        {tab === 'payment' && (
          <div>
            <div style={{ marginBottom: '32px' }}>
              <h2 className="font-display" style={{ fontSize: '36px', letterSpacing: '2px', color: '#fff', marginBottom: '6px' }}>Inscripción</h2>
              <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.35)' }}>
                {participant?.has_paid
                  ? 'Tu pago ha sido confirmado. Ya puedes hacer tus predicciones.'
                  : 'Realiza tu pago de 10 USD (14 CAD o 36.000 COP) por cualquiera de los siguientes métodos y tu acceso se activará en menos de 24 horas.'}
              </p>
            </div>

            {participant?.has_paid ? (
              <div style={{ background: 'rgba(0,232,122,0.08)', border: '1px solid rgba(0,232,122,0.2)', borderRadius: '14px', padding: '32px', textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
                <div className="font-display" style={{ fontSize: '28px', color: '#00e87a', letterSpacing: '2px', marginBottom: '8px' }}>PAGO CONFIRMADO</div>
                <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)' }}>Ya eres parte del Mundial Homio 2026. Buena suerte.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Monto */}
                <div style={{ background: 'rgba(0,232,122,0.06)', border: '1px solid rgba(0,232,122,0.15)', borderRadius: '14px', padding: '24px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', letterSpacing: '2px', marginBottom: '12px' }}>MONTO DE INSCRIPCIÓN</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '14px' }}>
                    {[{ a: '10', c: 'USD' }, { a: '14', c: 'CAD' }, { a: '36.000', c: 'COP' }].map((x, i) => (
                      <div key={i} style={{ minWidth: '80px' }}>
                        <div className="font-display" style={{ fontSize: isMobile ? '26px' : '34px', color: '#00e87a', letterSpacing: '1px' }}>{x.a}</div>
                        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', letterSpacing: '2px' }}>{x.c}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', marginTop: '14px' }}>
                    Paga en una sola moneda · 80% va al premio · 20% cubre gestión y hosting
                  </div>
                </div>

                {/* Metodos de pago */}
                {[
                  {
                    method: 'Interac (Canada)',
                    code: 'ca',
                    amount: '14 CAD',
                    detail: 'carlosrobayo23@gmail.com',
                    note: 'Autodeposit activado, no requiere contraseña.',
                  },
                  {
                    method: 'Zelle (USA)',
                    code: 'us',
                    amount: '10 USD',
                    detail: 'carlosrobayo23@gmail.com',
                    note: 'Envía directamente a este correo.',
                  },
                  {
                    method: 'Bancolombia (Colombia)',
                    code: 'co',
                    amount: '36.000 COP',
                    detail: 'Llave: @robayo7005',
                    note: 'Transferencia o depósito a la llave de Bancolombia.',
                  },
                ].map((m, i) => (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '20px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                      <Flag code={m.code} size={24} />
                      <span style={{ fontSize: '15px', fontWeight: 600, color: '#fff' }}>{m.method}</span>
                      <span className="font-display" style={{ marginLeft: 'auto', fontSize: '15px', color: '#00e87a', letterSpacing: '1px' }}>{m.amount}</span>
                    </div>
                    <div style={{ background: 'rgba(0,232,122,0.06)', border: '1px solid rgba(0,232,122,0.12)', borderRadius: '8px', padding: '10px 14px', marginBottom: '8px', fontFamily: 'monospace', fontSize: '15px', color: '#00e87a' }}>
                      {m.detail}
                    </div>
                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>{m.note}</div>
                  </div>
                ))}

                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '16px 20px' }}>
                  <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
                    Una vez que realices el pago, envía el comprobante por WhatsApp a Carlos Robayo. Tu acceso se activa en menos de 24 horas.
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ADMIN TAB */}
        {tab === 'admin' && participant?.is_admin && (
          <div>
            <div style={{ marginBottom: '24px' }}>
              <h2 className="font-display" style={{ fontSize: '36px', letterSpacing: '2px', color: '#fff', marginBottom: '6px' }}>Admin</h2>
              <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.35)' }}>
                Marca a cada participante como pagado cuando recibas su comprobante. Los pendientes aparecen primero.
              </p>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: isMobile ? '10px' : '16px', marginBottom: '24px' }}>
              <div style={{ background: 'rgba(0,232,122,0.06)', border: '1px solid rgba(0,232,122,0.15)', borderRadius: '10px', padding: '12px 18px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>Pagados</div>
                <div className="font-display" style={{ fontSize: '22px', color: '#00e87a' }}>{paidCount}</div>
              </div>
              <div style={{ background: 'rgba(255,107,53,0.06)', border: '1px solid rgba(255,107,53,0.15)', borderRadius: '10px', padding: '12px 18px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>Pendientes</div>
                <div className="font-display" style={{ fontSize: '22px', color: '#ff6b35' }}>{pendingCount}</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '12px 18px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>Total</div>
                <div className="font-display" style={{ fontSize: '22px', color: '#fff' }}>{participants.length}</div>
              </div>
            </div>

            {participants.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '64px', color: 'rgba(255,255,255,0.2)', fontSize: '14px' }}>
                Aún no hay participantes registrados.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {sortedParticipants.map(p => (
                  <div key={p.id} style={{
                    background: p.has_paid ? 'rgba(0,232,122,0.04)' : 'rgba(255,107,53,0.04)',
                    border: p.has_paid ? '1px solid rgba(0,232,122,0.12)' : '1px solid rgba(255,107,53,0.15)',
                    borderRadius: '12px', padding: '14px 20px',
                    display: 'flex', alignItems: 'center', gap: isMobile ? '10px' : '14px', flexWrap: isMobile ? 'wrap' : 'nowrap',
                  }}>
                    {p.avatar_url ? (
                      <img src={p.avatar_url} alt="" style={{ width: '36px', height: '36px', borderRadius: '50%' }} />
                    ) : (
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>
                        {p.name?.[0]?.toUpperCase()}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>{p.name}</span>
                        {p.is_admin && <span style={{ fontSize: '10px', color: '#00e87a', background: 'rgba(0,232,122,0.1)', padding: '2px 8px', borderRadius: '100px', letterSpacing: '1px' }}>ADMIN</span>}
                      </div>
                      <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>{p.email}</div>
                    </div>
                    <div style={{
                      fontSize: '10px', fontWeight: 700, letterSpacing: '1px', padding: '4px 10px', borderRadius: '100px',
                      color: p.has_paid ? '#00e87a' : '#ff6b35',
                      background: p.has_paid ? 'rgba(0,232,122,0.1)' : 'rgba(255,107,53,0.1)',
                    }}>
                      {p.has_paid ? 'PAGADO' : 'PENDIENTE'}
                    </div>
                    <button
                      onClick={() => togglePaid(p)}
                      disabled={savingPaid === p.id}
                      style={{
                        padding: '8px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                        cursor: savingPaid === p.id ? 'default' : 'pointer', fontFamily: "'DM Sans', sans-serif",
                        border: 'none', whiteSpace: 'nowrap',
                        ...(isMobile ? { width: '100%', marginTop: '6px' } : { minWidth: '130px' }),
                        background: p.has_paid ? 'rgba(255,255,255,0.06)' : '#00e87a',
                        color: p.has_paid ? 'rgba(255,255,255,0.5)' : '#000',
                        opacity: savingPaid === p.id ? 0.5 : 1,
                      }}>
                      {savingPaid === p.id ? '...' : p.has_paid ? 'Revertir' : 'Marcar pagado'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Bonus Picks: asignar puntos */}
            <div style={{ marginTop: '40px', marginBottom: '16px' }}>
              <h3 className="font-display" style={{ fontSize: '24px', letterSpacing: '1px', color: '#fff', marginBottom: '6px' }}>Bonus Picks: asignar puntos</h3>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)' }}>
                Al terminar el torneo, marca cada acierto. Cada selección correcta vale 100 puntos. Recuerda guardar cada fila.
              </p>
            </div>

            {allBonus.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.2)', fontSize: '14px' }}>
                Nadie ha guardado sus Bonus Picks todavía.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {allBonus.map(row => {
                  const p = participants.find(x => x.id === row.participant_id)
                  const edit = bonusEditFor(row)
                  const total = edit.champion_points + edit.mvp_points + edit.top_scorer_points
                  const picks: { key: PointKey; label: string; pick: string; pts: number }[] = [
                    { key: 'champion_points', label: 'Campeón', pick: row.champion ? teamName(row.champion) : 'Sin elegir', pts: edit.champion_points },
                    { key: 'mvp_points', label: 'MVP', pick: row.mvp || 'Sin elegir', pts: edit.mvp_points },
                    { key: 'top_scorer_points', label: 'Goleador', pick: row.top_scorer || 'Sin elegir', pts: edit.top_scorer_points },
                  ]
                  return (
                    <div key={row.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: isMobile ? '14px' : '16px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>{p?.name || 'Participante'}</span>
                        <span className="font-display" style={{ marginLeft: 'auto', fontSize: '16px', color: '#00e87a' }}>{total} pts</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '10px', marginBottom: '12px' }}>
                        {picks.map(pk => (
                          <div key={pk.key} style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '10px 12px' }}>
                            <div style={{ fontSize: '10px', letterSpacing: '1px', color: 'rgba(255,255,255,0.35)', marginBottom: '3px' }}>{pk.label.toUpperCase()}</div>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff', marginBottom: '8px' }}>{pk.pick}</div>
                            <button onClick={() => setBonusEdit(row.id, pk.key, pk.pts === BONUS_POINTS ? 0 : BONUS_POINTS)} style={{
                              width: '100%', padding: '8px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                              fontFamily: "'DM Sans', sans-serif",
                              background: pk.pts === BONUS_POINTS ? '#00e87a' : 'rgba(255,255,255,0.05)',
                              border: pk.pts === BONUS_POINTS ? '1px solid #00e87a' : '1px solid rgba(255,255,255,0.1)',
                              color: pk.pts === BONUS_POINTS ? '#000' : 'rgba(255,255,255,0.5)',
                            }}>{pk.pts === BONUS_POINTS ? 'Acertó (100)' : 'Marcar acierto'}</button>
                          </div>
                        ))}
                      </div>
                      <button onClick={() => saveBonusPoints(row)} disabled={savingBonusAdmin === row.id} style={{
                        padding: '10px 16px', borderRadius: '8px', border: 'none', background: 'rgba(0,232,122,0.15)', color: '#00e87a',
                        fontSize: '13px', fontWeight: 700, cursor: savingBonusAdmin === row.id ? 'default' : 'pointer',
                        fontFamily: "'DM Sans', sans-serif", opacity: savingBonusAdmin === row.id ? 0.6 : 1,
                      }}>{savingBonusAdmin === row.id ? 'Guardando...' : 'Guardar puntos'}</button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Enviar anuncio por correo */}
            <div style={{ marginTop: '40px', marginBottom: '16px' }}>
              <h3 className="font-display" style={{ fontSize: '24px', letterSpacing: '1px', color: '#fff', marginBottom: '6px' }}>Enviar anuncio por correo</h3>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)' }}>
                Escribe un mensaje y envíalo a los participantes. Sale desde notifications@homio.ca. Prueba primero contigo mismo antes del envío masivo.
              </p>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', padding: isMobile ? '16px' : '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', letterSpacing: '1px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px' }}>ASUNTO</label>
                <input value={annSubject} onChange={e => setAnnSubject(e.target.value)} placeholder="Asunto del anuncio" style={{ width: '100%', padding: '12px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', color: '#fff', fontSize: '15px', fontFamily: "'DM Sans', sans-serif", boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', letterSpacing: '1px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px' }}>MENSAJE</label>
                <textarea value={annBody} onChange={e => setAnnBody(e.target.value)} rows={6} placeholder="Escribe tu mensaje. Cada salto de linea se respeta." style={{ width: '100%', padding: '12px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', color: '#fff', fontSize: '15px', fontFamily: "'DM Sans', sans-serif", resize: 'vertical', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', letterSpacing: '1px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px' }}>DESTINATARIOS</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {([
                    { key: 'all' as const, label: `Todos (${participants.length})` },
                    { key: 'paid' as const, label: `Pagados (${paidCount})` },
                    { key: 'pending' as const, label: `Pendientes (${pendingCount})` },
                  ]).map(opt => (
                    <button key={opt.key} onClick={() => setAnnScope(opt.key)} style={{
                      padding: '9px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                      fontFamily: "'DM Sans', sans-serif",
                      background: annScope === opt.key ? '#00e87a' : 'rgba(255,255,255,0.05)',
                      border: annScope === opt.key ? '1px solid #00e87a' : '1px solid rgba(255,255,255,0.1)',
                      color: annScope === opt.key ? '#000' : 'rgba(255,255,255,0.5)',
                    }}>{opt.label}</button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button onClick={() => handleSendAnnouncement(true)} disabled={annSending !== null} style={{
                  padding: '12px 18px', borderRadius: '10px', border: '1px solid rgba(0,232,122,0.3)', background: 'rgba(0,232,122,0.1)', color: '#00e87a',
                  fontSize: '14px', fontWeight: 700, cursor: annSending !== null ? 'default' : 'pointer', fontFamily: "'DM Sans', sans-serif", opacity: annSending !== null ? 0.6 : 1,
                }}>{annSending === 'test' ? 'Enviando...' : 'Enviar prueba a mí'}</button>
                <button onClick={() => handleSendAnnouncement(false)} disabled={annSending !== null} style={{
                  padding: '12px 18px', borderRadius: '10px', border: 'none', background: '#00e87a', color: '#000',
                  fontSize: '14px', fontWeight: 700, cursor: annSending !== null ? 'default' : 'pointer', fontFamily: "'DM Sans', sans-serif", opacity: annSending !== null ? 0.6 : 1,
                }}>{annSending === 'send' ? 'Enviando...' : 'Enviar a todos'}</button>
              </div>
              {annResult && (
                <div style={{ fontSize: '13px', fontWeight: 600, color: annResult.startsWith('Error') ? '#ff6b35' : '#00e87a' }}>{annResult}</div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
