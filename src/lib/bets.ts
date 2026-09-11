import type { SlipSelection } from '@/store/betslip'
import { americanToDecimal, combinations, decimalToAmerican, payout, round2, teaserOdds, toWin } from './odds'
import type { Bet, BetLeg, BetType, PromoToken } from './types'
import { LEAGUE_BY_ID } from '@/data/sports'
import { formatLine } from './odds'

/* ----------------------------- correlation ----------------------------- */

function isTeamSide(s: SlipSelection): boolean {
  const k = s.selection.grading.kind
  return k === 'moneyline' || k === 'spread' || k === 'period_ml' || k === 'period_spread' || k === 'draw_no_bet'
}

function teamOf(s: SlipSelection): string | undefined {
  return s.selection.grading.teamId ?? s.selection.teamId
}

function isOverish(s: SlipSelection): boolean | null {
  const side = s.selection.grading.side
  if (side === 'over' || side === 'yes') return true
  if (side === 'under' || side === 'no') return false
  const k = s.selection.grading.kind
  if (k === 'player_ladder' || k === 'td_scorer' || k === 'first_td' || k === 'last_td' || k === 'multi_td') return true
  return null
}

/** Estimated correlation coefficient between two selections in the same event. */
export function pairCorrelation(a: SlipSelection, b: SlipSelection): number {
  const ka = a.selection.grading.kind
  const kb = b.selection.grading.kind
  const ta = teamOf(a)
  const tb = teamOf(b)
  if (isTeamSide(a) && isTeamSide(b)) {
    if (ta && tb) return ta === tb ? (ka === kb ? 0.5 : 0.6) : -0.5
    return 0
  }
  const oa = isOverish(a)
  const ob = isOverish(b)
  const totalA = ka === 'total' || ka === 'period_total'
  const totalB = kb === 'total' || kb === 'period_total'
  const ttA = ka === 'team_total'
  const ttB = kb === 'team_total'
  if ((totalA && ttB) || (ttA && totalB)) return oa === ob ? 0.35 : -0.3
  if (totalA && totalB) return oa === ob ? 0.4 : -0.4
  const playerA = !!a.selection.grading.playerId
  const playerB = !!b.selection.grading.playerId
  if (playerA && playerB) {
    if (a.selection.grading.playerId === b.selection.grading.playerId) return oa === ob ? 0.55 : -0.5
    if (ta && tb && ta === tb) {
      const passA = /passing/.test(a.selection.grading.statKey ?? '')
      const passB = /passing/.test(b.selection.grading.statKey ?? '')
      const recA = /receiving/.test(a.selection.grading.statKey ?? '')
      const recB = /receiving/.test(b.selection.grading.statKey ?? '')
      if ((passA && recB) || (recA && passB)) return oa === ob ? 0.3 : -0.25
      return oa === ob ? 0.1 : -0.08
    }
    return 0.03
  }
  if ((playerA && totalB) || (playerB && totalA)) return oa === ob ? 0.15 : -0.12
  if ((playerA && ttB) || (playerB && ttA)) {
    const pt = playerA ? ta : tb
    const tt = playerA ? tb : ta
    if (pt && tt && pt === tt) return oa === ob ? 0.25 : -0.2
    return 0
  }
  if ((playerA && isTeamSide(b)) || (playerB && isTeamSide(a))) {
    const pt = playerA ? ta : tb
    const tt = playerA ? tb : ta
    const over = playerA ? oa : ob
    if (pt && tt) return pt === tt ? (over ? 0.12 : -0.1) : over ? -0.06 : 0.06
    return 0
  }
  if ((isTeamSide(a) && ttB) || (isTeamSide(b) && ttA)) {
    const t1 = ta
    const t2 = tb
    const over = ttA ? oa : ob
    if (t1 && t2) return t1 === t2 ? (over ? 0.3 : -0.25) : over ? -0.15 : 0.15
  }
  return 0
}

/** Multiplier applied to parlay profit for a same-game group (< 1 for positively correlated legs). */
export function sgpFactor(group: SlipSelection[]): number {
  let f = 1
  for (let i = 0; i < group.length; i++) {
    for (let j = i + 1; j < group.length; j++) {
      const rho = pairCorrelation(group[i], group[j])
      if (rho > 0) f *= 1 - Math.min(1, rho) * 0.55
      else if (rho < 0) f *= 1 + Math.min(1, -rho) * 0.22
    }
  }
  return Math.max(0.25, f)
}

