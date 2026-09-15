/** Shared building blocks for FanDuel-exact market catalogs. */
import type { LeagueDef } from '@/data/sports'
import type { RawPropBet } from '../espn'
import { normCdf, priceFromProb, seededRandom, toHalfLine } from '../odds'
import { imp, ladderOdds, twoWay } from '../pricing'
import type { TeamLeaders } from '../props'
import type { AthleteInfo, GameEvent, GameLines, Grading, Market, MarketGroup, MarketKind, Selection } from '../types'

export const TAB = {
  SGP: 'Same Game Parlay™',
  POPULAR: 'Popular',
  QUICK: 'Quick Bets',
  PASSING: 'Passing Props',
  RECEIVING: 'Receiving Props',
  RUSHING: 'Rushing Props',
  TD: 'TD Scorer Props',
  DST: 'D/ST',
  Q1: '1st Quarter',
  Q2: '2nd Quarter',
  Q3: '3rd Quarter',
  Q4: '4th Quarter',
  H1: '1st Half',
  H2: '2nd Half',
  HALF: 'Half',
  SCORING: 'Scoring',
  PARLAYS: 'Parlays',
  TEAM_YARDS: 'Team Yards',
  PTS: 'Player Points',
  THREES: 'Player Threes',
  REB: 'Player Rebounds',
  AST: 'Player Assists',
  COMBOS: 'Player Combos',
  MARGIN: 'Margin',
  TOTAL_PARLAYS: 'Total Parlays',
  LASERS: 'Lasers',
  MOONSHOTS: 'Moonshots',
  BATTER: 'Batter Props',
  PITCHER: 'Pitcher Props',
  F5: 'First 5 Innings',
  HITS_RUNS: 'Hits & Runs',
  INNINGS: 'Innings',
  GAME_PROPS: 'Game Props',
  OVERTIME: 'Overtime',
  GOALSCORER: 'Goalscorer',
  PERIODS: 'Periods',
  PLAYER_PROPS: 'Player Props',
  GOALS: 'Goals',
  SPECIALS: 'Specials',
  CORNERS: 'Corners & Cards',
  TEAM_PROPS: 'Team Props',
  METHOD: 'Method of Victory',
  ROUNDS: 'Round Betting',
  SETS: 'Set Betting',
  GAMES: 'Game Props',
} as const

export interface Ctx {
  ev: GameEvent
  league: LeagueDef
  lines: GameLines
  athletes: Record<string, AthleteInfo>
  leaders: TeamLeaders[]
  raw: RawPropBet[]
  rnd: () => number
  cal: string
}

export function makeCtx(ev: GameEvent, league: LeagueDef, lines: GameLines, athletes: Record<string, AthleteInfo>, leaders: TeamLeaders[], raw: RawPropBet[]): Ctx {
  return { ev, league, lines, athletes, leaders, raw, rnd: seededRandom(`cat:${ev.id}`), cal: league.id }
}

/* ----------------------------- game model ----------------------------- */

export interface GameModel {
  spread: number // home spread (negative = home favored)
  total: number
  pHome: number // de-vigged win probability (regulation incl. OT as posted)
  pAway: number
  pDraw: number
  expHome: number
  expAway: number
  homeFav: boolean
  fav: GameEvent['home']
  dog: GameEvent['home']
}

export function gameModel(ctx: Ctx): GameModel {
  const { lines, ev } = ctx
  const spread = lines.spread ?? 0
  const total = lines.total ?? 0
  let pHome = 0.5
  let pAway = 0.5
  let pDraw = 0
  if (lines.homeML !== undefined && lines.awayML !== undefined) {
    const h = imp(lines.homeML)
    const a = imp(lines.awayML)
    const d = lines.drawML !== undefined ? imp(lines.drawML) : 0
    const s = h + a + d
    pHome = h / s
    pAway = a / s
    pDraw = d / s
  }
  const homeFav = spread < 0 || (spread === 0 && pHome >= pAway)
  return { spread, total, pHome, pAway, pDraw, expHome: (total - spread) / 2, expAway: (total + spread) / 2, homeFav, fav: homeFav ? ev.home : ev.away, dog: homeFav ? ev.away : ev.home }
}

/* ----------------------------- market helpers ----------------------------- */

