import type { LeagueDef } from '@/data/sports'
import { formatLine, normCdf, priceFromProb, roundHalf, seededRandom, toHalfLine, normalizeAmerican } from './odds'
import type { GameEvent, GameLines, Grading, Market, Selection, Side } from './types'

/** Standard deviation of the final margin per sport (used to convert spreads to probabilities). */
export function marginSigma(league: LeagueDef): number {
  switch (league.id) {
    case 'nfl': return 13.5
    case 'ncaaf': return 16
    case 'cfl': case 'ufl': return 14
    case 'nba': return 12
    case 'wnba': return 11
    case 'ncaab': return 11
    case 'ncaaw': return 12
    case 'mlb': return 3.9
    case 'nhl': return 2.3
  }
  if (league.sport === 'soccer') return 1.6
  if (league.sport === 'basketball') return 12
  if (league.sport === 'football') return 14
  return 1.5
}

/** Std dev of total points per sport. */
export function totalSigma(league: LeagueDef): number {
  switch (league.sport) {
    case 'football': return league.id === 'ncaaf' ? 16 : 13
    case 'basketball': return league.id === 'ncaab' ? 15 : 18
    case 'hockey': return 2.1
    case 'baseball': return 3.6
    case 'soccer': return 1.5
  }
  return 2
}

export function regulationPeriods(league: LeagueDef): number {
  switch (league.periods) {
    case 'quarters': return 4
    case 'halves': return 2
    case 'periods': return 3
    case 'innings': return 9
    default: return 1
  }
}

/** Turn a base juice (e.g. -110) plus a signed delta into a valid american price. */
export function juice(base: number, delta: number): number {
  let v = base - delta
  if (v > -100 && v < 100) v = v >= 0 ? 100 + v : 100 - (v + 100) // -98 -> +102
  return normalizeAmerican(Math.round(v))
}

export function pairJuice(rnd: () => number, base = -110, spread = 12): [number, number] {
  const d = Math.round((rnd() - 0.5) * spread)
  return [juice(base, d), juice(base, -d)]
}

function pHomeFromSpread(spread: number, sigma: number): number {
  return normCdf(-spread / sigma)
}

/** Synthesize a full set of pregame lines for an event with no real lines. Deterministic per event. */
export function synthesizeLines(ev: GameEvent, league: LeagueDef): GameLines {
  const rnd = seededRandom(`lines:${ev.id}:${ev.home.team.id}:${ev.away.team.id}`)
  const sigma = marginSigma(league)
  const out: GameLines = { provider: 'FakeDuel', synthesized: true }
  const sport = league.sport
  let spread = 0
  let total = 0
  if (sport === 'football') {
    spread = roundHalf((rnd() - 0.5) * 2 * (league.id === 'ncaaf' ? 17 : 9) - 1.5)
    total = toHalfLine((league.id === 'ncaaf' ? 55 : 44.5) + (rnd() - 0.5) * 12)
  } else if (sport === 'basketball') {
    const base = league.id === 'nba' ? 228 : league.id === 'wnba' ? 163 : league.id === 'ncaab' ? 146 : 132
    spread = roundHalf((rnd() - 0.5) * 2 * 11 - 2.5)
    total = toHalfLine(base + (rnd() - 0.5) * 16)
  } else if (sport === 'hockey') {
    const p = 0.36 + rnd() * 0.28
    spread = p >= 0.5 ? -1.5 : 1.5
    total = [5.5, 6, 6, 6.5][Math.floor(rnd() * 4)]
    out.homeML = priceFromProb(p, 0.04)
    out.awayML = priceFromProb(1 - p, 0.04)
    const pCover = spread < 0 ? p * 0.52 : 1 - (1 - p) * 0.52
    out.homeSpreadOdds = priceFromProb(pCover, 0.05)
    out.awaySpreadOdds = priceFromProb(1 - pCover, 0.05)
  } else if (sport === 'baseball') {
    const p = 0.36 + rnd() * 0.28
    spread = p >= 0.5 ? -1.5 : 1.5
    total = [7, 7.5, 8, 8.5, 8.5, 9, 9.5][Math.floor(rnd() * 7)]
    out.homeML = priceFromProb(p, 0.04)
    out.awayML = priceFromProb(1 - p, 0.04)
    const pCover = spread < 0 ? p * 0.56 : 1 - (1 - p) * 0.56
    out.homeSpreadOdds = priceFromProb(pCover, 0.05)
    out.awaySpreadOdds = priceFromProb(1 - pCover, 0.05)
  } else if (sport === 'soccer') {
    const p = 0.28 + rnd() * 0.36
    const pDraw = 0.27 - 0.2 * Math.abs(p - 0.5)
    const pAway = Math.max(0.08, 1 - p - pDraw)
    const sum = p + pDraw + pAway
    out.homeML = priceFromProb(p / sum, 0.055)
    out.drawML = priceFromProb(pDraw / sum, 0.055)
    out.awayML = priceFromProb(pAway / sum, 0.055)
    spread = p > 0.55 ? -0.5 : p < 0.45 ? 0.5 : 0
    total = [2.5, 2.5, 2.5, 3.5][Math.floor(rnd() * 4)]
    const pCover = spread < 0 ? p / sum : spread > 0 ? 1 - (pAway / sum) : p / sum + (pDraw / sum) * 0.5
    out.homeSpreadOdds = priceFromProb(pCover, 0.05)
    out.awaySpreadOdds = priceFromProb(1 - pCover, 0.05)
  } else {
    // two-competitor athlete events (UFC, tennis, golf match-ups, racing head-to-heads)
    const p = 0.25 + rnd() * 0.5
    out.homeML = priceFromProb(p, 0.045)
    out.awayML = priceFromProb(1 - p, 0.045)
    return out
  }
  out.spread = spread
  out.total = total
  if (out.homeML === undefined) {
    const p = pHomeFromSpread(spread, sigma)
    out.homeML = priceFromProb(p, 0.04)
    out.awayML = priceFromProb(1 - p, 0.04)
  }
  if (out.homeSpreadOdds === undefined) {
    const [h, a] = pairJuice(rnd)
    out.homeSpreadOdds = h
    out.awaySpreadOdds = a
  }
  const [o, u] = pairJuice(rnd)
  out.overOdds = o
  out.underOdds = u
  return out
}