export function sgpDecimal(group: SlipSelection[]): number {
  const naive = group.reduce((acc, s) => acc * americanToDecimal(s.selection.odds), 1)
  return 1 + (naive - 1) * sgpFactor(group)
}

/* ----------------------------- analysis ----------------------------- */

export interface SlipUnit {
  key: string
  eventId: string
  legs: SlipSelection[]
  decimal: number
  isSgp: boolean
}

export interface SlipAnalysis {
  count: number
  units: SlipUnit[]
  conflicts: Set<string>
  sgpIneligible: Set<string>
  canParlay: boolean
  parlayType: BetType
  parlayDecimal: number
  parlayOdds: number
  legCount: number
  sgpGroups: number
  teaserEligible: boolean
  teaserSport: 'football' | 'basketball' | null
  rrSizes: number[]
  hasLive: boolean
}

export function analyzeSlip(selections: SlipSelection[], rrDisabled: Record<string, boolean> = {}): SlipAnalysis {
  const conflicts = new Set<string>()
  const sgpIneligible = new Set<string>()
  const byEvent = new Map<string, SlipSelection[]>()
  for (const s of selections) {
    ;(byEvent.get(s.event.id) ?? byEvent.set(s.event.id, []).get(s.event.id)!).push(s)
  }
  const units: SlipUnit[] = []
  for (const [eventId, legs] of byEvent) {
    // same market twice → conflict
    const seenMarket = new Map<string, SlipSelection>()
    for (const s of legs) {
      const prev = seenMarket.get(s.market.id)
      if (prev) {
        conflicts.add(s.selection.id)
        conflicts.add(prev.selection.id)
      } else seenMarket.set(s.market.id, s)
    }
    if (legs.length > 1) {
      for (const s of legs) if (!s.market.sgp || s.live) sgpIneligible.add(s.selection.id)
    }
    const ok = legs.filter((s) => !conflicts.has(s.selection.id) && !sgpIneligible.has(s.selection.id))
    if (ok.length === 0) continue
    const dec = ok.length > 1 ? sgpDecimal(ok) : americanToDecimal(ok[0].selection.odds)
    units.push({ key: eventId, eventId, legs: ok, decimal: dec, isSgp: ok.length > 1 })
  }
  const activeUnits = units.filter((u) => !u.legs.every((l) => rrDisabled[l.selection.id]))
  const legCount = units.reduce((a, u) => a + u.legs.length, 0)
  const sgpGroups = units.filter((u) => u.isSgp).length
  const canParlay = legCount >= 2 && conflicts.size === 0 && sgpIneligible.size === 0
  const parlayDecimal = units.reduce((acc, u) => acc * u.decimal, 1)
  const parlayType: BetType = sgpGroups === 0 ? 'parlay' : units.length === 1 ? 'sgp' : 'sgp_plus'
  const sportsSet = new Set(selections.map((s) => LEAGUE_BY_ID[s.event.leagueId]?.teaserSport).filter(Boolean))
  const teaserSport = sportsSet.size === 1 ? ([...sportsSet][0] as 'football' | 'basketball') : null
  const teaserEligible = !!teaserSport && selections.length >= 2 && selections.length <= 10 && selections.every((s) => (s.selection.grading.kind === 'spread' || s.selection.grading.kind === 'total') && !s.live) && new Set(selections.map((s) => s.event.id)).size === selections.length
  const rrSizes: number[] = []
  for (let k = 2; k < activeUnits.length; k++) rrSizes.push(k)
  return {
    count: selections.length,
    units,
    conflicts,
    sgpIneligible,
    canParlay,
    parlayType,
    parlayDecimal,
    parlayOdds: decimalToAmerican(parlayDecimal),
    legCount,
    sgpGroups,
    teaserEligible,
    teaserSport,
    rrSizes,
    hasLive: selections.some((s) => s.live),
  }
}

/* ----------------------------- bet construction ----------------------------- */

