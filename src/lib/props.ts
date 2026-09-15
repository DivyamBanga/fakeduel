import type { LeagueDef } from '@/data/sports'
import type { RawPropBet } from './espn'
import { mkMarket, sel, juice, pairJuice } from './markets'
import { normCdf, priceFromProb, seededRandom, toHalfLine } from './odds'
import type { AthleteInfo, GameEvent, GameLines, Market } from './types'

export interface TeamLeaders {
  teamId: string
  categories: Record<string, { athleteId: string; value: number; displayValue: string }[]>
  gamesPlayed?: number
}

export interface PropsContext {
  ev: GameEvent
  league: LeagueDef
  lines: GameLines
  raw: RawPropBet[]
  athletes: Record<string, AthleteInfo>
  leaders: TeamLeaders[]
  probables?: { teamId: string; athleteId: string; name: string }[]
}

interface StatDef {
  key: string
  statKey: string
  name: string
  short: string
  category: string
  sigma: (line: number) => number
  base: number
  ladderStep?: number
  ladderCount?: number
  integer?: boolean
  positions?: string[]
  order: number
}

const F = (key: string, statKey: string, name: string, short: string, category: string, sigma: (l: number) => number, base: number, order: number, extra: Partial<StatDef> = {}): StatDef => ({ key, statKey, name, short, category, sigma, base, order, ...extra })

export const FOOTBALL_STATS: StatDef[] = [
  F('pass_yds', 'passing.passingYards', 'Passing Yds', 'PASS YDS', 'Passing Props', (l) => Math.max(40, 0.27 * l), -114, 1, { ladderStep: 25, ladderCount: 4 }),
  F('pass_tds', 'passing.passingTouchdowns', 'Passing TDs', 'PASS TDS', 'Passing Props', () => 1.05, -115, 2, { ladderStep: 1, ladderCount: 3, integer: true }),
  F('completions', 'passing.completions/passingAttempts#0', 'Pass Completions', 'COMPLETIONS', 'Passing Props', (l) => Math.max(3, 0.2 * l), -114, 3, { ladderStep: 3, ladderCount: 3, integer: true }),
  F('pass_att', 'passing.completions/passingAttempts#1', 'Pass Attempts', 'PASS ATT', 'Passing Props', (l) => Math.max(4, 0.2 * l), -114, 4, { integer: true }),
  F('ints', 'passing.interceptions', 'Interceptions Thrown', 'INT', 'Passing Props', () => 0.85, -120, 5, { integer: true }),
  F('longest_comp', 'passing.longPassing', 'Longest Completion', 'LONGEST COMP', 'Passing Props', (l) => Math.max(8, 0.35 * l), -114, 6),
  F('pass_rush_yds', 'passing.passingYards+rushing.rushingYards', 'Passing + Rushing Yds', 'PASS + RUSH YDS', 'Passing Props', (l) => Math.max(45, 0.27 * l), -114, 7, { ladderStep: 25, ladderCount: 3 }),
  F('rush_yds', 'rushing.rushingYards', 'Rushing Yds', 'RUSH YDS', 'Rushing Props', (l) => Math.max(14, 0.5 * l), -114, 10, { ladderStep: 10, ladderCount: 4 }),
  F('carries', 'rushing.rushingAttempts', 'Rushing Attempts', 'CARRIES', 'Rushing Props', (l) => Math.max(3, 0.3 * l), -114, 11, { ladderStep: 2, ladderCount: 3, integer: true }),
  F('longest_rush', 'rushing.longRushing', 'Longest Rush', 'LONGEST RUSH', 'Rushing Props', (l) => Math.max(5, 0.45 * l), -114, 12),
  F('rush_rec_yds', 'rushing.rushingYards+receiving.receivingYards', 'Rushing + Receiving Yds', 'RUSH + REC YDS', 'Rushing Props', (l) => Math.max(16, 0.45 * l), -114, 13, { ladderStep: 10, ladderCount: 4 }),
  F('rec_yds', 'receiving.receivingYards', 'Receiving Yds', 'REC YDS', 'Receiving Props', (l) => Math.max(12, 0.55 * l), -114, 20, { ladderStep: 10, ladderCount: 5 }),
  F('receptions', 'receiving.receptions', 'Total Receptions', 'RECEPTIONS', 'Receiving Props', (l) => Math.max(1.4, 0.4 * l), -115, 21, { ladderStep: 1, ladderCount: 4, integer: true }),
  F('longest_rec', 'receiving.longReception', 'Longest Reception', 'LONGEST REC', 'Receiving Props', (l) => Math.max(6, 0.4 * l), -114, 22),
  F('pass_rush_rec_yds', 'passing.passingYards+rushing.rushingYards+receiving.receivingYards', 'Pass + Rush + Rec Yds', 'TOTAL YDS', 'Passing Props', (l) => Math.max(45, 0.27 * l), -114, 8, { ladderStep: 25, ladderCount: 3 }),
  F('kick_pts', 'kicking.totalKickingPoints', 'Kicking Points', 'KICKING PTS', 'Scoring', (l) => Math.max(3, 0.45 * l), -114, 30, { integer: true }),
  F('fg_made', 'kicking.fieldGoalsMade/fieldGoalAttempts#0', 'Field Goals Made', 'FG MADE', 'Scoring', () => 1.0, -120, 31, { integer: true }),
  F('xp_made', 'kicking.extraPointsMade/extraPointAttempts#0', 'Extra Points Made', 'XP MADE', 'Scoring', () => 1.1, -120, 32, { integer: true }),
  F('tackles', 'defensive.totalTackles', 'Tackles + Assists', 'TACKLES', 'D/ST', (l) => Math.max(2, 0.35 * l), -114, 40, { integer: true }),
  F('sacks', 'defensive.sacks', 'Sacks', 'SACKS', 'D/ST', () => 0.7, -130, 41),
]

