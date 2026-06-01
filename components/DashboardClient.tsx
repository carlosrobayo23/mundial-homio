'use client'
import { useState } from 'react'
import { Participant, LeaderboardEntry, Match, PredictionRow, Prediction } from '@/lib/types'
import { createClient } from '@/lib/supabase'
import { setParticipantPaid } from '@/app/actions'
import Flag from '@/components/Flag'

interface Props {
  participant: Participant | null
  leaderboard: LeaderboardEntry[]
  matches: Match[]
  myPredictions: PredictionRow[]
  allParticipants: Participant[]
}

type Tab = 'picks' | 'standings' | 'results' | 'payment' | 'admin'

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

export default function DashboardClient({ participant, leaderboard, matches, myPredictions, allParticipants = [] }: Props) {
  const [tab, setTab] = useState<Tab>(participant?.has_paid ? 'picks' : 'payment')
  const [predictions, setPredictions] = useState<Record<string, Prediction | null>>(
    Object.fromEntries(myPredictions.map(p => [p.match_id, p.prediction]))
  )
  const [saving, setSaving] = useState<string | null>(null)
  const [participants, setParticipants] = useState<Participant[]>(allParticipants)
  const [savingPaid, setSavingPaid] = useState<string | null>(null)
  const supabase = createClient()

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

  return (
    <div style={{ minHeight: '100vh', background: '#080810', fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <header style={{ background: 'rgba(13,13,20,0.97)', borderBottom: '1px solid rgba(255,255,255,0.06)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '64px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '24px' }}>⚽</span>
            <div>
              <div className="font-display" style={{ fontSize: '18px', letterSpacing: '2px', color: '#fff', lineHeight: 1 }}>MUNDIAL HOMIO</div>
              <div style={{ fontSize: '10px', color: '#00e87a', letterSpacing: '3px' }}>2026</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
            <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>{participant?.name}</span>
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
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 24px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex' }}>
          {([
            { key: 'picks', label: 'Mis Predicciones', icon: '✏️' },
            { key: 'standings', label: 'Clasificación', icon: '🏆' },
            { key: 'results', label: 'Resultados', icon: '📊' },
            { key: 'payment', label: 'Pagar', icon: '💳' },
            ...(participant?.is_admin ? [{ key: 'admin', label: 'Admin', icon: '🛠️' }] : []),
          ] as { key: Tab; label: string; icon: string }[]).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: '14px 18px', background: 'transparent', border: 'none',
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

      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 24px' }}>

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
                <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', marginBottom: '16px' }}>Completa tu inscripción de $10 USD para desbloquear las predicciones.</div>
                <button onClick={() => setTab('payment')} style={{
                  background: '#ff6b35', border: 'none', borderRadius: '10px', padding: '12px 24px',
                  color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                }}>Ver instrucciones de pago</button>
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

        {/* STANDINGS TAB */}
        {tab === 'standings' && (
          <div>
            <div style={{ marginBottom: '24px' }}>
              <h2 className="font-display" style={{ fontSize: '36px', letterSpacing: '2px', color: '#fff', marginBottom: '6px' }}>Clasificación</h2>
              {prizePool > 0 && (
                <div style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
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

        {/* PAYMENT TAB */}
        {tab === 'payment' && (
          <div>
            <div style={{ marginBottom: '32px' }}>
              <h2 className="font-display" style={{ fontSize: '36px', letterSpacing: '2px', color: '#fff', marginBottom: '6px' }}>Inscripción</h2>
              <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.35)' }}>
                {participant?.has_paid
                  ? 'Tu pago ha sido confirmado. Ya puedes hacer tus predicciones.'
                  : 'Realiza tu pago de $10 USD por cualquiera de los siguientes métodos y tu acceso se activará en menos de 24 horas.'}
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
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', letterSpacing: '2px', marginBottom: '8px' }}>MONTO DE INSCRIPCIÓN</div>
                  <div className="font-display" style={{ fontSize: '48px', color: '#00e87a', letterSpacing: '2px' }}>$10 USD</div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', marginTop: '8px' }}>
                    80% va al premio · 20% cubre gestión y hosting
                  </div>
                </div>

                {/* Metodos de pago */}
                {[
                  {
                    method: 'Interac (Canada)',
                    flag: '🇨🇦',
                    detail: 'carlosrobayo23@gmail.com',
                    note: 'Autodeposit activado, no requiere contraseña.',
                  },
                  {
                    method: 'Zelle (USA)',
                    flag: '🇺🇸',
                    detail: 'carlosrobayo23@gmail.com',
                    note: 'Envía directamente a este correo.',
                  },
                  {
                    method: 'Bancolombia (Colombia)',
                    flag: '🇨🇴',
                    detail: 'Llave: @robayo7005',
                    note: 'Transferencia o depósito a la llave de Bancolombia.',
                  },
                ].map((m, i) => (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '20px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                      <span style={{ fontSize: '24px' }}>{m.flag}</span>
                      <span style={{ fontSize: '15px', fontWeight: 600, color: '#fff' }}>{m.method}</span>
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

            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
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
                    display: 'flex', alignItems: 'center', gap: '14px',
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
                        border: 'none', whiteSpace: 'nowrap', minWidth: '130px',
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
          </div>
        )}
      </main>
    </div>
  )
}