function uid(): string {
  return `bet_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`
}

let seq = 0
export function betId(): string {
  seq++
  const base = (Date.now() % 1_000_000_000).toString().padStart(9, '0')
  return `O/${base.slice(0, 10)}/${String((1000 + ((seq * 7919) % 9000)))}`
}

export function legFrom(s: SlipSelection): BetLeg {
  const g = s.selection.grading
  return {
    selectionId: s.selection.id,
    marketId: s.market.id,
    eventId: s.event.id,
    leagueId: s.event.leagueId,
    sport: s.event.sport,
    eventName: s.event.name,
    startTime: s.event.date,
    marketName: s.market.name,
    selectionLabel: s.selection.label,
    odds: s.selection.odds,
    line: s.selection.line,
    grading: g,
    status: 'open',
    live: s.live,
    homeAbbr: s.event.homeAbbr,
    awayAbbr: s.event.awayAbbr,
    homeName: s.event.homeName,
    awayName: s.event.awayName,
    playerId: s.selection.playerId,
    teamId: s.selection.teamId ?? g.teamId,
  }
}

export function applyBoost(stake: number, decimal: number, boostPct?: number): { toWin: number; potentialPayout: number } {
  const base = round2(stake * (decimal - 1))
  const boosted = boostPct ? round2(base * (1 + boostPct / 100)) : base
  return { toWin: boosted, potentialPayout: round2(stake + boosted) }
}

export interface BuildOpts {
  boost?: PromoToken | null
  noSweat?: PromoToken | null
  bonusBet?: boolean
}

export function buildSingle(s: SlipSelection, stake: number, opts: BuildOpts = {}): Bet {
  const dec = americanToDecimal(s.selection.odds)
  const { toWin: tw, potentialPayout } = applyBoost(stake, dec, opts.boost?.pct)
  const now = new Date().toISOString()
  return {
    id: uid(),
    betId: betId(),
    placedAt: now,
    type: 'single',
    legs: [legFrom(s)],
    stake,
    odds: s.selection.odds,
    toWin: tw,
    potentialPayout,
    status: 'open',
    title: `${s.selection.label}`,
    boostPct: opts.boost?.pct,
    noSweat: !!opts.noSweat,
    bonusBet: opts.bonusBet,
    live: s.live,
    eventId: s.event.id,
  }
}

export function buildParlay(analysis: SlipAnalysis, stake: number, opts: BuildOpts = {}): Bet {
  const legs = analysis.units.flatMap((u) => u.legs.map((l) => ({ ...legFrom(l), isSgp: u.isSgp })))
  const dec = analysis.parlayDecimal
  const { toWin: tw, potentialPayout } = applyBoost(stake, dec, opts.boost?.pct)
  const n = legs.length
  const title = analysis.parlayType === 'sgp' ? `${n} leg Same Game Parlay` : analysis.parlayType === 'sgp_plus' ? `${n} leg Same Game Parlay+` : `${n} leg parlay`
  return {
    id: uid(),
    betId: betId(),
    placedAt: new Date().toISOString(),
    type: analysis.parlayType,
    legs,
    stake,
    odds: decimalToAmerican(dec),
    toWin: tw,
    potentialPayout,
    status: 'open',
    title,
    boostPct: opts.boost?.pct,
    noSweat: !!opts.noSweat,
    bonusBet: opts.bonusBet,
    live: analysis.hasLive,
    eventId: analysis.parlayType === 'sgp' ? analysis.units[0]?.eventId : undefined,
    sgpGroups: analysis.units.filter((u) => u.isSgp).map((u) => u.legs.map((l) => l.selection.id)),
  }
}

export interface RoundRobinInfo {
  size: number
  combos: SlipUnit[][]
  wagers: number
  decimalAvg: number
  odds: number
}

export function roundRobinInfo(analysis: SlipAnalysis, size: number, rrDisabled: Record<string, boolean> = {}): RoundRobinInfo {
  const units = analysis.units.filter((u) => !u.legs.every((l) => rrDisabled[l.selection.id]))
  const combos = combinations(units, size)
  const totalDec = combos.reduce((a, c) => a + c.reduce((x, u) => x * u.decimal, 1), 0)
  const decimalAvg = combos.length ? totalDec / combos.length : 1
  return { size, combos, wagers: combos.length, decimalAvg, odds: decimalToAmerican(decimalAvg) }
}

