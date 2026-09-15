/**
 * The Odds API (the-odds-api.com) client: pulls FanDuel's actual prices when the user supplies a key.
 * Credits: /events is free; /odds costs markets×regions; /events/{id}/odds costs unique markets returned × regions.
 * Everything is cached aggressively in localStorage so a free 500-credit month covers normal daily use.
 */
import type { LeagueDef } from '@/data/sports'
import { useSettings } from '@/store/settings'
import type { AthleteInfo, GameEvent, GameLines } from './types'

const BASE = 'https://api.the-odds-api.com/v4'
const REGION = 'us'
const BOOK = 'fanduel'

export const ODDS_API_SPORT: Record<string, string> = {
  nfl: 'americanfootball_nfl',
  ncaaf: 'americanfootball_ncaaf',
  cfl: 'americanfootball_cfl',
  nba: 'basketball_nba',
  wnba: 'basketball_wnba',
  ncaab: 'basketball_ncaab',
  mlb: 'baseball_mlb',
  nhl: 'icehockey_nhl',
  epl: 'soccer_epl',
  laliga: 'soccer_spain_la_liga',
  seriea: 'soccer_italy_serie_a',
  bundesliga: 'soccer_germany_bundesliga',
  ligue1: 'soccer_france_ligue_one',
  mls: 'soccer_usa_mls',
  ucl: 'soccer_uefa_champs_league',
  uel: 'soccer_uefa_europa_league',
  ligamx: 'soccer_mexico_ligamx',
  eredivisie: 'soccer_netherlands_eredivisie',
  primeira: 'soccer_portugal_primeira_liga',
  championship: 'soccer_efl_champ',
  facup: 'soccer_fa_cup',
  ufc: 'mma_mixed_martial_arts',
}

/** Prop market keys FanDuel supports on the API, grouped so tabs fetch only what they show. */
export const PROP_MARKET_GROUPS: Record<string, Record<string, string[]>> = {
  football: {
    'Passing Props': ['player_pass_yds', 'player_pass_tds', 'player_pass_completions', 'player_pass_attempts', 'player_pass_interceptions', 'player_pass_longest_completion'],
    'Rushing Props': ['player_rush_yds', 'player_rush_attempts', 'player_rush_longest', 'player_rush_reception_yds'],
    'Receiving Props': ['player_receptions', 'player_reception_yds', 'player_reception_longest'],
    'TD Scorer Props': ['player_anytime_td', 'player_1st_td', 'player_last_td'],
    'D/ST': ['player_tackles_assists', 'player_sacks', 'player_defensive_interceptions'],
    Scoring: ['player_kicking_points', 'player_field_goals', 'player_pats', 'team_totals'],
    Alternates: ['alternate_spreads', 'alternate_totals'],
    '1st Half': ['h2h_3_way_h1', 'spreads_h1', 'totals_h1'],
    '1st Quarter': ['h2h_3_way_q1', 'spreads_q1', 'totals_q1'],
  },
  basketball: {
    'Player Points': ['player_points'],
    'Player Rebounds': ['player_rebounds'],
    'Player Assists': ['player_assists'],
    'Player Threes': ['player_threes'],
    'Player Combos': ['player_points_rebounds_assists', 'player_points_rebounds', 'player_points_assists', 'player_rebounds_assists'],
    'Player Defense': ['player_blocks', 'player_steals', 'player_blocks_steals', 'player_turnovers'],
    'Player Specials': ['player_double_double', 'player_triple_double'],
    Scoring: ['team_totals'],
    Alternates: ['alternate_spreads', 'alternate_totals'],
    '1st Half': ['h2h_3_way_h1', 'spreads_h1', 'totals_h1'],
    '1st Quarter': ['h2h_3_way_q1', 'spreads_q1', 'totals_q1'],
  },
  hockey: {
    'Goal Scorer': ['player_goal_scorer_anytime', 'player_goal_scorer_first', 'player_goal_scorer_last'],
    'Player Points': ['player_points', 'player_assists', 'player_goals', 'player_power_play_points'],
    'Player Shots': ['player_shots_on_goal', 'player_blocked_shots'],
    'Goalie Saves': ['player_total_saves'],
    Scoring: ['team_totals'],
    Alternates: ['alternate_spreads', 'alternate_totals'],
    '1st Period': ['h2h_3_way_p1', 'spreads_p1', 'totals_p1'],
  },
  baseball: {
    'Batter Props': ['batter_hits', 'batter_rbis', 'batter_runs_scored', 'batter_hits_runs_rbis', 'batter_walks', 'batter_strikeouts'],
    'Home Run Props': ['batter_home_runs'],
    'Pitcher Props': ['pitcher_strikeouts', 'pitcher_outs', 'pitcher_earned_runs', 'pitcher_hits_allowed', 'pitcher_walks'],
    Scoring: ['team_totals'],
    Alternates: ['alternate_spreads', 'alternate_totals'],
    '1st Inning': ['h2h_3_way_1st_1_innings', 'totals_1st_1_innings'],
    '1st 5 Innings': ['h2h_1st_5_innings', 'spreads_1st_5_innings', 'totals_1st_5_innings'],
  },
  soccer: {
    'Goal Scorer': ['player_goal_scorer_anytime', 'player_first_goal_scorer', 'player_last_goal_scorer'],
    'Player Shots': ['player_shots_on_target', 'player_shots'],
    'Player Points': ['player_assists'],
    Cards: ['player_to_receive_card', 'player_to_receive_red_card'],
    'Game Specials': ['btts', 'double_chance', 'draw_no_bet', 'correct_score'],
    Scoring: ['team_totals', 'alternate_totals'],
    '1st Half': ['h2h_3_way_h1', 'totals_h1'],
  },
}