/** Real lines with gaps filled from a deterministic synthesized set. */
export function resolveLines(ev: GameEvent, league: LeagueDef): GameLines {
  const synth = synthesizeLines(ev, league)
  const real = ev.lines
  if (!real) return synth
  const out: GameLines = { ...synth, ...stripUndefined(real), synthesized: false }
  const sigma = marginSigma(league)
  if (out.spread !== undefined && (real.homeML === undefined || real.awayML === undefined) && league.sport !== 'soccer') {
    const p = pHomeFromSpread(out.spread, sigma)
    out.homeML = real.homeML ?? priceFromProb(p, 0.04)
    out.awayML = real.awayML ?? priceFromProb(1 - p, 0.04)
  }
  if (real.spread !== undefined && (real.homeSpreadOdds === undefined || real.awaySpreadOdds === undefined)) {
    out.homeSpreadOdds = real.homeSpreadOdds ?? -110
    out.awaySpreadOdds = real.awaySpreadOdds ?? -110
  }
  if (real.total !== undefined && (real.overOdds === undefined || real.underOdds === undefined)) {
    out.overOdds = real.overOdds ?? -110
    out.underOdds = real.underOdds ?? -110
  }
  if (league.sport === 'soccer' && real.drawML === undefined && real.homeML !== undefined) out.drawML = synth.drawML
  return out
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  const out: Partial<T> = {}
  for (const k of Object.keys(o) as (keyof T)[]) if (o[k] !== undefined) out[k] = o[k]
  return out
}

/* ----------------------------- market builders ----------------------------- */

export function spreadLabel(league: LeagueDef): string {
  if (league.sport === 'hockey') return 'Puck Line'
  if (league.sport === 'baseball') return 'Run Line'
  return 'Spread'
}

export function totalLabel(league: LeagueDef): string {
  if (league.sport === 'hockey' || league.sport === 'soccer') return 'Total Goals'
  if (league.sport === 'baseball') return 'Total Runs'
  return 'Total Points'
}

export function sel(market: Market, suffix: string, label: string, odds: number, grading: Grading, extra: Partial<Selection> = {}): Selection {
  return {
    id: `${market.id}|${suffix}`,
    marketId: market.id,
    eventId: market.eventId,
    leagueId: market.leagueId,
    label,
    odds,
    grading,
    ...extra,
  }
}