export const BASKETBALL_STATS: StatDef[] = [
  F('points', '*.points', 'Points', 'PTS', 'Player Points', (l) => Math.max(4, 0.32 * l), -114, 1, { ladderStep: 5, ladderCount: 4, integer: true }),
  F('rebounds', '*.rebounds', 'Rebounds', 'REB', 'Player Rebounds', (l) => Math.max(2.2, 0.38 * l), -114, 2, { ladderStep: 2, ladderCount: 3, integer: true }),
  F('assists', '*.assists', 'Assists', 'AST', 'Player Assists', (l) => Math.max(1.8, 0.4 * l), -114, 3, { ladderStep: 2, ladderCount: 3, integer: true }),
  F('threes', '*.threePointFieldGoalsMade-threePointFieldGoalsAttempted#0', 'Made Threes', '3PM', 'Player Threes', (l) => Math.max(1.1, 0.45 * l), -118, 4, { ladderStep: 1, ladderCount: 3, integer: true }),
  F('pra', '*.points+*.rebounds+*.assists', 'Pts + Reb + Ast', 'PRA', 'Player Combos', (l) => Math.max(5, 0.28 * l), -114, 5, { ladderStep: 5, ladderCount: 3, integer: true }),
  F('pr', '*.points+*.rebounds', 'Pts + Reb', 'P+R', 'Player Combos', (l) => Math.max(4.5, 0.3 * l), -114, 6, { integer: true }),
  F('pa', '*.points+*.assists', 'Pts + Ast', 'P+A', 'Player Combos', (l) => Math.max(4.5, 0.3 * l), -114, 7, { integer: true }),
  F('ra', '*.rebounds+*.assists', 'Reb + Ast', 'R+A', 'Player Combos', (l) => Math.max(3, 0.35 * l), -114, 7.5, { integer: true }),
  F('steals', '*.steals', 'Steals', 'STL', 'Player Defense', () => 0.9, -120, 8, { integer: true }),
  F('blocks', '*.blocks', 'Blocks', 'BLK', 'Player Defense', () => 0.9, -120, 9, { integer: true }),
  F('bs', '*.blocks+*.steals', 'Blocks + Steals', 'BLK+STL', 'Player Defense', () => 1.2, -120, 9.5, { integer: true }),
  F('turnovers', '*.turnovers', 'Turnovers', 'TO', 'Player Defense', () => 1.3, -120, 9.7, { integer: true }),
]

export const HOCKEY_STATS: StatDef[] = [
  F('shots', '*.shotsTotal', 'Shots On Goal', 'SOG', 'Player Shots', (l) => Math.max(1.3, 0.45 * l), -120, 1, { ladderStep: 1, ladderCount: 3, integer: true }),
  F('points', '*.points', 'Points', 'PTS', 'Player Points', () => 0.85, -125, 2, { integer: true }),
  F('assists', '*.assists', 'Assists', 'AST', 'Player Points', () => 0.7, -130, 3, { integer: true }),
  F('saves', '*.saves', 'Saves', 'SAVES', 'Goalie Saves', (l) => Math.max(4, 0.2 * l), -114, 4, { ladderStep: 3, ladderCount: 3, integer: true, positions: ['G'] }),
  F('goals', '*.goals', 'Goals', 'G', 'Player Points', () => 0.6, -130, 2.5, { integer: true }),
  F('blocked', '*.blockedShots', 'Blocked Shots', 'BLK', 'Player Shots', (l) => Math.max(1, 0.5 * l), -120, 1.5, { integer: true }),
  F('ppp', '*.powerPlayGoals+*.powerPlayAssists', 'Power Play Points', 'PPP', 'Player Points', () => 0.6, -130, 3.5, { integer: true }),
]

