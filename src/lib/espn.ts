import { cached, fetchJson, MINUTE, HOUR, DAY } from './cache'
import type { LeagueDef } from '@/data/sports'
import { LEAGUE_BY_ID } from '@/data/sports'
import type { AthleteInfo, Competitor, EventStatus, GameEvent, GameLines, GameSituation, Team } from './types'

const SITE = 'https://site.api.espn.com/apis/site/v2/sports'
const CORE = 'https://sports.core.api.espn.com/v2/sports'

export function fmtDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

function secure(u: string): string {
  return u.replace(/^http:\/\//, 'https://')
}

/* ----------------------------- raw ESPN shapes ----------------------------- */

interface EspnTeam {
  id: string
  abbreviation?: string
  name?: string
  displayName?: string
  shortDisplayName?: string
  location?: string
  logo?: string
  logos?: { href: string }[]
  color?: string
  alternateColor?: string
}

interface EspnCompetitor {
  id: string
  homeAway: 'home' | 'away'
  winner?: boolean
  score?: string | { value?: number; displayValue?: string }
  team?: EspnTeam
  athlete?: { id: string; displayName?: string; fullName?: string; shortName?: string; flag?: { href?: string }; headshot?: { href?: string } | string }
  linescores?: { value?: number; displayValue?: string }[]
  records?: { summary?: string; type?: string }[]
  probables?: EspnProbable[]
}

interface EspnStatus {
  clock?: number
  displayClock?: string
  period?: number
  type: { id?: string; name: string; state: 'pre' | 'in' | 'post'; completed: boolean; description?: string; detail?: string; shortDetail?: string }
}

interface EspnOddsSummary {
  provider?: { id?: string; name?: string }
  details?: string
  overUnder?: number
  spread?: number
  overOdds?: number
  underOdds?: number
  awayTeamOdds?: { moneyLine?: number; spreadOdds?: number; favorite?: boolean }
  homeTeamOdds?: { moneyLine?: number; spreadOdds?: number; favorite?: boolean }
  drawOdds?: { moneyLine?: number }
  moneyline?: { home?: { close?: { odds?: string } }; away?: { close?: { odds?: string } } }
  pointSpread?: { home?: { close?: { line?: string; odds?: string } }; away?: { close?: { line?: string; odds?: string } } }
  total?: { over?: { close?: { line?: string; odds?: string } }; under?: { close?: { line?: string; odds?: string } } }
}

interface EspnCompetition {
  id: string
  date: string
  neutralSite?: boolean
  status: EspnStatus
  competitors: EspnCompetitor[]
  odds?: EspnOddsSummary[]
  venue?: { fullName?: string; address?: { city?: string; state?: string } }
  broadcasts?: { names?: string[] }[]
  situation?: {
    possession?: string
    downDistanceText?: string
    shortDownDistanceText?: string
    isRedZone?: boolean
    lastPlay?: { text?: string }
    balls?: number
    strikes?: number
    outs?: number
    onFirst?: boolean
    onSecond?: boolean
    onThird?: boolean
  }
  notes?: { headline?: string }[]
  type?: { abbreviation?: string }
}

interface EspnProbable {
  athlete?: { id: string; displayName?: string; shortName?: string; headshot?: string }
  displayName?: string
}

interface EspnEvent {
  id: string
  name: string
  shortName: string
  date: string
  status?: EspnStatus
  competitions: EspnCompetition[]
  week?: { number?: number }
  season?: { year?: number; type?: number }
}

interface EspnScoreboard {
  events: EspnEvent[]
  week?: { number?: number }
  leagues?: { name?: string; abbreviation?: string; calendar?: unknown }[]
}

/* ----------------------------- mappers ----------------------------- */

function parseAmerican(v: unknown): number | undefined {
  if (v === undefined || v === null) return undefined
  const n = typeof v === 'number' ? v : parseInt(String(v).replace('+', ''), 10)
  if (!isFinite(n) || n === 0) return undefined
  return n
}

function mapTeam(c: EspnCompetitor, league: LeagueDef): Team {
  if (c.team) {
    const t = c.team
    return {
      id: t.id,
      abbreviation: t.abbreviation ?? (t.shortDisplayName ?? t.name ?? '').slice(0, 3).toUpperCase(),
      name: t.name ?? t.shortDisplayName ?? t.displayName ?? '',
      displayName: t.displayName ?? t.name ?? '',
      shortDisplayName: t.shortDisplayName ?? t.name ?? t.displayName ?? '',
      location: t.location,
      logo: t.logo ?? t.logos?.[0]?.href,
      color: t.color ? `#${t.color}` : undefined,
      altColor: t.alternateColor ? `#${t.alternateColor}` : undefined,
      record: c.records?.find((r) => r.type === 'total' || !r.type)?.summary ?? c.records?.[0]?.summary,
    }
  }
  const a = c.athlete
  const name = a?.displayName ?? a?.fullName ?? 'TBD'
  const hs = typeof a?.headshot === 'string' ? a?.headshot : a?.headshot?.href
  return {
    id: a?.id ?? c.id,
    abbreviation: (a?.shortName ?? name).split(' ').slice(-1)[0].slice(0, 3).toUpperCase(),
    name: name.split(' ').slice(-1)[0],
    displayName: name,
    shortDisplayName: a?.shortName ?? name,
    logo: hs ?? a?.flag?.href,
    record: undefined,
  } as Team & { _league?: LeagueDef; _l?: typeof league }
}

function mapCompetitor(c: EspnCompetitor, league: LeagueDef): Competitor {
  const scoreRaw = typeof c.score === 'object' ? c.score?.value ?? parseFloat(c.score?.displayValue ?? '0') : parseFloat(c.score ?? '0')
  return {
    team: mapTeam(c, league),
    homeAway: c.homeAway,
    score: isFinite(scoreRaw) ? scoreRaw : 0,
    winner: c.winner,
    linescores: c.linescores?.map((l) => (typeof l.value === 'number' ? l.value : parseFloat(l.displayValue ?? '0') || 0)),
  }
}

function mapStatus(s: EspnStatus | undefined): EventStatus {
  if (!s) return { state: 'pre', completed: false, period: 0, clock: '', detail: '', shortDetail: '', name: 'STATUS_SCHEDULED' }
  return {
    state: s.type.state,
    completed: !!s.type.completed,
    period: s.period ?? 0,
    clock: s.displayClock ?? '',
    detail: s.type.detail ?? s.type.description ?? '',
    shortDetail: s.type.shortDetail ?? '',
    name: s.type.name,
  }
}

function mapLines(o: EspnOddsSummary | undefined): GameLines | undefined {
  if (!o) return undefined
  const lines: GameLines = { provider: o.provider?.name ?? 'Book', synthesized: false }
  const spread = typeof o.spread === 'number' ? o.spread : undefined
  if (spread !== undefined) lines.spread = spread
  else if (o.pointSpread?.home?.close?.line) lines.spread = parseFloat(o.pointSpread.home.close.line)
  lines.homeSpreadOdds = parseAmerican(o.homeTeamOdds?.spreadOdds) ?? parseAmerican(o.pointSpread?.home?.close?.odds)
  lines.awaySpreadOdds = parseAmerican(o.awayTeamOdds?.spreadOdds) ?? parseAmerican(o.pointSpread?.away?.close?.odds)
  lines.homeML = parseAmerican(o.homeTeamOdds?.moneyLine) ?? parseAmerican(o.moneyline?.home?.close?.odds)
  lines.awayML = parseAmerican(o.awayTeamOdds?.moneyLine) ?? parseAmerican(o.moneyline?.away?.close?.odds)
  lines.drawML = parseAmerican(o.drawOdds?.moneyLine)
  lines.total = typeof o.overUnder === 'number' ? o.overUnder : o.total?.over?.close?.line ? parseFloat(o.total.over.close.line) : undefined
  lines.overOdds = parseAmerican(o.overOdds) ?? parseAmerican(o.total?.over?.close?.odds)
  lines.underOdds = parseAmerican(o.underOdds) ?? parseAmerican(o.total?.under?.close?.odds)
  if (lines.spread === undefined && lines.homeML === undefined && lines.total === undefined) return undefined
  return lines
}

function mapSituation(c: EspnCompetition): GameSituation | undefined {
  const s = c.situation
  if (!s) return undefined
  return {
    possessionTeamId: s.possession,
    downDistanceText: s.shortDownDistanceText ?? s.downDistanceText,
    lastPlay: s.lastPlay?.text,
    isRedZone: s.isRedZone,
    balls: s.balls,
    strikes: s.strikes,
    outs: s.outs,
    onFirst: s.onFirst,
    onSecond: s.onSecond,
    onThird: s.onThird,
  }
}

export function mapEvent(e: EspnEvent, league: LeagueDef, groupName?: string): GameEvent | null {
  const c = e.competitions?.[0]
  if (!c || !c.competitors || c.competitors.length < 2) return null
  const home = c.competitors.find((x) => x.homeAway === 'home') ?? c.competitors[0]
  const away = c.competitors.find((x) => x.homeAway === 'away') ?? c.competitors[1]
  const status = mapStatus(c.status ?? e.status)
  return {
    id: e.id,
    leagueId: league.id,
    sport: league.sport,
    name: e.name,
    shortName: e.shortName,
    date: c.date ?? e.date,
    status,
    home: mapCompetitor(home, league),
    away: mapCompetitor(away, league),
    neutralSite: c.neutralSite,
    venue: c.venue?.fullName,
    broadcast: c.broadcasts?.[0]?.names?.[0],
    lines: mapLines(c.odds?.[0]),
    situation: mapSituation(c),
    weekText: e.week?.number ? `Week ${e.week.number}` : undefined,
    isAthleteEvent: !home.team,
    groupName: groupName ?? c.notes?.[0]?.headline ?? c.type?.abbreviation,
    probables: c.competitors.flatMap((x) => (x.probables ?? []).filter((p) => p.athlete?.id).map((p) => ({ teamId: x.team?.id ?? x.id, athleteId: p.athlete!.id, name: p.athlete!.displayName ?? '' }))),
  }
}

/* ----------------------------- team leaders ----------------------------- */

interface EspnLeaders {
  categories?: { name: string; displayName?: string; leaders?: { value: number; displayValue: string; athlete?: { $ref: string } }[] }[]
}

export interface TeamLeadersRaw {
  teamId: string
  categories: Record<string, { athleteId: string; value: number; displayValue: string }[]>
}

export async function fetchTeamLeaders(league: LeagueDef, teamId: string, season: number, seasonType = 2): Promise<TeamLeadersRaw> {
  const url = `${CORE}/${league.espnSport}/leagues/${league.espnLeague}/seasons/${season}/types/${seasonType}/teams/${teamId}/leaders`
  try {
    const raw = await cached(`leaders:${league.id}:${teamId}:${season}`, () => fetchJson<EspnLeaders>(url), { ttl: 12 * HOUR, persist: true })
    const categories: TeamLeadersRaw['categories'] = {}
    for (const c of raw.categories ?? []) {
      categories[c.name] = (c.leaders ?? [])
        .map((l) => ({ athleteId: l.athlete?.$ref.match(/athletes\/(\d+)/)?.[1] ?? '', value: l.value, displayValue: l.displayValue }))
        .filter((l) => l.athleteId)
    }
    return { teamId, categories }
  } catch {
    return { teamId, categories: {} }
  }
}

/* ----------------------------- public API ----------------------------- */

export async function fetchScoreboard(league: LeagueDef, opts: { dates?: string; force?: boolean } = {}): Promise<GameEvent[]> {
  const params = new URLSearchParams()
  if (opts.dates) params.set('dates', opts.dates)
  if (league.groups) params.set('groups', league.groups)
  params.set('limit', '400')
  const url = `${SITE}/${league.espnSport}/${league.espnLeague}/scoreboard?${params.toString()}`
  const key = `sb:${league.id}:${opts.dates ?? 'default'}`
  const raw = await cached(key, () => fetchJson<EspnScoreboard>(url), { ttl: 45_000, force: opts.force })
  const out: GameEvent[] = []
  for (const e of raw.events ?? []) {
    if (league.athleteEvent && e.competitions?.length > 1) {
      // Fight cards / tournaments: each competition is its own bout
      for (const comp of e.competitions) {
        const sub: EspnEvent = { ...e, id: comp.id, name: comp.competitors?.map((x) => x.athlete?.displayName ?? x.team?.displayName ?? '').join(' vs '), shortName: comp.competitors?.map((x) => x.athlete?.shortName ?? x.team?.abbreviation ?? '').join(' vs '), competitions: [comp] }
        const m = mapEvent(sub, league, e.name)
        if (m) out.push(m)
      }
    } else {
      const m = mapEvent(e, league)
      if (m) out.push(m)
    }
  }
  return out
}

/** Fetch upcoming + in-progress events for a league over its lookahead window. */
export async function fetchLeagueEvents(league: LeagueDef, opts: { force?: boolean } = {}): Promise<GameEvent[]> {
  const now = new Date()
  const start = new Date(now.getTime() - 6 * HOUR)
  const end = new Date(now.getTime() + league.daysAhead * DAY)
  const dates = `${fmtDate(start)}-${fmtDate(end)}`
  let events: GameEvent[] = []
  let err: unknown = null
  try {
    events = await fetchScoreboard(league, { dates, force: opts.force })
  } catch (e) {
    err = e
  }
  if (events.length === 0 && (league.id === 'nfl' || league.id === 'ncaaf' || league.id === 'cfl')) {
    try {
      events = await fetchScoreboard(league, { force: opts.force })
      err = null
    } catch (e) {
      err = err ?? e
    }
  }
  if (err && events.length === 0) throw err
  const seen = new Set<string>()
  return events.filter((e) => {
    if (seen.has(e.id)) return false
    seen.add(e.id)
    return true
  })
}

export async function fetchEvent(league: LeagueDef, eventId: string, opts: { force?: boolean } = {}): Promise<GameEvent | null> {
  const s = await fetchSummary(league, eventId, opts)
  return s.event
}

/* ----------------------------- summary / box score ----------------------------- */

export interface BoxScoreStatGroup {
  name: string
  keys: string[]
  labels: string[]
  athletes: { athlete: AthleteInfo; stats: string[] }[]
}

export interface BoxScoreTeam {
  teamId: string
  groups: BoxScoreStatGroup[]
}

export interface EventSummary {
  event: GameEvent | null
  boxscore: BoxScoreTeam[]
  leaders: { teamId: string; category: string; leaders: { athlete: AthleteInfo; value: string }[] }[]
  scoringPlays: { text: string; teamId?: string; period: number; clock: string; athleteIds: string[]; scoringType?: string; homeScore?: number; awayScore?: number }[]
  rosters: { teamId: string; athletes: AthleteInfo[] }[]
  cards: { athleteId?: string; athleteName: string; red: boolean; minute?: string }[]
  fetchedAt: number
}

interface EspnSummary {
  header?: { id?: string; competitions?: EspnCompetition[]; season?: unknown; week?: number; league?: unknown }
  boxscore?: { players?: { team: EspnTeam; statistics: { name: string; keys?: string[]; labels?: string[]; athletes: { athlete: { id: string; displayName: string; shortName?: string; position?: { abbreviation?: string }; jersey?: string; headshot?: { href?: string } | string }; stats: string[] }[] }[] }[]; teams?: unknown[] }
  leaders?: { team: EspnTeam; leaders: { name: string; displayName?: string; leaders: { displayValue: string; athlete: { id: string; displayName: string; shortName?: string; position?: { abbreviation?: string }; headshot?: { href?: string } | string; jersey?: string } }[] }[] }[]
  scoringPlays?: { text?: string; team?: { id: string }; period?: { number: number }; clock?: { displayValue?: string }; participants?: { athlete?: { id: string } }[]; scoringType?: { name?: string; abbreviation?: string }; homeScore?: number; awayScore?: number; type?: { text?: string } }[]
  rosters?: { team: EspnTeam; roster?: { athlete: { id: string; displayName: string; shortName?: string; position?: { abbreviation?: string }; jersey?: string; headshot?: { href?: string } | string }; stats?: { name?: string; abbreviation?: string; displayValue?: string; value?: number }[] }[]; homeAway?: string }[]
  gameInfo?: { venue?: { fullName?: string } }
  keyEvents?: { type?: { id?: string; text?: string }; clock?: { displayValue?: string }; period?: { number?: number }; team?: { id?: string }; participants?: { athlete?: { id?: string; displayName?: string } }[]; text?: string; scoringPlay?: boolean; scoreValue?: number; homeScore?: number; awayScore?: number }[]
}

function mapAthlete(a: { id: string; displayName: string; shortName?: string; position?: { abbreviation?: string }; jersey?: string; headshot?: { href?: string } | string }, teamId?: string): AthleteInfo {
  return {
    id: a.id,
    name: a.displayName,
    shortName: a.shortName,
    position: a.position?.abbreviation,
    jersey: a.jersey,
    headshot: typeof a.headshot === 'string' ? a.headshot : a.headshot?.href,
    teamId,
  }
}

export async function fetchSummary(league: LeagueDef, eventId: string, opts: { force?: boolean } = {}): Promise<EventSummary> {
  const url = `${SITE}/${league.espnSport}/${league.espnLeague}/summary?event=${eventId}`
  const raw = await cached(`sum:${league.id}:${eventId}`, () => fetchJson<EspnSummary>(url), { ttl: 30_000, force: opts.force })
  const comp = raw.header?.competitions?.[0]
  let event: GameEvent | null = null
  if (comp) {
    const ev: EspnEvent = { id: eventId, name: '', shortName: '', date: comp.date, competitions: [comp] }
    event = mapEvent(ev, league)
    if (event) {
      event.name = `${event.away.team.displayName} at ${event.home.team.displayName}`
      event.shortName = `${event.away.team.abbreviation} @ ${event.home.team.abbreviation}`
      event.venue = raw.gameInfo?.venue?.fullName ?? event.venue
    }
  }
  const boxscore: BoxScoreTeam[] = (raw.boxscore?.players ?? []).map((p) => ({
    teamId: p.team.id,
    groups: (p.statistics ?? []).map((g) => ({
      name: g.name,
      keys: g.keys ?? [],
      labels: g.labels ?? [],
      athletes: (g.athletes ?? []).map((a) => ({ athlete: mapAthlete(a.athlete, p.team.id), stats: a.stats })),
    })),
  }))
  const leaders = (raw.leaders ?? []).flatMap((t) =>
    (t.leaders ?? []).map((cat) => ({
      teamId: t.team.id,
      category: cat.displayName ?? cat.name,
      leaders: (cat.leaders ?? []).map((l) => ({ athlete: mapAthlete(l.athlete, t.team.id), value: l.displayValue })),
    })),
  )
  const scoringPlays = (raw.scoringPlays ?? []).map((p) => ({
    text: p.text ?? p.type?.text ?? '',
    teamId: p.team?.id,
    period: p.period?.number ?? 0,
    clock: p.clock?.displayValue ?? '',
    athleteIds: (p.participants ?? []).map((x) => x.athlete?.id).filter((x): x is string => !!x),
    scoringType: p.scoringType?.name ?? p.scoringType?.abbreviation,
    homeScore: p.homeScore,
    awayScore: p.awayScore,
  }))
  const rosters = (raw.rosters ?? []).map((r) => ({
    teamId: r.team.id,
    athletes: (r.roster ?? []).map((x) => {
      const a = mapAthlete(x.athlete, r.team.id) as AthleteInfo & { stats?: Record<string, string> }
      if (x.stats?.length) {
        a.stats = {}
        for (const s of x.stats) if (s.name) a.stats[s.name] = s.displayValue ?? String(s.value ?? '')
      }
      return a
    }),
  }))
  const cards: EventSummary['cards'] = []
  for (const k of raw.keyEvents ?? []) {
    const t = (k.type?.text ?? '').toLowerCase()
    const p = k.participants?.[0]?.athlete
    if (/card/.test(t) && p) cards.push({ athleteId: p.id, athleteName: p.displayName ?? '', red: /red/.test(t), minute: k.clock?.displayValue })
    if ((k.scoringPlay || /goal/.test(t)) && !/own goal/.test(t) && p && !scoringPlays.some((s) => s.clock === k.clock?.displayValue && s.text === (k.text ?? ''))) {
      scoringPlays.push({ text: k.text ?? `${p.displayName ?? ''} Goal`, teamId: k.team?.id, period: k.period?.number ?? 0, clock: k.clock?.displayValue ?? '', athleteIds: p.id ? [p.id] : [], scoringType: 'goal', homeScore: k.homeScore, awayScore: k.awayScore })
    }
  }
  return { event, boxscore, leaders, scoringPlays, rosters, cards, fetchedAt: Date.now() }
}

/* ----------------------------- core odds + props ----------------------------- */

export interface RawPropBet {
  typeId: string
  typeName: string
  athleteId?: string
  teamId?: string
  line?: number
  lineDisplay?: string
}

export interface CoreOdds {
  lines?: GameLines
  propBetsRef?: string
  providerId?: string
}

interface EspnCoreOddsItem {
  provider?: { id?: string; name?: string }
  details?: string
  overUnder?: number
  spread?: number
  overOdds?: number
  underOdds?: number
  awayTeamOdds?: { moneyLine?: number; spreadOdds?: number; current?: { moneyLine?: { american?: string }; spread?: { american?: string } } }
  homeTeamOdds?: { moneyLine?: number; spreadOdds?: number; current?: { moneyLine?: { american?: string }; spread?: { american?: string } } }
  drawOdds?: { moneyLine?: number }
  propBets?: { $ref: string }
}

export async function fetchCoreOdds(league: LeagueDef, eventId: string): Promise<CoreOdds> {
  const url = `${CORE}/${league.espnSport}/leagues/${league.espnLeague}/events/${eventId}/competitions/${eventId}/odds`
  try {
    const raw = await cached(`odds:${league.id}:${eventId}`, () => fetchJson<{ items?: EspnCoreOddsItem[] }>(url), { ttl: 2 * MINUTE })
    const it = raw.items?.[0]
    if (!it) return {}
    const lines = mapLines({
      provider: it.provider,
      overUnder: it.overUnder,
      spread: it.spread,
      overOdds: it.overOdds,
      underOdds: it.underOdds,
      awayTeamOdds: { moneyLine: it.awayTeamOdds?.moneyLine ?? parseAmerican(it.awayTeamOdds?.current?.moneyLine?.american), spreadOdds: it.awayTeamOdds?.spreadOdds ?? parseAmerican(it.awayTeamOdds?.current?.spread?.american) },
      homeTeamOdds: { moneyLine: it.homeTeamOdds?.moneyLine ?? parseAmerican(it.homeTeamOdds?.current?.moneyLine?.american), spreadOdds: it.homeTeamOdds?.spreadOdds ?? parseAmerican(it.homeTeamOdds?.current?.spread?.american) },
      drawOdds: it.drawOdds,
    })
    return { lines, propBetsRef: it.propBets?.$ref, providerId: it.provider?.id }
  } catch {
    return {}
  }
}

interface EspnPropItem {
  athlete?: { $ref: string }
  team?: { $ref: string }
  type: { id: string; name: string }
  current?: { target?: { value?: number; displayValue?: string } }
}

export async function fetchPropBets(league: LeagueDef, eventId: string, ref: string): Promise<RawPropBet[]> {
  const url = secure(ref).replace(/([?&])limit=\d+/, '') + (ref.includes('?') ? '&' : '?') + 'limit=1000'
  try {
    const raw = await cached(`props:${league.id}:${eventId}`, () => fetchJson<{ items?: EspnPropItem[] }>(url), { ttl: 10 * MINUTE })
    return (raw.items ?? []).map((i) => ({
      typeId: i.type.id,
      typeName: i.type.name,
      athleteId: i.athlete?.$ref.match(/athletes\/(\d+)/)?.[1],
      teamId: i.team?.$ref.match(/teams\/(\d+)/)?.[1],
      line: i.current?.target?.value,
      lineDisplay: i.current?.target?.displayValue,
    }))
  } catch {
    return []
  }
}

/* ----------------------------- rosters / teams / athletes ----------------------------- */

interface EspnRoster {
  athletes?: ({ position?: string; items?: EspnRosterAthlete[] } | EspnRosterAthlete)[]
}
interface EspnRosterAthlete {
  id: string
  displayName: string
  shortName?: string
  position?: { abbreviation?: string }
  jersey?: string
  headshot?: { href?: string }
  status?: { type?: string }
  injuries?: { status?: string }[]
  starter?: boolean
}

export async function fetchRoster(league: LeagueDef, teamId: string): Promise<AthleteInfo[]> {
  const url = `${SITE}/${league.espnSport}/${league.espnLeague}/teams/${teamId}/roster`
  try {
    const raw = await cached(`roster:${league.id}:${teamId}`, () => fetchJson<EspnRoster>(url), { ttl: 12 * HOUR })
    const out: AthleteInfo[] = []
    const push = (a: EspnRosterAthlete, group?: string) => {
      if (group && /injur|suspend|practice/i.test(group)) return
      out.push({ id: a.id, name: a.displayName, shortName: a.shortName, position: a.position?.abbreviation, jersey: a.jersey, headshot: a.headshot?.href, teamId, status: a.injuries?.[0]?.status ?? a.status?.type })
    }
    for (const g of raw.athletes ?? []) {
      if ('items' in g && Array.isArray(g.items)) g.items.forEach((a) => push(a, g.position))
      else if ('id' in g) push(g as EspnRosterAthlete)
    }
    return out
  } catch {
    return []
  }
}

interface EspnStandings {
  children?: { standings?: { entries?: { team: EspnTeam }[] }; children?: EspnStandings['children'] }[]
  standings?: { entries?: { team: EspnTeam }[] }
}

/** ESPN's CDN logo path is predictable, which covers endpoints that omit logos. */
export function teamLogoUrl(league: LeagueDef, team: { id: string; abbreviation?: string }): string | undefined {
  const abbr = team.abbreviation?.toLowerCase()
  switch (league.id) {
    case 'nfl': case 'nba': case 'mlb': case 'nhl': case 'wnba':
      return abbr ? `https://a.espncdn.com/i/teamlogos/${league.espnLeague}/500/${abbr}.png` : undefined
    case 'ncaaf': case 'ncaab': case 'ncaaw':
      return `https://a.espncdn.com/i/teamlogos/ncaa/500/${team.id}.png`
    case 'cfl':
      return abbr ? `https://a.espncdn.com/i/teamlogos/cfl/500/${abbr}.png` : undefined
  }
  if (league.sport === 'soccer') return `https://a.espncdn.com/i/teamlogos/soccer/500/${team.id}.png`
  return undefined
}

function collectStandingsTeams(node: EspnStandings | undefined, out: Record<string, Team>, league: LeagueDef) {
  if (!node) return
  for (const e of node.standings?.entries ?? []) {
    const tm = e.team
    out[tm.id] = {
      id: tm.id,
      abbreviation: tm.abbreviation ?? '',
      name: tm.name ?? '',
      displayName: tm.displayName ?? '',
      shortDisplayName: tm.shortDisplayName ?? tm.name ?? '',
      location: tm.location,
      logo: tm.logos?.[0]?.href ?? tm.logo ?? teamLogoUrl(league, tm),
      color: tm.color ? `#${tm.color}` : undefined,
    }
  }
  for (const c of node.children ?? []) collectStandingsTeams(c, out, league)
}

/** Team directory. The site "teams" endpoint has no CORS header, so use standings (which does) and fall back to the core API. */
export async function fetchTeams(league: LeagueDef): Promise<Record<string, Team>> {
  return cached(
    `teamsdir:${league.id}`,
    async () => {
      const out: Record<string, Team> = {}
      try {
        const url = `https://site.api.espn.com/apis/v2/sports/${league.espnSport}/${league.espnLeague}/standings${league.groups ? `?group=${league.groups}` : ''}`
        const raw = await fetchJson<EspnStandings>(url)
        collectStandingsTeams(raw, out, league)
      } catch {
        /* fall through */
      }
      if (Object.keys(out).length >= 8) return out
      try {
        const yr = seasonYearFor(league)
        const list = await fetchJson<{ items?: { $ref: string }[] }>(`${CORE}/${league.espnSport}/leagues/${league.espnLeague}/seasons/${yr}/teams?limit=200${league.groups ? `&groups=${league.groups}` : ''}`)
        const refs = (list.items ?? []).map((i) => secure(i.$ref)).slice(0, 140)
        const teams = await Promise.all(refs.map((r) => fetchJson<EspnTeam & { logos?: { href: string }[] }>(r).catch(() => null)))
        for (const tm of teams) {
          if (!tm) continue
          out[tm.id] = {
            id: tm.id,
            abbreviation: tm.abbreviation ?? '',
            name: tm.name ?? '',
            displayName: tm.displayName ?? '',
            shortDisplayName: tm.shortDisplayName ?? tm.name ?? '',
            location: tm.location,
            logo: tm.logos?.[0]?.href ?? teamLogoUrl(league, tm),
            color: tm.color ? `#${tm.color}` : undefined,
          }
        }
      } catch {
        /* ignore */
      }
      return out
    },
    { ttl: DAY, persist: true },
  )
}

interface EspnAthlete {
  id: string
  displayName?: string
  fullName?: string
  shortName?: string
  position?: { abbreviation?: string }
  jersey?: string
  headshot?: { href?: string }
  team?: { $ref?: string }
}

export async function fetchAthlete(league: LeagueDef, athleteId: string, season?: number): Promise<AthleteInfo | null> {
  const yr = season ?? new Date().getFullYear()
  const url = `${CORE}/${league.espnSport}/leagues/${league.espnLeague}/seasons/${yr}/athletes/${athleteId}`
  try {
    const a = await cached(`ath:${league.id}:${athleteId}`, () => fetchJson<EspnAthlete>(url), { ttl: 7 * DAY, persist: true })
    return { id: a.id, name: a.displayName ?? a.fullName ?? 'Unknown', shortName: a.shortName, position: a.position?.abbreviation, jersey: a.jersey, headshot: a.headshot?.href, teamId: a.team?.$ref?.match(/teams\/(\d+)/)?.[1] }
  } catch {
    return null
  }
}

/* ----------------------------- futures ----------------------------- */

interface EspnFutures {
  items?: { id: string; name: string; displayName?: string; futures?: { provider?: { name?: string }; books?: { athlete?: { $ref: string }; team?: { $ref: string }; value: string }[] }[] }[]
}

export interface RawFuture {
  id: string
  name: string
  books: { athleteId?: string; teamId?: string; odds: number }[]
}

export async function fetchFutures(league: LeagueDef, season: number): Promise<RawFuture[]> {
  const url = `${CORE}/${league.espnSport}/leagues/${league.espnLeague}/seasons/${season}/futures?limit=100`
  try {
    const raw = await cached(`fut:${league.id}:${season}`, () => fetchJson<EspnFutures>(url), { ttl: 6 * HOUR, persist: true })
    return (raw.items ?? []).map((f) => ({
      id: f.id,
      name: f.displayName ?? f.name,
      books: (f.futures?.[0]?.books ?? [])
        .map((b) => ({ athleteId: b.athlete?.$ref.match(/athletes\/(\d+)/)?.[1], teamId: b.team?.$ref.match(/teams\/(\d+)/)?.[1], odds: parseAmerican(b.value) ?? 0 }))
        .filter((b) => b.odds !== 0),
    })).filter((f) => f.books.length > 0)
  } catch {
    return []
  }
}

export function leagueFor(id: string): LeagueDef | undefined {
  return LEAGUE_BY_ID[id]
}

export function seasonYearFor(league: LeagueDef, now = new Date()): number {
  const y = now.getFullYear()
  const m = now.getMonth()
  if (league.sport === 'basketball' && (league.id === 'nba' || league.id === 'ncaab' || league.id === 'ncaaw')) return m >= 8 ? y + 1 : y
  if (league.sport === 'hockey') return m >= 8 ? y + 1 : y
  return y
}