export function mkMarket(ev: GameEvent, id: string, name: string, group: Market['group'], kind: Market['kind'], layout: Market['layout'], extra: Partial<Market> = {}): Market {
  return { id: `${ev.id}|${id}`, eventId: ev.id, leagueId: ev.leagueId, name, group, kind, selections: [], sgp: true, layout, ...extra }
}

export function buildGameMarkets(ev: GameEvent, league: LeagueDef, lines: GameLines): { spread?: Market; moneyline?: Market; total?: Market; threeWay?: Market; dnb?: Market } {
  const out: { spread?: Market; moneyline?: Market; total?: Market; threeWay?: Market; dnb?: Market } = {}
  const home = ev.home.team
  const away = ev.away.team
  if (lines.spread !== undefined && lines.homeSpreadOdds !== undefined && lines.awaySpreadOdds !== undefined && !league.athleteEvent) {
    const m = mkMarket(ev, 'spread', spreadLabel(league), 'game', 'spread', 'two-col', { line: lines.spread, sortOrder: 1 })
    m.selections = [
      sel(m, 'away', `${away.displayName} ${formatLine(-lines.spread)}`, lines.awaySpreadOdds, { kind: 'spread', side: 'away', teamId: away.id, line: -lines.spread }, { line: -lines.spread, teamId: away.id }),
      sel(m, 'home', `${home.displayName} ${formatLine(lines.spread)}`, lines.homeSpreadOdds, { kind: 'spread', side: 'home', teamId: home.id, line: lines.spread }, { line: lines.spread, teamId: home.id }),
    ]
    out.spread = m
  }
  if (lines.homeML !== undefined && lines.awayML !== undefined) {
    if (league.hasDraw && lines.drawML !== undefined) {
      const m = mkMarket(ev, '3way', 'Moneyline', 'game', 'three_way', 'three-col', { sortOrder: 2 })
      m.selections = [
        sel(m, 'away', away.displayName, lines.awayML, { kind: 'moneyline', side: 'away', teamId: away.id }, { teamId: away.id }),
        sel(m, 'draw', 'Draw', lines.drawML, { kind: 'draw', side: 'draw' }),
        sel(m, 'home', home.displayName, lines.homeML, { kind: 'moneyline', side: 'home', teamId: home.id }, { teamId: home.id }),
      ]
      out.threeWay = m
      const dnb = mkMarket(ev, 'dnb', 'Draw No Bet', 'game', 'draw_no_bet', 'two-col', { sortOrder: 3 })
      const pH = 1 / (1 + 100 / Math.abs(lines.homeML)) // rough
      const pA = 1 / (1 + 100 / Math.abs(lines.awayML))
      const ph = lines.homeML > 0 ? 100 / (lines.homeML + 100) : pH
      const pa = lines.awayML > 0 ? 100 / (lines.awayML + 100) : pA
      const s = ph + pa
      dnb.selections = [
        sel(dnb, 'away', away.displayName, priceFromProb(pa / s, 0.045), { kind: 'draw_no_bet', side: 'away', teamId: away.id }, { teamId: away.id }),
        sel(dnb, 'home', home.displayName, priceFromProb(ph / s, 0.045), { kind: 'draw_no_bet', side: 'home', teamId: home.id }, { teamId: home.id }),
      ]
      out.dnb = dnb
    } else {
      const m = mkMarket(ev, 'ml', 'Moneyline', 'game', 'moneyline', 'two-col', { sortOrder: 2 })
      m.selections = [
        sel(m, 'away', away.displayName, lines.awayML, { kind: 'moneyline', side: 'away', teamId: away.id }, { teamId: away.id }),
        sel(m, 'home', home.displayName, lines.homeML, { kind: 'moneyline', side: 'home', teamId: home.id }, { teamId: home.id }),
      ]
      out.moneyline = m
    }
  }
  if (lines.total !== undefined && lines.overOdds !== undefined && lines.underOdds !== undefined && !league.athleteEvent) {
    const m = mkMarket(ev, 'total', totalLabel(league), 'game', 'total', 'two-col', { line: lines.total, sortOrder: 3 })
    m.selections = [
      sel(m, 'over', `Over ${lines.total}`, lines.overOdds, { kind: 'total', side: 'over', line: lines.total }, { line: lines.total }),
      sel(m, 'under', `Under ${lines.total}`, lines.underOdds, { kind: 'total', side: 'under', line: lines.total }, { line: lines.total }),
    ]
    out.total = m
  }
  return out
}