export const BASEBALL_STATS: StatDef[] = [
  F('hits', 'batting.hits', 'Hits', 'HITS', 'Batter Props', () => 0.9, -114, 1, { integer: true }),
  F('rbis', 'batting.RBIs', 'RBIs', 'RBI', 'Batter Props', () => 0.9, -114, 2, { integer: true }),
  F('runs', 'batting.runs', 'Runs Scored', 'RUNS', 'Batter Props', () => 0.8, -114, 3, { integer: true }),
  F('hr', 'batting.homeRuns', 'Home Runs', 'HR', 'Home Run Props', () => 0.45, -114, 4, { integer: true }),
  F('bat_k', 'batting.strikeouts', 'Batter Strikeouts', 'K', 'Batter Props', () => 0.9, -114, 5, { integer: true }),
  F('hrr', 'batting.hits+batting.runs+batting.RBIs', 'Hits + Runs + RBIs', 'H+R+RBI', 'Batter Props', () => 1.4, -114, 5.5, { integer: true }),
  F('walks', 'batting.walks', 'Walks', 'BB', 'Batter Props', () => 0.7, -120, 5.7, { integer: true }),
  F('p_k', 'pitching.strikeouts', 'Strikeouts', 'K', 'Pitcher Props', (l) => Math.max(1.8, 0.35 * l), -114, 10, { ladderStep: 1, ladderCount: 4, integer: true }),
  F('p_outs', 'pitching.outs', 'Outs Recorded', 'OUTS', 'Pitcher Props', () => 3.6, -114, 11, { integer: true }),
  F('p_er', 'pitching.earnedRuns', 'Earned Runs', 'ER', 'Pitcher Props', () => 1.6, -114, 12, { integer: true }),
  F('p_hits', 'pitching.hits', 'Hits Allowed', 'H', 'Pitcher Props', () => 2, -114, 13, { integer: true }),
  F('p_walks', 'pitching.walks', 'Walks Allowed', 'BB', 'Pitcher Props', () => 1.2, -114, 14, { integer: true }),
]

export const SOCCER_STATS: StatDef[] = [
  F('shots', '*.totalShots', 'Shots', 'SHOTS', 'Player Shots', (l) => Math.max(1.1, 0.5 * l), -120, 1, { integer: true }),
  F('sot', '*.shotsOnTarget', 'Shots On Target', 'SOT', 'Player Shots', () => 0.9, -120, 2, { integer: true }),
  F('assists', '*.goalAssists', 'Assists', 'AST', 'Player Points', () => 0.6, -130, 3, { integer: true }),
]

export function statDefsFor(league: LeagueDef): StatDef[] {
  switch (league.sport) {
    case 'football': return FOOTBALL_STATS
    case 'basketball': return BASKETBALL_STATS
    case 'hockey': return HOCKEY_STATS
    case 'baseball': return BASEBALL_STATS
    case 'soccer': return SOCCER_STATS
    default: return []
  }
}

/* --------------------------- ESPN prop type mapping --------------------------- */

const ESPN_TYPE_MAP: [RegExp, string][] = [
  [/^Total Passing Yards/i, 'pass_yds'],
  [/^Total Pass Completions/i, 'completions'],
  [/^Total Passing Touchdowns/i, 'pass_tds'],
  [/^Total Carries/i, 'carries'],
  [/^Total Rushing Yards/i, 'rush_yds'],
  [/^Total Receiving Yards/i, 'rec_yds'],
  [/^Total Receptions/i, 'receptions'],
  [/^Total Passing Interceptions/i, 'ints'],
  [/^Total Passing Attempts/i, 'pass_att'],
  [/^Longest Passing Completion/i, 'longest_comp'],
  [/^Total Passing Plus Rushing/i, 'pass_rush_yds'],
  [/^Longest Reception/i, 'longest_rec'],
  [/^Total Rushing Plus Receiving/i, 'rush_rec_yds'],
  [/^Longest Rush/i, 'longest_rush'],
  [/^Total Kicking Points/i, 'kick_pts'],
  [/^Total Extra Points Made/i, 'xp_made'],
  [/^Total Field Goals Made/i, 'fg_made'],
  [/^Total Points/i, 'points'],
  [/^Total Rebounds/i, 'rebounds'],
  [/^Total Assists/i, 'assists'],
  [/Three Pointers Made|3-Pointers Made|Total Threes/i, 'threes'],
  [/Points \+ Rebounds \+ Assists|Pts \+ Reb \+ Ast/i, 'pra'],
  [/^Total Steals/i, 'steals'],
  [/^Total Blocks/i, 'blocks'],
  [/^Total Shots On Goal|Shots on Goal/i, 'shots'],
  [/^Total Saves/i, 'saves'],
  [/^Total Hits\b/i, 'hits'],
  [/^Total RBIs|Runs Batted In/i, 'rbis'],
  [/^Total Runs Scored|^Runs Scored/i, 'runs'],
  [/^Total Home Runs/i, 'hr'],
  [/Pitcher Strikeouts|^Total Strikeouts \(Pitcher\)|Strikeouts Thrown/i, 'p_k'],
  [/Outs Recorded/i, 'p_outs'],
  [/Earned Runs Allowed/i, 'p_er'],
]