export interface MkOpts {
  tabs: string[]
  group?: MarketGroup
  kind?: MarketKind
  layout?: Market['layout']
  sgp?: boolean
  sort: number
  category?: string
  player?: AthleteInfo | { id: string; name: string; teamId?: string; position?: string; headshot?: string }
  line?: number
  fdType?: string
}

export function mkm(ctx: Ctx, id: string, name: string, o: MkOpts): Market {
  return {
    id: `${ctx.ev.id}|${id}`,
    eventId: ctx.ev.id,
    leagueId: ctx.ev.leagueId,
    name,
    group: o.group ?? 'props',
    kind: o.kind ?? 'prop_ou',
    layout: o.layout ?? 'two-col',
    sgp: o.sgp ?? true,
    selections: [],
    sortOrder: o.sort,
    category: o.category,
    tabs: o.tabs,
    fdType: o.fdType,
    playerId: o.player?.id,
    playerName: o.player?.name,
    playerTeamId: o.player?.teamId,
    playerPosition: o.player?.position,
    headshot: o.player?.headshot,
    line: o.line,
    priced: 'model',
  }
}

export function add(m: Market, suffix: string, label: string, odds: number, grading: Grading, extra: Partial<Selection> = {}): Selection {
  const s: Selection = { id: `${m.id}|${suffix}`, marketId: m.id, eventId: m.eventId, leagueId: m.leagueId, label, odds, grading, sub: m.name, ...extra }
  m.selections.push(s)
  return s
}