/** Alternate spreads / totals as ladders priced from the normal model. */
export function buildAltMarkets(ev: GameEvent, league: LeagueDef, lines: GameLines): Market[] {
  if (lines.spread === undefined || lines.total === undefined || league.athleteEvent) return []
  const out: Market[] = []
  const sigma = marginSigma(league)
  const tsig = totalSigma(league)
  const home = ev.home.team
  const away = ev.away.team
  const step = league.sport === 'hockey' || league.sport === 'baseball' || league.sport === 'soccer' ? 1 : league.sport === 'basketball' ? 2 : 1.5
  const n = league.sport === 'hockey' || league.sport === 'baseball' || league.sport === 'soccer' ? 2 : 6
  const alt = mkMarket(ev, 'altspread', `Alternate ${spreadLabel(league)}`, 'alt', 'alt_spread', 'grid', { sortOrder: 40 })
  for (let i = -n; i <= n; i++) {
    if (i === 0) continue
    const hs = toHalfLine(lines.spread + i * step)
    const pHome = normCdf(-hs / sigma)
    const pH = pHome
    const pA = 1 - pHome
    alt.selections.push(
      sel(alt, `away|${-hs}`, `${away.displayName} ${formatLine(-hs)}`, priceFromProb(pA, 0.045), { kind: 'spread', side: 'away', teamId: away.id, line: -hs }, { line: -hs, teamId: away.id }),
      sel(alt, `home|${hs}`, `${home.displayName} ${formatLine(hs)}`, priceFromProb(pH, 0.045), { kind: 'spread', side: 'home', teamId: home.id, line: hs }, { line: hs, teamId: home.id }),
    )
  }
  out.push(alt)
  const altT = mkMarket(ev, 'alttotal', `Alternate ${totalLabel(league)}`, 'alt', 'alt_total', 'grid', { sortOrder: 41 })
  const tstep = league.sport === 'hockey' || league.sport === 'soccer' ? 1 : league.sport === 'baseball' ? 1 : league.sport === 'basketball' ? 3 : 2.5
  for (let i = -n; i <= n; i++) {
    if (i === 0) continue
    const t = toHalfLine(lines.total + i * tstep)
    if (t <= 0.5) continue
    const pOver = 1 - normCdf((t - lines.total) / tsig)
    altT.selections.push(
      sel(altT, `over|${t}`, `Over ${t}`, priceFromProb(pOver, 0.045), { kind: 'total', side: 'over', line: t }, { line: t }),
      sel(altT, `under|${t}`, `Under ${t}`, priceFromProb(1 - pOver, 0.045), { kind: 'total', side: 'under', line: t }, { line: t }),
    )
  }
  out.push(altT)
  return out
}

/** Team totals for both teams. */
export function buildTeamTotals(ev: GameEvent, league: LeagueDef, lines: GameLines, override?: Record<string, number>): Market[] {
  if (lines.total === undefined || lines.spread === undefined || league.athleteEvent) return []
  const rnd = seededRandom(`tt:${ev.id}`)
  const out: Market[] = []
  for (const c of [ev.away, ev.home]) {
    const isHome = c.homeAway === 'home'
    const exp = (lines.total + (isHome ? -lines.spread : lines.spread)) / 2
    const line = override?.[c.team.id] ?? toHalfLine(exp)
    const m = mkMarket(ev, `tt|${c.team.id}`, `${c.team.abbreviation} ${c.team.name} Total ${league.sport === 'hockey' || league.sport === 'soccer' ? 'Goals' : league.sport === 'baseball' ? 'Runs' : 'Points'}`, 'team', 'team_total', 'two-col', { line, sortOrder: 30 })
    const [o, u] = pairJuice(rnd)
    m.selections = [
      sel(m, 'over', `Over ${line}`, o, { kind: 'team_total', side: 'over', teamId: c.team.id, line }, { line, teamId: c.team.id }),
      sel(m, 'under', `Under ${line}`, u, { kind: 'team_total', side: 'under', teamId: c.team.id, line }, { line, teamId: c.team.id }),
    ]
    out.push(m)
  }
  return out
}

export interface PeriodDef {
  key: string
  name: string
  fraction: number
  periods: number[]
}