export interface OaOutcome {
  name: string
  price: number
  point?: number
  description?: string
}
export interface OaMarket {
  key: string
  last_update?: string
  outcomes: OaOutcome[]
}
export interface OaEvent {
  id: string
  sport_key: string
  commence_time: string
  home_team: string
  away_team: string
  bookmakers?: { key: string; title: string; markets: OaMarket[] }[]
}

export interface OaStatus {
  remaining: number | null
  used: number | null
  lastError: string | null
  lastFetchAt: number | null
}

const LS = 'fd.oa.'
const FEATURED_TTL = 20 * 60_000
const EVENT_TTL = 3 * 60 * 60_000
const EVENTS_LIST_TTL = 30 * 60_000

function lsGet<T>(key: string): { at: number; value: T } | null {
  try {
    const raw = localStorage.getItem(LS + key)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}
function lsSet(key: string, value: unknown) {
  try {
    localStorage.setItem(LS + key, JSON.stringify({ at: Date.now(), value }))
  } catch {
    /* ignore */
  }
}

export function oddsApiKey(): string {
  return useSettings.getState().oddsApiKey.trim()
}
export function oddsApiEnabled(): boolean {
  return oddsApiKey().length > 10 && useSettings.getState().useFanDuelPrices
}

const inflight = new Map<string, Promise<unknown>>()

async function call<T>(path: string, params: Record<string, string>): Promise<T> {
  const key = oddsApiKey()
  const qs = new URLSearchParams({ apiKey: key, ...params })
  const url = `${BASE}${path}?${qs.toString()}`
  const dedupeKey = url
  const existing = inflight.get(dedupeKey)
  if (existing) return existing as Promise<T>
  const p = (async () => {
    const res = await fetch(url)
    const remaining = res.headers.get('x-requests-remaining')
    const used = res.headers.get('x-requests-used')
    const set = useSettings.getState().setOddsApiStatus
    if (remaining !== null || used !== null) set({ remaining: remaining !== null ? parseInt(remaining, 10) : null, used: used !== null ? parseInt(used, 10) : null, lastError: null, lastFetchAt: Date.now() })
    if (!res.ok) {
      const msg = res.status === 401 ? 'Invalid API key' : res.status === 429 ? 'Out of credits for this month' : `HTTP ${res.status}`
      set({ lastError: msg })
      throw new Error(msg)
    }
    return (await res.json()) as T
  })()
  inflight.set(dedupeKey, p)
  try {
    return await p
  } finally {
    inflight.delete(dedupeKey)
  }
}

/** Free: list of upcoming events for a sport (used to map ESPN events → Odds API ids). */
export async function fetchEventsList(league: LeagueDef): Promise<OaEvent[]> {
  const sport = ODDS_API_SPORT[league.id]
  if (!sport || !oddsApiEnabled()) return []
  const c = lsGet<OaEvent[]>(`events:${sport}`)
  if (c && Date.now() - c.at < EVENTS_LIST_TTL) return c.value
  try {
    const list = await call<OaEvent[]>(`/sports/${sport}/events`, {})
    lsSet(`events:${sport}`, list)
    return list
  } catch {
    return c?.value ?? []
  }
}

/** Featured FanDuel lines (h2h/spreads/totals) for a whole league. Costs 3 credits per fresh fetch. */
export async function fetchFeatured(league: LeagueDef, force = false): Promise<OaEvent[]> {
  const sport = ODDS_API_SPORT[league.id]
  if (!sport || !oddsApiEnabled()) return []
  const c = lsGet<OaEvent[]>(`feat:${sport}`)
  if (c && !force && Date.now() - c.at < FEATURED_TTL) return c.value
  try {
    const list = await call<OaEvent[]>(`/sports/${sport}/odds`, { regions: REGION, markets: 'h2h,spreads,totals', bookmakers: BOOK, oddsFormat: 'american' })
    lsSet(`feat:${sport}`, list)
    lsSet(`events:${sport}`, list.map(({ id, sport_key, commence_time, home_team, away_team }) => ({ id, sport_key, commence_time, home_team, away_team })))
    return list
  } catch {
    return c?.value ?? []
  }
}

/** Per-event markets; fetches only the keys not already cached. Costs 1 credit per unique market returned. */
export async function fetchEventMarkets(league: LeagueDef, oaEventId: string, keys: string[]): Promise<Record<string, OaMarket>> {
  const sport = ODDS_API_SPORT[league.id]
  const out: Record<string, OaMarket> = {}
  if (!sport || !oaEventId || !oddsApiEnabled()) return out
  const missing: string[] = []
  for (const k of keys) {
    const c = lsGet<OaMarket | null>(`ev:${oaEventId}:${k}`)
    if (c && Date.now() - c.at < EVENT_TTL) {
      if (c.value) out[k] = c.value
    } else missing.push(k)
  }
  if (!missing.length) return out
  try {
    const ev = await call<OaEvent>(`/sports/${sport}/events/${oaEventId}/odds`, { regions: REGION, markets: missing.join(','), bookmakers: BOOK, oddsFormat: 'american' })
    const markets = ev.bookmakers?.find((b) => b.key === BOOK)?.markets ?? []
    const got = new Set<string>()
    for (const m of markets) {
      out[m.key] = m
      got.add(m.key)
      lsSet(`ev:${oaEventId}:${m.key}`, m)
    }
    for (const k of missing) if (!got.has(k)) lsSet(`ev:${oaEventId}:${k}`, null) // remember FanDuel doesn't offer it
  } catch {
    /* fall back to models */
  }
  return out
}

/* ----------------------------- matching ----------------------------- */

export function normName(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv)\b\.?/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function teamMatches(a: string, b: string): boolean {
  const x = normName(a)
  const y = normName(b)
  if (x === y) return true
  if (x.includes(y) || y.includes(x)) return true
  const xl = x.split(' ').pop() ?? ''
  const yl = y.split(' ').pop() ?? ''
  return xl.length > 3 && xl === yl
}

export function matchEvent(ev: GameEvent, list: OaEvent[]): OaEvent | null {
  const t = new Date(ev.date).getTime()
  let best: OaEvent | null = null
  let bestDiff = Infinity
  for (const e of list) {
    const diff = Math.abs(new Date(e.commence_time).getTime() - t)
    if (diff > 6 * 3600_000) continue
    if (!(teamMatches(ev.home.team.displayName, e.home_team) && teamMatches(ev.away.team.displayName, e.away_team))) continue
    if (diff < bestDiff) {
      best = e
      bestDiff = diff
    }
  }
  return best
}

/* ----------------------------- conversions ----------------------------- */

export function linesFromFeatured(ev: GameEvent, oa: OaEvent): GameLines | null {
  const book = oa.bookmakers?.find((b) => b.key === BOOK)
  if (!book) return null
  const lines: GameLines = { provider: 'FanDuel', synthesized: false }
  let any = false
  for (const m of book.markets) {
    if (m.key === 'h2h') {
      for (const o of m.outcomes) {
        if (teamMatches(o.name, ev.home.team.displayName)) lines.homeML = o.price
        else if (teamMatches(o.name, ev.away.team.displayName)) lines.awayML = o.price
        else if (/draw/i.test(o.name)) lines.drawML = o.price
      }
      any = true
    } else if (m.key === 'spreads') {
      for (const o of m.outcomes) {
        if (teamMatches(o.name, ev.home.team.displayName)) {
          lines.spread = o.point
          lines.homeSpreadOdds = o.price
        } else if (teamMatches(o.name, ev.away.team.displayName)) lines.awaySpreadOdds = o.price
      }
      any = true
    } else if (m.key === 'totals') {
      for (const o of m.outcomes) {
        if (/over/i.test(o.name)) {
          lines.total = o.point
          lines.overOdds = o.price
        } else if (/under/i.test(o.name)) lines.underOdds = o.price
      }
      any = true
    }
  }
  return any ? lines : null
}

export interface OaPlayerLine {
  player: string
  athleteId?: string
  line?: number
  over?: number
  under?: number
  yes?: number
  no?: number
}

/** Group outcomes of a player-prop market by player. */
export function playerLines(m: OaMarket, athletes: Record<string, AthleteInfo>): OaPlayerLine[] {
  const byName = new Map<string, string>()
  for (const a of Object.values(athletes)) byName.set(normName(a.name), a.id)
  const rows = new Map<string, OaPlayerLine>()
  for (const o of m.outcomes) {
    const player = o.description ?? o.name
    const r = rows.get(player) ?? { player, athleteId: byName.get(normName(player)) }
    const nm = o.name.toLowerCase()
    if (nm === 'over') {
      r.over = o.price
      r.line = o.point
    } else if (nm === 'under') {
      r.under = o.price
      r.line = o.point ?? r.line
    } else if (nm === 'yes') r.yes = o.price
    else if (nm === 'no') r.no = o.price
    else {
      // scorer markets list the player as the outcome name
      r.yes = o.price
    }
    rows.set(player, r)
  }
  return [...rows.values()]
}

export function oaStatus(): OaStatus {
  return useSettings.getState().oddsApiStatus
}