export function fmtLine(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

export function signed(n: number): string {
  if (n === 0) return 'PK'
  return n > 0 ? `+${fmtLine(n)}` : fmtLine(n)
}

export function teamShort(c: GameEvent['home']): string {
  return `${c.team.abbreviation} ${c.team.shortDisplayName}`
}

/** Yes/No market. */
export function yesNo(ctx: Ctx, id: string, name: string, pYes: number, vig: number, o: MkOpts, grading: Omit<Grading, 'side'>, labels: [string, string] = ['Yes', 'No']): Market {
  const m = mkm(ctx, id, name, { kind: 'prop_yesno', layout: 'two-col', ...o })
  const [y, n] = twoWay(pYes, vig)
  add(m, 'yes', labels[0], y, { ...grading, side: 'yes' } as Grading)
  add(m, 'no', labels[1], n, { ...grading, side: 'no' } as Grading)
  return m
}

/** Over/Under market with an explicit line and a probability of the over. */
export function overUnder(ctx: Ctx, id: string, name: string, line: number, pOver: number, vig: number, o: MkOpts, grading: Omit<Grading, 'side' | 'line'>, extra: Partial<Selection> = {}): Market {
  const m = mkm(ctx, id, name, { kind: 'prop_ou', layout: 'two-col', line, ...o })
  const [ov, un] = twoWay(pOver, vig)
  add(m, 'over', `Over ${fmtLine(line)}`, ov, { ...grading, side: 'over', line } as Grading, { line, ...extra })
  add(m, 'under', `Under ${fmtLine(line)}`, un, { ...grading, side: 'under', line } as Grading, { line, ...extra })
  return m
}

/** Over/Under with fixed FanDuel juice (e.g. -114/-114 yardage props). */
export function overUnderJuice(ctx: Ctx, id: string, name: string, line: number, juice: [number, number], o: MkOpts, grading: Omit<Grading, 'side' | 'line'>, extra: Partial<Selection> = {}): Market {
  const m = mkm(ctx, id, name, { kind: 'prop_ou', layout: 'two-col', line, ...o })
  add(m, 'over', `Over ${fmtLine(line)}`, juice[0], { ...grading, side: 'over', line } as Grading, { line, ...extra })
  add(m, 'under', `Under ${fmtLine(line)}`, juice[1], { ...grading, side: 'under', line } as Grading, { line, ...extra })
  return m
}

/** "N+" ladder priced from FanDuel's empirical curve for that stat. */
export function ladder(ctx: Ctx, id: string, name: string, o: MkOpts, spec: { stat: string; statKey: string; playerId?: string; playerName?: string; mainLine: number; thresholds: number[]; unit: (t: number) => string; sigma: number; integer?: boolean; prefix?: string; teamId?: string }): Market | null {
  const m = mkm(ctx, id, name, { kind: 'prop_ladder', layout: 'ladder', ...o })
  for (const t of spec.thresholds) {
    const odds = ladderOdds(ctx.cal, spec.stat, spec.mainLine, t, spec.sigma, spec.integer)
    const p = imp(odds)
    if (p < 0.012 || p > 0.985) continue
    const label = `${spec.prefix ? spec.prefix + ' ' : ''}${spec.unit(t)}`
    add(m, `${t}`, label, odds, { kind: 'player_ladder', statKey: spec.statKey, playerId: spec.playerId, playerName: spec.playerName, line: t, teamId: spec.teamId }, { playerId: spec.playerId, teamId: spec.teamId, line: t })
  }
  return m.selections.length >= 2 ? m : null
}

/** List market (one price per runner), sorted by odds. */
export function list(ctx: Ctx, id: string, name: string, o: MkOpts, rows: { key: string; label: string; p: number; grading: Grading; extra?: Partial<Selection> }[], vig: number, minP = 0.01, maxP = 0.94): Market | null {
  const m = mkm(ctx, id, name, { kind: 'scorer', layout: 'list', ...o })
  for (const r of rows) {
    if (r.p < minP || r.p > maxP) continue
    // FanDuel shades longshots harder than favourites: scale the margin by how far the runner is from certain
    add(m, r.key, r.label, priceFromProb(r.p, vig * Math.min(1.6, 2 * (1 - r.p))), r.grading, r.extra)
  }
  m.selections.sort((a, b) => a.odds - b.odds)
  return m.selections.length ? m : null
}

/** Alternate handicap ladder for a full game or period. */
export function altSpread(ctx: Ctx, id: string, name: string, o: MkOpts, spread: number, sigma: number, from: number, to: number, step: number, period?: string, vigFn = (p: number) => 0.04 + 0.05 * Math.abs(p - 0.5) * 2): Market {
  const { ev } = ctx
  const m = mkm(ctx, id, name, { kind: 'alt_spread', layout: 'grid', ...o })
  for (let k = from; k <= to; k += step) {
    const hs = toHalfLine(spread + k)
    const pHome = 1 - normCdf((-hs - -spread) / sigma) // P(home margin > -hs) with mean = -spread
    const pH = Math.min(0.995, Math.max(0.005, pHome))
    const kind = period ? ('period_spread' as const) : ('spread' as const)
    add(m, `away|${-hs}`, `${ev.away.team.displayName} (${signed(-hs)})`, priceFromProb(1 - pH, vigFn(1 - pH)), { kind, side: 'away', teamId: ev.away.team.id, line: -hs, period }, { line: -hs, teamId: ev.away.team.id })
    add(m, `home|${hs}`, `${ev.home.team.displayName} (${signed(hs)})`, priceFromProb(pH, vigFn(pH)), { kind, side: 'home', teamId: ev.home.team.id, line: hs, period }, { line: hs, teamId: ev.home.team.id })
  }
  return m
}

/** Alternate total ladder (Over/Under pairs). */
export function altTotal(ctx: Ctx, id: string, name: string, o: MkOpts, total: number, sigma: number, from: number, to: number, step: number, grading: Omit<Grading, 'side' | 'line'>, vigFn = (p: number) => 0.04 + 0.05 * Math.abs(p - 0.5) * 2): Market {
  const m = mkm(ctx, id, name, { kind: 'alt_total', layout: 'grid', ...o })
  for (let k = from; k <= to; k += step) {
    const t = toHalfLine(total + k)
    if (t <= 0.5) continue
    const pOver = Math.min(0.995, Math.max(0.005, 1 - normCdf((t - total) / sigma)))
    add(m, `over|${t}`, `Over (${fmtLine(t)})`, priceFromProb(pOver, vigFn(pOver)), { ...grading, side: 'over', line: t } as Grading, { line: t })
    add(m, `under|${t}`, `Under (${fmtLine(t)})`, priceFromProb(1 - pOver, vigFn(1 - pOver)), { ...grading, side: 'under', line: t } as Grading, { line: t })
  }
  return m
}

/** Three-way winner (home / tie / away) for a period or 60-minute line. */
export function threeWay(ctx: Ctx, id: string, name: string, o: MkOpts, pHome: number, pTie: number, vig: number, grading: Omit<Grading, 'side' | 'teamId'>, tieLabel = 'Tie'): Market {
  const { ev } = ctx
  const m = mkm(ctx, id, name, { kind: 'period_ml', layout: 'three-col', ...o })
  const pAway = Math.max(0.01, 1 - pHome - pTie)
  add(m, 'away', ev.away.team.displayName, priceFromProb(pAway, vig), { ...grading, side: 'away', teamId: ev.away.team.id } as Grading, { teamId: ev.away.team.id })
  add(m, 'draw', tieLabel, priceFromProb(pTie, vig), { ...grading, side: 'draw' } as Grading)
  add(m, 'home', ev.home.team.displayName, priceFromProb(pHome, vig), { ...grading, side: 'home', teamId: ev.home.team.id } as Grading, { teamId: ev.home.team.id })
  return m
}

/** Two-way team market (home/away) from home probability. */
export function twoTeam(ctx: Ctx, id: string, name: string, o: MkOpts, pHome: number, vig: number, grading: Omit<Grading, 'side' | 'teamId'>, labels?: [string, string]): Market {
  const { ev } = ctx
  const m = mkm(ctx, id, name, { kind: 'moneyline', layout: 'two-col', ...o })
  const [h, a] = twoWay(pHome, vig)
  add(m, 'away', labels?.[0] ?? ev.away.team.displayName, a, { ...grading, side: 'away', teamId: ev.away.team.id } as Grading, { teamId: ev.away.team.id })
  add(m, 'home', labels?.[1] ?? ev.home.team.displayName, h, { ...grading, side: 'home', teamId: ev.home.team.id } as Grading, { teamId: ev.home.team.id })
  return m
}

/* ----------------------------- player pools ----------------------------- */

export interface PlayerLine {
  id: string
  name: string
  teamId?: string
  position?: string
  headshot?: string
  line: number
}

/** Player lines for an ESPN prop type (real) with athlete resolution. */
export function espnLines(ctx: Ctx, match: RegExp): PlayerLine[] {
  const out: PlayerLine[] = []
  const seen = new Set<string>()
  for (const r of ctx.raw) {
    if (!r.athleteId || r.line === undefined || !match.test(r.typeName)) continue
    if (seen.has(r.athleteId)) continue
    const a = ctx.athletes[r.athleteId]
    if (!a) continue
    // ESPN's feed occasionally lists a player from another team; keep only the two rosters
    if (a.teamId && a.teamId !== ctx.ev.home.team.id && a.teamId !== ctx.ev.away.team.id) continue
    seen.add(r.athleteId)
    out.push({ id: a.id, name: a.name, teamId: a.teamId, position: a.position, headshot: a.headshot, line: r.line })
  }
  return out.sort((x, y) => y.line - x.line)
}

/** Player lines from ESPN team leaders. Season-total categories are divided by games played unless `perGame` is set. */
export function leaderLines(ctx: Ctx, category: string, take: number, toLine: (perGame: number, rank: number) => number, perGame = false): PlayerLine[] {
  const out: PlayerLine[] = []
  const fallbackGp = { baseball: 150, hockey: 70, soccer: 12, football: 3, basketball: 40 }[ctx.league.sport] ?? 10
  for (const tl of ctx.leaders) {
    const gp = perGame ? 1 : Math.max(1, tl.gamesPlayed ?? fallbackGp)
    ;(tl.categories[category] ?? []).slice(0, take).forEach((l, i) => {
      const a = ctx.athletes[l.athleteId]
      if (!a) return
      out.push({ id: a.id, name: a.name, teamId: a.teamId ?? tl.teamId, position: a.position, headshot: a.headshot, line: toLine(l.value / gp, i) })
    })
  }
  return out.sort((x, y) => y.line - x.line)
}

export function halfLine(x: number): number {
  return toHalfLine(x)
}

/** Integer-stat line placed at round(mean) - 0.5 with the over slightly favoured (FanDuel style). */
export function intLine(mean: number): number {
  return Math.max(0.5, Math.round(mean) - 0.5)
}

export function pOverInt(mean: number, sigma: number, line: number): number {
  return 1 - normCdf((line - mean) / sigma)
}

export function teamOf(ctx: Ctx, teamId?: string): GameEvent['home'] | undefined {
  if (!teamId) return undefined
  return ctx.ev.home.team.id === teamId ? ctx.ev.home : ctx.ev.away.team.id === teamId ? ctx.ev.away : undefined
}

export function isHomeId(ctx: Ctx, teamId?: string): boolean {
  return teamId === ctx.ev.home.team.id
}