export function periodDefs(league: LeagueDef): PeriodDef[] {
  switch (league.periods) {
    case 'quarters':
      return [
        { key: 'h1', name: '1st Half', fraction: 0.5, periods: [1, 2] },
        { key: 'q1', name: '1st Quarter', fraction: 0.25, periods: [1] },
        { key: 'q2', name: '2nd Quarter', fraction: 0.25, periods: [2] },
        { key: 'h2', name: '2nd Half', fraction: 0.5, periods: [3, 4] },
        { key: 'q3', name: '3rd Quarter', fraction: 0.25, periods: [3] },
        { key: 'q4', name: '4th Quarter', fraction: 0.25, periods: [4] },
      ]
    case 'halves':
      return [
        { key: 'h1', name: '1st Half', fraction: 0.5, periods: [1] },
        { key: 'h2', name: '2nd Half', fraction: 0.5, periods: [2] },
      ]
    case 'periods':
      return [
        { key: 'p1', name: '1st Period', fraction: 1 / 3, periods: [1] },
        { key: 'p2', name: '2nd Period', fraction: 1 / 3, periods: [2] },
        { key: 'p3', name: '3rd Period', fraction: 1 / 3, periods: [3] },
      ]
    case 'innings':
      return [
        { key: 'i1', name: '1st Inning', fraction: 1 / 9, periods: [1] },
        { key: 'f5', name: '1st 5 Innings', fraction: 5 / 9, periods: [1, 2, 3, 4, 5] },
      ]
    default:
      return []
  }
}

/** Period lines (halves/quarters/periods) derived from the game lines or supplied real lines. */
export function buildPeriodMarkets(ev: GameEvent, league: LeagueDef, lines: GameLines, real?: { spread?: Record<string, number>; total?: Record<string, number> }): Market[] {
  if (lines.spread === undefined || lines.total === undefined || league.athleteEvent) return []
  const out: Market[] = []
  const rnd = seededRandom(`per:${ev.id}`)
  const sigma = marginSigma(league)
  const home = ev.home.team
  const away = ev.away.team
  let order = 50
  for (const p of periodDefs(league)) {
    const spread = real?.spread?.[p.key] ?? roundHalf(lines.spread * p.fraction)
    const psig = sigma * Math.sqrt(p.fraction)
    const total = real?.total?.[p.key] ?? toHalfLine(lines.total * p.fraction - (p.fraction < 0.4 ? 0.5 : 0))
    const pHome = normCdf(-spread / psig)
    const isFootballOrHoops = league.sport === 'football' || league.sport === 'basketball'
    // Winner (3-way for periods in football/basketball since ties are common; 2-way otherwise)
    if (isFootballOrHoops || league.sport === 'hockey' || league.sport === 'soccer') {
      const pTie = league.sport === 'soccer' || league.sport === 'hockey' ? 0.3 : p.fraction <= 0.25 ? 0.13 : 0.06
      const ph = pHome * (1 - pTie)
      const pa = (1 - pHome) * (1 - pTie)
      const m = mkMarket(ev, `pw|${p.key}`, `${p.name} Winner (3-Way)`, 'periods', 'period_ml', 'three-col', { sortOrder: order++, category: p.name })
      m.selections = [
        sel(m, 'away', away.displayName, priceFromProb(pa, 0.05), { kind: 'period_ml', side: 'away', teamId: away.id, period: p.key }, { teamId: away.id }),
        sel(m, 'draw', 'Tie', priceFromProb(pTie, 0.05), { kind: 'period_ml', side: 'draw', period: p.key }),
        sel(m, 'home', home.displayName, priceFromProb(ph, 0.05), { kind: 'period_ml', side: 'home', teamId: home.id, period: p.key }, { teamId: home.id }),
      ]
      out.push(m)
    } else {
      const m = mkMarket(ev, `pw|${p.key}`, `${p.name} Moneyline`, 'periods', 'period_ml', 'two-col', { sortOrder: order++, category: p.name })
      m.selections = [
        sel(m, 'away', away.displayName, priceFromProb(1 - pHome, 0.045), { kind: 'period_ml', side: 'away', teamId: away.id, period: p.key }, { teamId: away.id }),
        sel(m, 'home', home.displayName, priceFromProb(pHome, 0.045), { kind: 'period_ml', side: 'home', teamId: home.id, period: p.key }, { teamId: home.id }),
      ]
      out.push(m)
    }
    if (league.sport !== 'baseball' || p.key === 'f5') {
      const ms = mkMarket(ev, `ps|${p.key}`, `${p.name} ${spreadLabel(league)}`, 'periods', 'period_spread', 'two-col', { sortOrder: order++, line: spread, category: p.name })
      const [hj, aj] = pairJuice(rnd)
      ms.selections = [
        sel(ms, 'away', `${away.displayName} ${formatLine(-spread)}`, aj, { kind: 'period_spread', side: 'away', teamId: away.id, line: -spread, period: p.key }, { line: -spread, teamId: away.id }),
        sel(ms, 'home', `${home.displayName} ${formatLine(spread)}`, hj, { kind: 'period_spread', side: 'home', teamId: home.id, line: spread, period: p.key }, { line: spread, teamId: home.id }),
      ]
      out.push(ms)
    }
    const mt = mkMarket(ev, `pt|${p.key}`, `${p.name} Total`, 'periods', 'period_total', 'two-col', { sortOrder: order++, line: total, category: p.name })
    const [oj, uj] = pairJuice(rnd)
    mt.selections = [
      sel(mt, 'over', `Over ${total}`, oj, { kind: 'period_total', side: 'over', line: total, period: p.key }, { line: total }),
      sel(mt, 'under', `Under ${total}`, uj, { kind: 'period_total', side: 'under', line: total, period: p.key }, { line: total }),
    ]
    out.push(mt)
  }
  return out
}