const SCORER_TYPES: [RegExp, { key: string; name: string; kind: 'td_scorer' | 'first_td' | 'last_td' | 'multi_td'; count?: number; period?: string; order: number }][] = [
  [/^First Touchdown Scorer$/i, { key: 'first_td', name: 'First Touchdown Scorer', kind: 'first_td', order: 2 }],
  [/^Last Touchdown Scorer$/i, { key: 'last_td', name: 'Last Touchdown Scorer', kind: 'last_td', order: 3 }],
  [/^Anytime Touchdown Scorer$/i, { key: 'any_td', name: 'Anytime Touchdown Scorer', kind: 'td_scorer', order: 1 }],
  [/2 or more touchdowns/i, { key: 'td2', name: 'To Score 2+ Touchdowns', kind: 'multi_td', count: 2, order: 4 }],
  [/3 or more touchdowns/i, { key: 'td3', name: 'To Score 3+ Touchdowns', kind: 'multi_td', count: 3, order: 5 }],
  [/^1st Half Touchdown Scorer/i, { key: 'h1_td', name: 'Anytime 1st Half TD Scorer', kind: 'td_scorer', period: 'h1', order: 6 }],
  [/^1st Quarter Touchdown Scorer/i, { key: 'q1_td', name: 'Anytime 1st Quarter TD Scorer', kind: 'td_scorer', period: 'q1', order: 7 }],
]

function mapEspnType(name: string): string | null {
  for (const [re, key] of ESPN_TYPE_MAP) if (re.test(name)) return key
  return null
}

/* --------------------------- pricing helpers --------------------------- */

function ouPair(rnd: () => number, base: number): [number, number] {
  return pairJuice(rnd, base, 14)
}

/** Probability that a normally distributed stat with mean `line` and sd `sigma` reaches `threshold`. */
function pReach(mean: number, sigma: number, threshold: number, integer: boolean): number {
  const t = integer ? threshold - 0.5 : threshold
  return 1 - normCdf((t - mean) / sigma)
}