export function buildRoundRobin(analysis: SlipAnalysis, size: number, stakePerCombo: number, rrDisabled: Record<string, boolean> = {}, opts: BuildOpts = {}): Bet {
  const info = roundRobinInfo(analysis, size, rrDisabled)
  const units = analysis.units.filter((u) => !u.legs.every((l) => rrDisabled[l.selection.id]))
  const legs = units.flatMap((u) => u.legs.map((l) => ({ ...legFrom(l), isSgp: u.isSgp })))
  const potential = round2(info.combos.reduce((a, c) => a + stakePerCombo * c.reduce((x, u) => x * u.decimal, 1), 0))
  const total = round2(stakePerCombo * info.wagers)
  const boosted = opts.boost?.pct ? round2((potential - total) * (1 + opts.boost.pct / 100) + total) : potential
  return {
    id: uid(),
    betId: betId(),
    placedAt: new Date().toISOString(),
    type: 'round_robin',
    legs,
    stake: stakePerCombo,
    odds: info.odds,
    toWin: round2(boosted - total),
    potentialPayout: boosted,
    status: 'open',
    title: `Round Robin (By ${size}'s x${info.wagers} wagers)`,
    rrSize: size,
    rrCombos: info.wagers,
    boostPct: opts.boost?.pct,
    noSweat: !!opts.noSweat,
    bonusBet: opts.bonusBet,
    sgpGroups: units.filter((u) => u.isSgp).map((u) => u.legs.map((l) => l.selection.id)),
  }
}

export function teaserLeg(s: SlipSelection, points: number): BetLeg {
  const leg = legFrom(s)
  const g = leg.grading
  const isSpread = g.kind === 'spread'
  const line = (g.line ?? 0) + (isSpread ? points : g.side === 'over' ? -points : points)
  const label = isSpread ? `${leg.selectionLabel.replace(/\s[-+]?\d+(\.\d)?$|\sPK$/, '')} ${formatLine(line)}` : `${g.side === 'over' ? 'Over' : 'Under'} ${line}`
  return { ...leg, line, selectionLabel: label, grading: { ...g, line }, odds: 100 }
}

export function buildTeaser(selections: SlipSelection[], sport: 'football' | 'basketball', points: number, stake: number, opts: BuildOpts = {}): Bet | null {
  const odds = teaserOdds(sport, points, selections.length)
  if (!odds) return null
  const legs = selections.map((s) => teaserLeg(s, points))
  const dec = americanToDecimal(odds)
  const { toWin: tw, potentialPayout } = applyBoost(stake, dec, opts.boost?.pct)
  return {
    id: uid(),
    betId: betId(),
    placedAt: new Date().toISOString(),
    type: 'teaser',
    legs,
    stake,
    odds,
    toWin: tw,
    potentialPayout,
    status: 'open',
    title: `${legs.length} leg ${points}pt teaser`,
    teaserPoints: points,
    boostPct: opts.boost?.pct,
    noSweat: !!opts.noSweat,
    bonusBet: opts.bonusBet,
  }
}

export function quickWin(stake: number, odds: number): number {
  return toWin(stake, odds)
}

export function quickPayout(stake: number, odds: number): number {
  return payout(stake, odds)
}

/** Whether a promo token can be applied to the bet being built. */
export function tokenApplies(t: PromoToken, ctx: { type: BetType; legs: number; live: boolean; stake: number; leagueId?: string }): boolean {
  if (t.used) return false
  if (new Date(t.expiresAt).getTime() < Date.now()) return false
  if (t.minLegs && ctx.legs < t.minLegs) return false
  if (t.maxWager && ctx.stake > t.maxWager + 1e-9) return false
  switch (t.appliesTo) {
    case 'parlay': return ctx.type !== 'single'
    case 'sgp': return ctx.type === 'sgp' || ctx.type === 'sgp_plus'
    case 'live': return ctx.live
    case 'sport': return !!t.leagueId && t.leagueId === ctx.leagueId
    default: return true
  }
}