/** Game specials: overtime, both teams to score, winning margin buckets. */
export function buildSpecials(ev: GameEvent, league: LeagueDef, lines: GameLines): Market[] {
  if (league.athleteEvent) return []
  const out: Market[] = []
  const rnd = seededRandom(`spec:${ev.id}`)
  if (league.sport === 'football' || league.sport === 'basketball' || league.sport === 'hockey') {
    const pOT = league.sport === 'hockey' ? 0.23 : league.sport === 'football' ? 0.06 : 0.065
    const m = mkMarket(ev, 'ot', 'Will There Be Overtime?', 'specials', 'overtime', 'two-col', { sortOrder: 90 })
    m.selections = [
      sel(m, 'yes', 'Yes', priceFromProb(pOT, 0.08), { kind: 'overtime', side: 'yes' }),
      sel(m, 'no', 'No', priceFromProb(1 - pOT, 0.08), { kind: 'overtime', side: 'no' }),
    ]
    out.push(m)
  }
  if (league.sport === 'soccer' || league.sport === 'hockey') {
    const p = league.sport === 'soccer' ? 0.5 + (rnd() - 0.5) * 0.14 : 0.86
    const m = mkMarket(ev, 'btts', 'Both Teams To Score', 'specials', 'btts', 'two-col', { sortOrder: 91 })
    m.selections = [
      sel(m, 'yes', 'Yes', priceFromProb(p, 0.06), { kind: 'btts', side: 'yes' }),
      sel(m, 'no', 'No', priceFromProb(1 - p, 0.06), { kind: 'btts', side: 'no' }),
    ]
    out.push(m)
  }
  if ((league.sport === 'football' || league.sport === 'basketball') && lines.spread !== undefined) {
    const sigma = marginSigma(league)
    const buckets: [number, number][] = league.sport === 'football' ? [[1, 6], [7, 12], [13, 18], [19, 24], [25, 99]] : [[1, 5], [6, 10], [11, 15], [16, 20], [21, 99]]
    const m = mkMarket(ev, 'margin', 'Winning Margin', 'specials', 'winning_margin', 'grid', { sortOrder: 92 })
    for (const c of [ev.away, ev.home]) {
      const isHome = c.homeAway === 'home'
      const exp = isHome ? -lines.spread : lines.spread
      for (const [lo, hi] of buckets) {
        const pr = normCdf((Math.min(hi, 60) + 0.5 - exp) / sigma) - normCdf((lo - 0.5 - exp) / sigma)
        const label = `${c.team.shortDisplayName} by ${hi >= 99 ? `${lo}+` : `${lo}-${hi}`}`
        m.selections.push(sel(m, `${c.team.id}|${lo}`, label, priceFromProb(Math.max(0.005, pr), 0.12), { kind: 'winning_margin', teamId: c.team.id, rangeLow: lo, rangeHigh: hi }, { teamId: c.team.id }))
      }
    }
    out.push(m)
  }
  return out
}

export function sideOf(sel: Selection): Side | undefined {
  return sel.grading.side
}