function fmtLine(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

/* --------------------------- market construction --------------------------- */

function playerLabel(a: AthleteInfo | undefined, id: string): string {
  return a?.name ?? `Player ${id}`
}

function ouMarket(ctx: PropsContext, def: StatDef, athleteId: string, line: number, rnd: () => number, order: number): Market {
  const a = ctx.athletes[athleteId]
  const name = playerLabel(a, athleteId)
  const m = mkMarket(ctx.ev, `prop|${def.key}|${athleteId}`, `${name} - ${def.name}`, 'props', 'prop_ou', 'two-col', {
    playerId: athleteId,
    playerName: name,
    playerTeamId: a?.teamId,
    playerPosition: a?.position,
    headshot: a?.headshot,
    line,
    category: def.category,
    sortOrder: order,
  })
  const [o, u] = ouPair(rnd, def.base)
  m.selections = [
    sel(m, 'over', `Over ${fmtLine(line)}`, o, { kind: 'player_stat', side: 'over', statKey: def.statKey, playerId: athleteId, line }, { playerId: athleteId, line, teamId: a?.teamId, sub: `${name} - ${def.name}` }),
    sel(m, 'under', `Under ${fmtLine(line)}`, u, { kind: 'player_stat', side: 'under', statKey: def.statKey, playerId: athleteId, line }, { playerId: athleteId, line, teamId: a?.teamId, sub: `${name} - ${def.name}` }),
  ]
  return m
}

function ladderMarket(ctx: PropsContext, def: StatDef, athleteId: string, line: number, order: number): Market | null {
  if (!def.ladderStep || !def.ladderCount) return null
  const a = ctx.athletes[athleteId]
  const name = playerLabel(a, athleteId)
  const m = mkMarket(ctx.ev, `alt|${def.key}|${athleteId}`, `${name} - Alt ${def.name}`, 'alt', 'prop_ladder', 'ladder', {
    playerId: athleteId,
    playerName: name,
    playerTeamId: a?.teamId,
    headshot: a?.headshot,
    line,
    category: `Alt ${def.name}`,
    sortOrder: order,
  })
  const sigma = def.sigma(line)
  const step = def.ladderStep
  const start = def.integer ? Math.max(1, Math.round(line - step * Math.floor(def.ladderCount / 2))) : Math.max(step, Math.round((line - step * def.ladderCount) / step) * step)
  const thresholds: number[] = []
  for (let i = 0; i < def.ladderCount * 2 + 1; i++) {
    const t = start + i * step
    if (t <= 0) continue
    thresholds.push(t)
  }
  for (const t of thresholds) {
    const p = pReach(line, sigma, t, !!def.integer)
    if (p < 0.02 || p > 0.97) continue
    m.selections.push(sel(m, `${t}`, `${fmtLine(t)}+ ${def.short.replace(/^PASS YDS$/, 'Passing Yds').replace(/^RUSH YDS$/, 'Rushing Yds').replace(/^REC YDS$/, 'Receiving Yds')}`, priceFromProb(p, 0.07), { kind: 'player_ladder', statKey: def.statKey, playerId: athleteId, line: t }, { playerId: athleteId, line: t, teamId: a?.teamId, sub: `${name} - Alt ${def.name}` }))
  }
  return m.selections.length >= 2 ? m : null
}

interface ScorerCandidate {
  athleteId: string
  p: number
}

function scorerMarket(ctx: PropsContext, key: string, name: string, kind: 'td_scorer' | 'first_td' | 'last_td' | 'multi_td', cands: ScorerCandidate[], statKey: string, opts: { count?: number; period?: string; order: number; margin: number; category: string }): Market {
  const m = mkMarket(ctx.ev, `scorer|${key}`, name, 'td', 'scorer', 'list', { category: opts.category, sortOrder: opts.order })
  for (const c of cands) {
    const a = ctx.athletes[c.athleteId]
    const nm = playerLabel(a, c.athleteId)
    m.selections.push(sel(m, c.athleteId, nm, priceFromProb(c.p, opts.margin), { kind, playerId: c.athleteId, statKey, count: opts.count, period: opts.period, teamId: a?.teamId }, { playerId: c.athleteId, teamId: a?.teamId, sub: name }))
  }
  m.selections.sort((x, y) => x.odds - y.odds)
  return m
}

/** Build all player prop markets for an event. */
export function buildPropMarkets(ctx: PropsContext): Market[] {
  const { ev, league } = ctx
  const rnd = seededRandom(`props:${ev.id}`)
  const defs = statDefsFor(league)
  const byKey = Object.fromEntries(defs.map((d) => [d.key, d]))
  const out: Market[] = []
  const lines = new Map<string, number>() // `${defKey}|${athleteId}` -> line
  const scorerLists: Record<string, string[]> = {}
  let order = 100

  // 1) Real ESPN prop lines
  for (const r of ctx.raw) {
    if (r.athleteId) {
      const key = mapEspnType(r.typeName)
      if (key && byKey[key] && r.line !== undefined) {
        lines.set(`${key}|${r.athleteId}`, r.line)
        continue
      }
      for (const [re, def] of SCORER_TYPES) {
        if (re.test(r.typeName)) {
          ;(scorerLists[def.key] ??= []).push(r.athleteId)
        }
      }
    }
  }

  // 2) Synthesize lines from team leaders when ESPN has none
  if (lines.size === 0) synthesizeFromLeaders(ctx, lines, rnd)

  // Ensure every athlete referenced exists in the athletes map (name resolution happens upstream)
  const grouped = new Map<string, { athleteId: string; line: number }[]>()
  for (const [k, line] of lines) {
    const [defKey, athleteId] = k.split('|')
    if (!ctx.athletes[athleteId]) continue
    ;(grouped.get(defKey) ?? grouped.set(defKey, []).get(defKey)!).push({ athleteId, line })
  }

  for (const def of defs) {
    const rows = grouped.get(def.key)
    if (!rows) continue
    rows.sort((a, b) => b.line - a.line)
    for (const r of rows) {
      out.push(ouMarket(ctx, def, r.athleteId, r.line, rnd, order++))
      const lad = ladderMarket(ctx, def, r.athleteId, r.line, order + 500)
      if (lad) out.push(lad)
    }
  }

  // 3) Scorer markets
  if (league.sport === 'football') {
    const cands = tdCandidates(ctx, lines, scorerLists['any_td'])
    if (cands.length) {
      out.push(scorerMarket(ctx, 'any_td', 'Anytime Touchdown Scorer', 'td_scorer', cands, 'td', { order: 60, margin: 0.14, category: 'TD Scorer Props' }))
      const sum = cands.reduce((a, c) => a + c.p, 0)
      const first = cands.map((c) => ({ athleteId: c.athleteId, p: (c.p / sum) * 0.96 }))
      out.push(scorerMarket(ctx, 'first_td', 'First Touchdown Scorer', 'first_td', first, 'td', { order: 61, margin: 0.2, category: 'TD Scorer Props' }))
      out.push(scorerMarket(ctx, 'last_td', 'Last Touchdown Scorer', 'last_td', first, 'td', { order: 62, margin: 0.2, category: 'TD Scorer Props' }))
      out.push(scorerMarket(ctx, 'td2', 'To Score 2+ Touchdowns', 'multi_td', cands.filter((c) => c.p > 0.15).map((c) => ({ athleteId: c.athleteId, p: c.p * c.p * 0.85 })), 'td', { count: 2, order: 63, margin: 0.18, category: 'TD Scorer Props' }))
      out.push(scorerMarket(ctx, 'td3', 'To Score 3+ Touchdowns', 'multi_td', cands.filter((c) => c.p > 0.3).map((c) => ({ athleteId: c.athleteId, p: Math.pow(c.p, 3) * 0.7 })), 'td', { count: 3, order: 64, margin: 0.2, category: 'TD Scorer Props' }))
      out.push(scorerMarket(ctx, 'h1_td', 'Anytime 1st Half TD Scorer', 'td_scorer', cands.map((c) => ({ athleteId: c.athleteId, p: 1 - Math.sqrt(1 - c.p) })), 'td', { period: 'h1', order: 65, margin: 0.16, category: 'TD Scorer Props' }))
      out.push(scorerMarket(ctx, 'q1_td', 'Anytime 1st Quarter TD Scorer', 'td_scorer', cands.map((c) => ({ athleteId: c.athleteId, p: 1 - Math.pow(1 - c.p, 0.25) })), 'td', { period: 'q1', order: 66, margin: 0.18, category: 'TD Scorer Props' }))
      // 1st team TD scorer per team
      for (const c of [ev.away, ev.home]) {
        const team = cands.filter((x) => ctx.athletes[x.athleteId]?.teamId === c.team.id)
        const s = team.reduce((a, x) => a + x.p, 0)
        if (team.length) out.push(scorerMarket(ctx, `ftd|${c.team.id}`, `${c.team.abbreviation} ${c.team.name} First Touchdown Scorer`, 'first_td', team.map((x) => ({ athleteId: x.athleteId, p: (x.p / s) * 0.95 })), 'td', { order: 67, margin: 0.2, category: 'TD Scorer Props' }))
      }
    }
  } else if (league.sport === 'hockey' || league.sport === 'soccer') {
    const cands = goalCandidates(ctx)
    if (cands.length) {
      const statKey = league.sport === 'hockey' ? '*.goals' : '*.totalGoals'
      out.push(scorerMarket(ctx, 'any_goal', 'Anytime Goal Scorer', 'td_scorer', cands, statKey, { order: 60, margin: 0.14, category: 'Goal Scorer' }))
      const sum = cands.reduce((a, c) => a + c.p, 0)
      out.push(scorerMarket(ctx, 'first_goal', 'First Goal Scorer', 'first_td', cands.map((c) => ({ athleteId: c.athleteId, p: (c.p / sum) * 0.93 })), statKey, { order: 61, margin: 0.2, category: 'Goal Scorer' }))
      out.push(scorerMarket(ctx, 'goal2', 'To Score 2+ Goals', 'multi_td', cands.filter((c) => c.p > 0.2).map((c) => ({ athleteId: c.athleteId, p: c.p * c.p * 0.6 })), statKey, { count: 2, order: 62, margin: 0.18, category: 'Goal Scorer' }))
    }
  } else if (league.sport === 'baseball') {
    const cands = hrCandidates(ctx)
    if (cands.length) out.push(scorerMarket(ctx, 'hr', 'To Hit a Home Run', 'td_scorer', cands, 'batting.homeRuns', { order: 60, margin: 0.14, category: 'Home Run Props' }))
  } else if (league.sport === 'basketball') {
    // "To Score 20+/30+ Points" quick markets from points lines
    const pts = grouped.get('points') ?? []
    for (const thr of [20, 30]) {
      const m = mkMarket(ev, `pts${thr}`, `To Score ${thr}+ Points`, 'td', 'scorer', 'list', { category: 'Player Points', sortOrder: 70 + thr })
      for (const r of pts) {
        const p = pReach(r.line, byKey.points.sigma(r.line), thr, true)
        if (p < 0.03) continue
        const a = ctx.athletes[r.athleteId]
        m.selections.push(sel(m, r.athleteId, playerLabel(a, r.athleteId), priceFromProb(p, 0.08), { kind: 'player_ladder', statKey: '*.points', playerId: r.athleteId, line: thr }, { playerId: r.athleteId, teamId: a?.teamId, line: thr, sub: `To Score ${thr}+ Points` }))
      }
      m.selections.sort((x, y) => x.odds - y.odds)
      if (m.selections.length) out.push(m)
    }
  }

  return out
}

/* --------------------------- candidates & synthesis --------------------------- */

function tdCandidates(ctx: PropsContext, lines: Map<string, number>, espnList?: string[]): ScorerCandidate[] {
  const ids = new Set<string>(espnList ?? [])
  for (const k of lines.keys()) {
    const [def, id] = k.split('|')
    if (def === 'rush_yds' || def === 'rec_yds' || def === 'pass_yds') ids.add(id)
  }
  const out: ScorerCandidate[] = []
  for (const id of ids) {
    const a = ctx.athletes[id]
    if (!a) continue
    const rush = lines.get(`rush_yds|${id}`) ?? 0
    const rec = lines.get(`rec_yds|${id}`) ?? 0
    const isQB = a.position === 'QB' || lines.has(`pass_yds|${id}`)
    let p = 0.06 + 0.0055 * (rush + 0.9 * rec)
    if (isQB) p = 0.05 + 0.006 * rush + 0.05
    if (a.position === 'K' || a.position === 'P') continue
    p = Math.min(0.72, Math.max(0.05, p))
    out.push({ athleteId: id, p })
  }
  return out.sort((x, y) => y.p - x.p).slice(0, 30)
}

function goalCandidates(ctx: PropsContext): ScorerCandidate[] {
  const out: ScorerCandidate[] = []
  for (const tl of ctx.leaders) {
    const goals = tl.categories['goals'] ?? tl.categories['goalsLeaders'] ?? []
    const gp = tl.gamesPlayed ?? (ctx.league.sport === 'hockey' ? 82 : 10)
    goals.slice(0, 9).forEach((l, i) => {
      if (!ctx.athletes[l.athleteId]) return
      const perGame = gp > 0 ? l.value / gp : 0.3
      const base = ctx.league.sport === 'hockey' ? Math.min(0.5, Math.max(0.1, perGame * 0.85 + 0.03)) : Math.min(0.55, Math.max(0.1, perGame * 0.9 + 0.05))
      out.push({ athleteId: l.athleteId, p: Math.max(0.08, base - i * 0.015) })
    })
  }
  return out
}

function hrCandidates(ctx: PropsContext): ScorerCandidate[] {
  const out: ScorerCandidate[] = []
  for (const tl of ctx.leaders) {
    const hr = tl.categories['homeRuns'] ?? []
    const gp = tl.gamesPlayed ?? 140
    hr.slice(0, 7).forEach((l) => {
      if (!ctx.athletes[l.athleteId]) return
      const perGame = l.value / Math.max(gp, 20)
      out.push({ athleteId: l.athleteId, p: Math.min(0.42, Math.max(0.08, perGame * 0.95 + 0.04)) })
    })
  }
  return out
}

function synthesizeFromLeaders(ctx: PropsContext, lines: Map<string, number>, rnd: () => number) {
  const { league } = ctx
  const put = (key: string, id: string, line: number) => {
    if (!ctx.athletes[id]) return
    lines.set(`${key}|${id}`, line)
  }
  const jitter = (n: number, amt: number) => n + (rnd() - 0.5) * 2 * amt
  for (const tl of ctx.leaders) {
    const gp = Math.max(1, tl.gamesPlayed ?? 1)
    const cat = (n: string) => tl.categories[n] ?? []
    if (league.sport === 'basketball') {
      cat('pointsPerGame').slice(0, 7).forEach((l) => put('points', l.athleteId, toHalfLine(jitter(l.value, 1.2))))
      cat('reboundsPerGame').slice(0, 5).forEach((l) => put('rebounds', l.athleteId, toHalfLine(jitter(l.value, 0.6))))
      cat('assistsPerGame').slice(0, 4).forEach((l) => put('assists', l.athleteId, toHalfLine(jitter(l.value, 0.6))))
      cat('3PointMadePerGame').slice(0, 4).forEach((l) => put('threes', l.athleteId, toHalfLine(jitter(l.value, 0.3))))
      const pts = cat('pointsPerGame').slice(0, 3)
      for (const p of pts) {
        const reb = cat('reboundsPerGame').find((x) => x.athleteId === p.athleteId)?.value ?? 3.5
        const ast = cat('assistsPerGame').find((x) => x.athleteId === p.athleteId)?.value ?? 2.5
        put('pra', p.athleteId, toHalfLine(jitter(p.value + reb + ast, 1.5)))
      }
      cat('stealsPerGame').slice(0, 2).forEach((l) => put('steals', l.athleteId, toHalfLine(Math.max(0.5, l.value))))
      cat('blocksPerGame').slice(0, 2).forEach((l) => put('blocks', l.athleteId, toHalfLine(Math.max(0.5, l.value))))
    } else if (league.sport === 'hockey') {
      cat('points').slice(0, 8).forEach((l, i) => {
        put('shots', l.athleteId, i < 3 ? 3.5 : i < 6 ? 2.5 : 1.5)
        put('points', l.athleteId, i < 2 ? 1.5 : 0.5)
      })
      cat('assists').slice(0, 4).forEach((l) => put('assists', l.athleteId, 0.5))
      cat('savePct').slice(0, 1).forEach((l) => put('saves', l.athleteId, toHalfLine(jitter(27.5, 2))))
    } else if (league.sport === 'baseball') {
      cat('hits').slice(0, 6).forEach((l) => put('hits', l.athleteId, l.value / gp > 1.15 ? 1.5 : 0.5))
      cat('RBIs').slice(0, 4).forEach((l) => put('rbis', l.athleteId, 0.5))
      cat('runs').slice(0, 4).forEach((l) => put('runs', l.athleteId, 0.5))
      cat('homeRuns').slice(0, 3).forEach((l) => put('hr', l.athleteId, 0.5))
      const pitchers = (ctx.probables ?? []).filter((p) => p.teamId === tl.teamId)
      for (const p of pitchers) {
        const k = cat('strikeouts').find((x) => x.athleteId === p.athleteId)
        const perStart = k ? k.value / Math.max(5, gp / 5.2) : 5.4
        put('p_k', p.athleteId, toHalfLine(Math.min(9.5, Math.max(3.5, jitter(perStart, 0.6)))))
        put('p_outs', p.athleteId, toHalfLine(jitter(16.5, 1.5)))
        put('p_er', p.athleteId, 2.5)
        put('p_hits', p.athleteId, toHalfLine(jitter(5, 0.8)))
      }
    } else if (league.sport === 'soccer') {
      cat('totalShots').slice(0, 5).forEach((l) => put('shots', l.athleteId, l.value / gp > 2.4 ? 2.5 : 1.5))
      cat('shotsOnTarget').slice(0, 5).forEach((l) => put('sot', l.athleteId, l.value / gp > 1.2 ? 1.5 : 0.5))
      cat('assists').slice(0, 3).forEach((l) => put('assists', l.athleteId, 0.5))
    } else if (league.sport === 'football') {
      cat('passingYards').slice(0, 1).forEach((l) => put('pass_yds', l.athleteId, toHalfLine(jitter(l.value / gp, 12))))
      cat('passingTouchdowns').slice(0, 1).forEach((l) => put('pass_tds', l.athleteId, l.value / gp > 2.2 ? 2.5 : 1.5))
      cat('rushingYards').slice(0, 3).forEach((l, i) => put('rush_yds', l.athleteId, toHalfLine(Math.max(15, jitter(l.value / gp, 8) * (i === 0 ? 1 : 0.9)))))
      cat('receivingYards').slice(0, 5).forEach((l) => put('rec_yds', l.athleteId, toHalfLine(Math.max(12, jitter(l.value / gp, 7)))))
      cat('receptions').slice(0, 5).forEach((l) => put('receptions', l.athleteId, toHalfLine(Math.max(1.5, jitter(l.value / gp, 0.7)))))
    }
  }
}

/** Curated yes/no style quick bets pulled from the ladders. */
export function buildQuickBets(ev: GameEvent, markets: Market[]): Market {
  const m = mkMarket(ev, 'quick', 'Quick Bets', 'popular', 'prop_yesno', 'list', { category: 'Quick Bets', sortOrder: 5 })
  const rnd = seededRandom(`quick:${ev.id}`)
  const ladders = markets.filter((x) => x.kind === 'prop_ladder')
  for (const l of ladders) {
    const opts = l.selections.filter((s) => s.odds >= -160 && s.odds <= 400)
    if (!opts.length) continue
    const pick = opts[Math.floor(rnd() * opts.length)]
    m.selections.push({ ...pick, id: `${m.id}|${pick.id}`, marketId: m.id, label: `${l.playerName} ${pick.label}`, sub: l.name })
    if (m.selections.length >= 14) break
  }
  return m
}

/** Overridden lines for period markets / team totals coming from real ESPN props. */
export function realPeriodLines(raw: RawPropBet[], ev: GameEvent): { spread: Record<string, number>; total: Record<string, number>; teamTotals: Record<string, number> } {
  const spread: Record<string, number> = {}
  const total: Record<string, number> = {}
  const teamTotals: Record<string, number> = {}
  const pk = (name: string): string | null => {
    if (/^1st Half/i.test(name)) return 'h1'
    if (/^2nd Half/i.test(name)) return 'h2'
    if (/^1st Quarter/i.test(name)) return 'q1'
    if (/^2nd Quarter/i.test(name)) return 'q2'
    if (/^3rd Quarter/i.test(name)) return 'q3'
    if (/^4th Quarter/i.test(name)) return 'q4'
    if (/^1st Period/i.test(name)) return 'p1'
    return null
  }
  for (const r of raw) {
    if (r.line === undefined) continue
    if (/^Team Total Points$/i.test(r.typeName) && r.teamId) {
      teamTotals[r.teamId] = r.line
      continue
    }
    const key = pk(r.typeName)
    if (!key) continue
    if (/ Total$/i.test(r.typeName)) total[key] = r.line
    else if (/ Spread$/i.test(r.typeName) && r.teamId) spread[key] = r.teamId === ev.home.team.id ? r.line : -r.line
  }
  return { spread, total, teamTotals }
}

export { juice }
