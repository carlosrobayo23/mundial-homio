import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Esquema por app: 'homio' en Mundial Homio, 'public' en Loyalty (default).
const SCHEMA = process.env.DB_SCHEMA || 'public'

const API_BASE = 'https://api.football-data.org/v4'
const COMPETITION = 'WC'

// Nuestros 48 equipos (nombres tal como estan en la DB).
const OUR_TEAMS = [
  'Algeria', 'Argentina', 'Australia', 'Austria', 'Belgium', 'Bosnia and Herzegovina',
  'Brazil', 'Canada', 'Cape Verde', 'Colombia', 'Croatia', 'Curacao', 'Czechia',
  'DR Congo', 'Ecuador', 'Egypt', 'England', 'France', 'Germany', 'Ghana', 'Haiti',
  'Iran', 'Iraq', 'Ivory Coast', 'Japan', 'Jordan', 'Mexico', 'Morocco', 'Netherlands',
  'New Zealand', 'Norway', 'Panama', 'Paraguay', 'Portugal', 'Qatar', 'Saudi Arabia',
  'Scotland', 'Senegal', 'South Africa', 'South Korea', 'Spain', 'Sweden', 'Switzerland',
  'Tunisia', 'Turkiye', 'United States', 'Uruguay', 'Uzbekistan',
]

const FLAG_CODES: Record<string, string> = {
  'Mexico': 'mx', 'South Africa': 'za', 'South Korea': 'kr', 'Czechia': 'cz',
  'Canada': 'ca', 'Bosnia and Herzegovina': 'ba', 'Qatar': 'qa', 'Switzerland': 'ch',
  'Brazil': 'br', 'Morocco': 'ma', 'Haiti': 'ht', 'Scotland': 'gb-sct',
  'United States': 'us', 'Paraguay': 'py', 'Australia': 'au', 'Turkiye': 'tr',
  'Germany': 'de', 'Curacao': 'cw', 'Ivory Coast': 'ci', 'Ecuador': 'ec',
  'Netherlands': 'nl', 'Japan': 'jp', 'Sweden': 'se', 'Tunisia': 'tn',
  'Belgium': 'be', 'Egypt': 'eg', 'Saudi Arabia': 'sa', 'Uruguay': 'uy',
  'Iran': 'ir', 'New Zealand': 'nz', 'Spain': 'es', 'Cape Verde': 'cv',
  'France': 'fr', 'Senegal': 'sn', 'Iraq': 'iq', 'Norway': 'no',
  'Argentina': 'ar', 'Algeria': 'dz', 'Austria': 'at', 'Jordan': 'jo',
  'Portugal': 'pt', 'DR Congo': 'cd', 'Uzbekistan': 'uz', 'Colombia': 'co',
  'England': 'gb-eng', 'Croatia': 'hr', 'Ghana': 'gh', 'Panama': 'pa',
}

// Variantes de spelling (nuestras y de football-data.org) llevadas a un token comun.
const ALIASES: Record<string, string> = {
  'czechrepublic': 'czechia',
  'korearepublic': 'southkorea',
  'koreasouth': 'southkorea',
  'usa': 'unitedstates',
  'unitedstatesofamerica': 'unitedstates',
  'turkey': 'turkiye',
  'cotedivoire': 'ivorycoast',
  'congodr': 'drcongo',
  'democraticrepublicofcongo': 'drcongo',
  'drc': 'drcongo',
  'bosnia': 'bosniaandherzegovina',
  'bosniaherzegovina': 'bosniaandherzegovina',
  'caboverde': 'capeverde',
  'capeverdeislands': 'capeverde',
}

const STAGE_MAP: Record<string, string> = {
  'GROUP_STAGE': 'groups',
  'LAST_32': 'round_of_32',
  'ROUND_OF_32': 'round_of_32',
  'LAST_16': 'round_of_16',
  'ROUND_OF_16': 'round_of_16',
  'QUARTER_FINALS': 'quarterfinals',
  'QUARTER_FINAL': 'quarterfinals',
  'SEMI_FINALS': 'semifinals',
  'SEMI_FINAL': 'semifinals',
  'THIRD_PLACE': 'third_place',
  'FINAL': 'final',
}

const KO_PHASES = ['round_of_32', 'round_of_16', 'quarterfinals', 'semifinals', 'third_place', 'final']

function norm(s: string) {
  const base = (s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]/g, '')
  return ALIASES[base] || base
}

const OUR_BY_NORM: Record<string, string> = {}
for (const t of OUR_TEAMS) OUR_BY_NORM[norm(t)] = t

function apiToOur(name: string): string {
  return OUR_BY_NORM[norm(name)] || name
}

function mapStage(stage: string): string {
  return STAGE_MAP[stage] || 'groups'
}

// En knockout el acierto es quien avanza. football-data.org da score.winner
// (HOME_TEAM / AWAY_TEAM) incluso si se definio por penales. Si nuestro registro
// tiene los equipos invertidos, el ganador tambien se invierte.
function koWinnerFrom(am: any, swapped: boolean): string | null {
  const w = am.score?.winner
  let r: string | null = w === 'HOME_TEAM' ? 'home' : w === 'AWAY_TEAM' ? 'away' : null
  if (swapped && r) r = r === 'home' ? 'away' : 'home'
  return r
}

async function fetchMatches(onlyFinished: boolean) {
  const url = `${API_BASE}/competitions/${COMPETITION}/matches${onlyFinished ? '?status=FINISHED' : ''}`
  const res = await fetch(url, {
    headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY! },
    cache: 'no-store',
  })
  return res.json()
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const secret = req.nextUrl.searchParams.get('secret')
  const validCron = authHeader === `Bearer ${process.env.CRON_SECRET}`
  const validManual = secret === process.env.CRON_SECRET
  if (!validCron && !validManual) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const peek = req.nextUrl.searchParams.get('peek') === '1'

  // PEEK: solo mira lo que devuelve la API, sin tocar la DB.
  if (peek) {
    const data = await fetchMatches(false)
    const matches = data?.matches || []
    const finished = matches.filter((m: any) => m.status === 'FINISHED')
    return NextResponse.json({
      api_error: data?.message || data?.errorCode || null,
      total: matches.length,
      finished: finished.length,
      sample: matches.slice(0, 40).map((m: any) => ({
        utcDate: m.utcDate,
        status: m.status,
        stage: m.stage,
        group: m.group,
        home: m.homeTeam?.name,
        away: m.awayTeam?.name,
        score: `${m.score?.fullTime?.home}-${m.score?.fullTime?.away}`,
        winner: m.score?.winner,
      })),
    })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: SCHEMA }, auth: { persistSession: false } },
  )

  const results = {
    schema: SCHEMA,
    api_error: null as any,
    finished_in_api: 0,
    updated: 0,
    knockout_filled: 0,
    unmatched: [] as string[],
    errors: [] as string[],
  }

  try {
    const data = await fetchMatches(false)
    if (data?.message || data?.errorCode) results.api_error = data.message || data.errorCode
    const apiAll = data?.matches || []
    const apiMatches = apiAll.filter((m: any) => m.status === 'FINISHED')
    results.finished_in_api = apiMatches.length

    // Traer nuestros partidos una sola vez e indexar por fase + equipos normalizados.
    const { data: ours, error } = await supabase
      .from('matches')
      .select('id, phase, home_team, away_team, status, home_score, away_score, match_date, api_match_id')
    if (error) {
      results.errors.push(error.message)
      return NextResponse.json({ ok: true, timestamp: new Date().toISOString(), ...results })
    }

    const idx: Record<string, any> = {}
    for (const m of ours || []) {
      idx[`${m.phase}|${norm(m.home_team)}|${norm(m.away_team)}`] = m
    }

    // ---- Pase 1: marcar resultados de partidos finalizados ----
    for (const am of apiMatches) {
      const apiHome = am.homeTeam?.name
      const apiAway = am.awayTeam?.name
      const gh = am.score?.fullTime?.home
      const ga = am.score?.fullTime?.away
      if (!apiHome || !apiAway || gh == null || ga == null) continue

      const phase = mapStage(am.stage)
      const keyDirect = `${phase}|${norm(apiHome)}|${norm(apiAway)}`
      const keySwapped = `${phase}|${norm(apiAway)}|${norm(apiHome)}`

      let m = idx[keyDirect]
      let swapped = false
      let homeScore = gh
      let awayScore = ga
      if (!m && idx[keySwapped]) {
        // Nuestro registro tiene los equipos al reves: invertimos el marcador para que calce.
        m = idx[keySwapped]
        swapped = true
        homeScore = ga
        awayScore = gh
      }

      if (m) {
        const changed = m.home_score !== homeScore || m.away_score !== awayScore
        if (m.status !== 'finished' || changed) {
          const upd: any = { home_score: homeScore, away_score: awayScore, status: 'finished' }
          if (phase !== 'groups') upd.winner = koWinnerFrom(am, swapped)
          await supabase.from('matches').update(upd).eq('id', m.id)
          results.updated++
        }
        continue
      }

      // No emparejo por equipos. Si es eliminatoria, intento rellenar placeholder por fecha.
      if (phase !== 'groups') {
        const d = new Date(am.utcDate)
        const start = new Date(d.getTime() - 30 * 60 * 1000).toISOString()
        const end = new Date(d.getTime() + 30 * 60 * 1000).toISOString()

        const { data: ko } = await supabase
          .from('matches')
          .select('id, home_team, away_team')
          .eq('phase', phase)
          .gte('match_date', start)
          .lte('match_date', end)
          .maybeSingle()

        if (ko) {
          const isPlaceholder =
            ko.home_team.startsWith('W Group') ||
            ko.home_team.startsWith('RU Group') ||
            ko.home_team.startsWith('3rd') ||
            ko.home_team.startsWith('TBD') ||
            ko.away_team.startsWith('3rd') ||
            ko.away_team.startsWith('TBD')

          const ourHome = apiToOur(apiHome)
          const ourAway = apiToOur(apiAway)

          if (isPlaceholder) {
            await supabase.from('matches').update({
              home_team: ourHome,
              away_team: ourAway,
              home_flag_code: FLAG_CODES[ourHome] || null,
              away_flag_code: FLAG_CODES[ourAway] || null,
              home_score: gh,
              away_score: ga,
              status: 'finished',
              winner: koWinnerFrom(am, false),
            }).eq('id', ko.id)
            results.knockout_filled++
          } else {
            const swapped2 = norm(ko.home_team) === norm(apiAway)
            await supabase.from('matches').update({
              home_score: swapped2 ? ga : gh,
              away_score: swapped2 ? gh : ga,
              status: 'finished',
              winner: koWinnerFrom(am, swapped2),
            }).eq('id', ko.id)
            results.updated++
          }
        } else {
          results.unmatched.push(`${apiHome} vs ${apiAway} (${am.stage})`)
        }
      } else {
        results.unmatched.push(`${apiHome} vs ${apiAway} (${am.stage})`)
      }
    }

    // ---- Pase 2: anclar y rellenar cruces de knockout desde el bracket de football-data.org ----
    // Ancla cada partido nuestro a uno de la API por api_match_id (estable) y llena equipos
    // en cuanto la API los define (parcial, sin esperar a que la ronda este completa). Toma
    // fecha y banderas reales. No cambia el resultado de partidos ya jugados.
    const apiByPhase: Record<string, any[]> = {}
    for (const am of apiAll) {
      const phase = mapStage(am.stage)
      if (!KO_PHASES.includes(phase)) continue
      const oh = am.homeTeam?.name ? (OUR_BY_NORM[norm(am.homeTeam.name)] || null) : null
      const oa = am.awayTeam?.name ? (OUR_BY_NORM[norm(am.awayTeam.name)] || null) : null
      ;(apiByPhase[phase] ||= []).push({ apiId: am.id, date: am.utcDate, oh, oa })
    }

    const ourKO: Record<string, any[]> = {}
    for (const m of ours || []) {
      if (!KO_PHASES.includes(m.phase)) continue
      ;(ourKO[m.phase] ||= []).push(m)
    }

    for (const phase of KO_PHASES) {
      const apiList = (apiByPhase[phase] || []).slice()
        .sort((x, y) => new Date(x.date).getTime() - new Date(y.date).getTime())
      const ourList = (ourKO[phase] || []).slice()
      // Necesitamos el set completo de la fase en la API para emparejar 1 a 1.
      if (apiList.length === 0 || apiList.length !== ourList.length) continue

      // Primero respetar anclajes existentes (api_match_id); el resto se empareja por fecha.
      const usedApi = new Set<number>()
      const pairs: Array<{ o: any; a: any }> = []
      const ourUnanchored: any[] = []
      for (const o of ourList) {
        const aid = o.api_match_id != null ? Number(o.api_match_id) : null
        const a = aid != null ? apiList.find(x => x.apiId === aid) : null
        if (a) { pairs.push({ o, a }); usedApi.add(a.apiId) }
        else ourUnanchored.push(o)
      }
      const freeApi = apiList.filter(a => !usedApi.has(a.apiId))
      ourUnanchored.sort((x, y) => new Date(x.match_date).getTime() - new Date(y.match_date).getTime())
      for (let i = 0; i < ourUnanchored.length && i < freeApi.length; i++) {
        pairs.push({ o: ourUnanchored[i], a: freeApi[i] })
      }

      for (const { o, a } of pairs) {
        const upd: any = {}
        if (o.api_match_id == null) upd.api_match_id = a.apiId
        if (o.status !== 'finished') {
          const newDate = new Date(a.date).toISOString()
          if (!o.match_date || new Date(o.match_date).toISOString() !== newDate) upd.match_date = newDate
          if (a.oh && a.oa && (norm(o.home_team) !== norm(a.oh) || norm(o.away_team) !== norm(a.oa))) {
            upd.home_team = a.oh
            upd.away_team = a.oa
            upd.home_flag_code = FLAG_CODES[a.oh] || null
            upd.away_flag_code = FLAG_CODES[a.oa] || null
          }
        }
        if (Object.keys(upd).length > 0) {
          await supabase.from('matches').update(upd).eq('id', o.id)
          results.knockout_filled++
        }
      }
    }
  } catch (err: any) {
    results.errors.push(err.message)
  }

  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    ...results,
  })
}
