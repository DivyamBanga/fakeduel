import type { LeagueDef } from '@/data/sports'
import type { EventSummary } from './espn'
import { americanToDecimal, combinations, round2, teaserOdds } from './odds'
import { periodDefs, regulationPeriods } from './markets'
import type { Bet, BetLeg, BetStatus } from './types'

export interface LegResult {
  status: BetStatus
  resultText?: string
}

/* ----------------------------- stat extraction ----------------------------- */

function parseNum(v: string | undefined): number | null {
  if (v === undefined || v === null) return null
  const s = String(v).replace(/,/g, '')
  if (s === '--' || s === '') return null
  const n = parseFloat(s)
  return isFinite(n) ? n : null
}

/** Extract a stat for a player. statKey: "group.key", "group.key#idx" (split composite), "*.key" (any group), "a+b" sums. */
export function extractStat(summary: EventSummary, playerId: string, statKey: string): number | null {
  if (statKey.includes('+')) {
    let sum = 0
    let any = false
    for (const part of statKey.split('+')) {
      const v = extractStat(summary, playerId, part)
      if (v !== null) {
        sum += v
        any = true
      }
    }
    return any ? sum : null
  }
  if (statKey === 'td') {
    const parts = ['rushing.rushingTouchdowns', 'receiving.receivingTouchdowns', 'kickReturns.kickReturnTouchdowns', 'puntReturns.puntReturnTouchdowns', 'defensive.defensiveTouchdowns', 'interceptions.interceptionTouchdowns']
    let sum = 0
    let any = false
    for (const p of parts) {
      const v = extractStat(summary, playerId, p)
      if (v !== null) {
        sum += v
        any = true
      }
    }
    if (any) return sum
    return playerPlayed(summary, playerId) ? 0 : null
  }
  if (statKey === 'pitching.outs') {
    const ip = extractRaw(summary, playerId, 'pitching', 'fullInnings.partInnings')
    if (ip === null) return null
    const [full, part] = ip.split('.')
    return parseInt(full || '0', 10) * 3 + parseInt(part || '0', 10)
  }
  const [groupPart, keyPart] = statKey.split('.', 2)
  const rest = statKey.slice(groupPart.length + 1)
  const m = rest.match(/^(.*?)(?:#(\d+))?$/)
  const key = m ? m[1] : keyPart
  const idx = m && m[2] !== undefined ? parseInt(m[2], 10) : null
  const raw = extractRaw(summary, playerId, groupPart, key)
  if (raw === null) return null
  if (idx !== null) {
    const parts = raw.split(/[\/-]/)
    return parseNum(parts[idx])
  }
  return parseNum(raw)
}

function extractRaw(summary: EventSummary, playerId: string, group: string, key: string): string | null {
  for (const team of summary.boxscore) {
    for (const g of team.groups) {
      if (group !== '*' && g.name !== group) continue
      const ki = g.keys.indexOf(key)
      if (ki < 0) continue
      const row = g.athletes.find((a) => a.athlete.id === playerId)
      if (!row) continue
      return row.stats[ki] ?? null
    }
  }
  // soccer/other: roster-embedded stats
  for (const r of summary.rosters) {
    const a = r.athletes.find((x) => x.id === playerId) as (typeof r.athletes)[number] & { stats?: Record<string, string> }
    if (a?.stats && key in a.stats) return a.stats[key]
  }
  return null
}

export function playerPlayed(summary: EventSummary, playerId: string): boolean {
  return summary.boxscore.some((t) => t.groups.some((g) => g.athletes.some((a) => a.athlete.id === playerId)))
}

/* ----------------------------- period scores ----------------------------- */

function periodScore(summary: EventSummary, leagueDef: LeagueDef, periodKey: string): { home: number; away: number } | null {
  const ev = summary.event
  if (!ev) return null
  const def = periodDefs(leagueDef).find((p) => p.key === periodKey)
  if (!def) return null
  const hl = ev.home.linescores
  const al = ev.away.linescores
  if (!hl || !al) return null
  let home = 0
  let away = 0
  for (const p of def.periods) {
    if (hl[p - 1] === undefined || al[p - 1] === undefined) return null
    home += hl[p - 1]
    away += al[p - 1]
  }
  return { home, away }
}

/* ----------------------------- leg grading ----------------------------- */

function tdScorers(summary: EventSummary): { first: string[]; last: string[]; byPeriod: Record<number, Set<string>> } {
  const tds = summary.scoringPlays.filter((p) => /touchdown/i.test(p.scoringType ?? '') || /\bTD\b|touchdown/i.test(p.text))
  const nameOf = (text: string): string | null => {
    const m = text.match(/^(.+?)\s\d+\s?(?:Yd|Yard|yd)/i)
    return m ? m[1].trim() : null
  }
  const idsForText = (text: string): string[] => {
    const nm = nameOf(text)
    if (!nm) return []
    const ids: string[] = []
    for (const team of summary.boxscore) for (const g of team.groups) for (const a of g.athletes) if (a.athlete.name === nm || a.athlete.shortName === nm) ids.push(a.athlete.id)
    for (const r of summary.rosters) for (const a of r.athletes) if (a.name === nm || a.shortName === nm) ids.push(a.id)
    return [...new Set(ids)]
  }
  const first = tds.length ? (tds[0].athleteIds.length ? tds[0].athleteIds : idsForText(tds[0].text)) : []
  const last = tds.length ? (tds[tds.length - 1].athleteIds.length ? tds[tds.length - 1].athleteIds : idsForText(tds[tds.length - 1].text)) : []
  const byPeriod: Record<number, Set<string>> = {}
  for (const p of tds) {
    const ids = p.athleteIds.length ? p.athleteIds : idsForText(p.text)
    ;(byPeriod[p.period] ??= new Set()).add(ids[0])
  }
  return { first, last, byPeriod }
}

export function gradeLeg(leg: BetLeg, summary: EventSummary, league: LeagueDef): LegResult {
  const ev = summary.event
  if (!ev) return { status: 'open' }
  if (!ev.status.completed && ev.status.state !== 'post') return { status: 'open' }
  const g = leg.grading
  const home = ev.home.score
  const away = ev.away.score
  const homeSide = g.side === 'home' || (g.teamId !== undefined && g.teamId === ev.home.team.id && g.side !== 'away')
  const mySide = homeSide ? home : away
  const otherSide = homeSide ? away : home
  const score = `${ev.away.team.abbreviation} ${away} - ${ev.home.team.abbreviation} ${home}`
  const wl = (won: boolean, text = score): LegResult => ({ status: won ? 'won' : 'lost', resultText: text })

  switch (g.kind) {
    case 'moneyline': {
      if (home === away) return league.hasDraw ? wl(false) : { status: 'push', resultText: score }
      return wl(mySide > otherSide)
    }
    case 'draw':
      return wl(home === away)
    case 'draw_no_bet':
      if (home === away) return { status: 'push', resultText: score }
      return wl(mySide > otherSide)
    case 'spread': {
      const diff = mySide - otherSide + (g.line ?? 0)
      if (diff === 0) return { status: 'push', resultText: score }
      return wl(diff > 0)
    }
    case 'total': {
      const t = home + away
      if (t === g.line) return { status: 'push', resultText: `Total ${t}` }
      return wl(g.side === 'over' ? t > (g.line ?? 0) : t < (g.line ?? 0), `Total ${t}`)
    }
    case 'team_total': {
      const t = g.teamId === ev.home.team.id ? home : away
      if (t === g.line) return { status: 'push', resultText: `${t} pts` }
      return wl(g.side === 'over' ? t > (g.line ?? 0) : t < (g.line ?? 0), `${t} pts`)
    }
    case 'period_ml':
    case 'period_spread':
    case 'period_total': {
      const ps = periodScore(summary, league, g.period ?? 'h1')
      if (!ps) return { status: 'void', resultText: 'Period scores unavailable' }
      const txt = `${ev.away.team.abbreviation} ${ps.away} - ${ev.home.team.abbreviation} ${ps.home}`
      if (g.kind === 'period_ml') {
        if (g.side === 'draw') return wl(ps.home === ps.away, txt)
        if (ps.home === ps.away) return { status: league.sport === 'football' || league.sport === 'basketball' ? 'lost' : 'push', resultText: txt }
        return wl(homeSide ? ps.home > ps.away : ps.away > ps.home, txt)
      }
      if (g.kind === 'period_spread') {
        const my = homeSide ? ps.home : ps.away
        const ot = homeSide ? ps.away : ps.home
        const diff = my - ot + (g.line ?? 0)
        if (diff === 0) return { status: 'push', resultText: txt }
        return wl(diff > 0, txt)
      }
      const t = ps.home + ps.away
      if (t === g.line) return { status: 'push', resultText: `Total ${t}` }
      return wl(g.side === 'over' ? t > (g.line ?? 0) : t < (g.line ?? 0), `Total ${t}`)
    }
    case 'player_stat': {
      if (!g.playerId || !g.statKey) return { status: 'void' }
      const v = extractStat(summary, g.playerId, g.statKey)
      if (v === null) return summary.boxscore.length ? { status: 'void', resultText: 'Did not play' } : { status: 'open' }
      if (v === g.line) return { status: 'push', resultText: `${v}` }
      return wl(g.side === 'over' ? v > (g.line ?? 0) : v < (g.line ?? 0), `${v}`)
    }
    case 'player_ladder': {
      if (!g.playerId || !g.statKey) return { status: 'void' }
      const v = extractStat(summary, g.playerId, g.statKey)
      if (v === null) return summary.boxscore.length ? { status: 'void', resultText: 'Did not play' } : { status: 'open' }
      return wl(v >= (g.line ?? 0), `${v}`)
    }
    case 'td_scorer': {
      if (!g.playerId) return { status: 'void' }
      if (g.period) {
        const { byPeriod } = tdScorers(summary)
        const periods = periodDefs(league).find((p) => p.key === g.period)?.periods ?? [1]
        const scored = periods.some((p) => byPeriod[p]?.has(g.playerId!))
        return wl(scored)
      }
      const v = extractStat(summary, g.playerId, g.statKey ?? 'td')
      if (v === null) return summary.boxscore.length ? { status: 'void', resultText: 'Did not play' } : { status: 'open' }
      return wl(v >= 1, `${v}`)
    }
    case 'multi_td': {
      if (!g.playerId) return { status: 'void' }
      const v = extractStat(summary, g.playerId, g.statKey ?? 'td')
      if (v === null) return summary.boxscore.length ? { status: 'void', resultText: 'Did not play' } : { status: 'open' }
      return wl(v >= (g.count ?? 2), `${v}`)
    }
    case 'first_td':
    case 'last_td': {
      if (!g.playerId) return { status: 'void' }
      const { first, last } = tdScorers(summary)
      const list = g.kind === 'first_td' ? first : last
      if (!list.length && !summary.scoringPlays.length) return { status: 'void', resultText: 'No scoring data' }
      return wl(list.includes(g.playerId))
    }
    case 'btts':
      return wl(g.side === 'yes' ? home > 0 && away > 0 : !(home > 0 && away > 0))
    case 'overtime': {
      const ot = ev.status.period > regulationPeriods(league)
      return wl(g.side === 'yes' ? ot : !ot)
    }
    case 'winning_margin': {
      const winnerId = home > away ? ev.home.team.id : away > home ? ev.away.team.id : null
      const margin = Math.abs(home - away)
      return wl(winnerId === g.teamId && margin >= (g.rangeLow ?? 0) && margin <= (g.rangeHigh ?? 999), score)
    }
    case 'futures':
      return { status: 'open' }
  }
  return { status: 'void' }
}

/* ----------------------------- bet settlement ----------------------------- */

export interface BetOutcome {
  status: BetStatus
  payout: number
  rrCombosWon?: number
}

function unitDecimal(legs: BetLeg[]): number {
  return legs.reduce((a, l) => a * americanToDecimal(l.odds), 1)
}

/** Compute the outcome once every leg is settled. Returns null while any leg is still open. */
export function computeBetOutcome(bet: Bet): BetOutcome | null {
  if (bet.legs.some((l) => l.status === 'open')) return null
  const boost = bet.boostPct ? 1 + bet.boostPct / 100 : 1
  const profitOf = (stake: number, decimal: number) => round2(stake * (decimal - 1) * boost)
  const returnStake = !bet.bonusBet

  if (bet.type === 'single' || bet.type === 'parlay' || bet.type === 'sgp' || bet.type === 'sgp_plus') {
    if (bet.legs.some((l) => l.status === 'lost')) return { status: 'lost', payout: 0 }
    const live = bet.legs.filter((l) => l.status === 'won')
    if (live.length === 0) return { status: 'push', payout: returnStake ? bet.stake : 0 }
    let dec: number
    if (live.length === bet.legs.length) dec = americanToDecimal(bet.odds)
    else {
      // recompute with voided legs removed, preserving the SGP discount ratio
      const full = unitDecimal(bet.legs)
      const ratio = full > 1 ? (americanToDecimal(bet.odds) - 1) / (full - 1) : 1
      dec = 1 + (unitDecimal(live) - 1) * ratio
    }
    const profit = profitOf(bet.stake, dec)
    return { status: 'won', payout: round2(profit + (returnStake ? bet.stake : 0)) }
  }

  if (bet.type === 'teaser') {
    if (bet.legs.some((l) => l.status === 'lost')) return { status: 'lost', payout: 0 }
    const live = bet.legs.filter((l) => l.status === 'won')
    if (live.length < 2) return { status: 'push', payout: returnStake ? bet.stake : 0 }
    const sport = bet.legs[0].sport === 'basketball' ? 'basketball' : 'football'
    const odds = live.length === bet.legs.length ? bet.odds : (teaserOdds(sport, bet.teaserPoints ?? 6, live.length) ?? bet.odds)
    const profit = profitOf(bet.stake, americanToDecimal(odds))
    return { status: 'won', payout: round2(profit + (returnStake ? bet.stake : 0)) }
  }

  if (bet.type === 'round_robin') {
    // group legs into units (SGP groups stay together)
    const groups = bet.sgpGroups ?? []
    const units: BetLeg[][] = []
    const used = new Set<string>()
    for (const gIds of groups) {
      const legs = bet.legs.filter((l) => gIds.includes(l.selectionId))
      if (legs.length) {
        units.push(legs)
        legs.forEach((l) => used.add(l.selectionId))
      }
    }
    for (const l of bet.legs) if (!used.has(l.selectionId)) units.push([l])
    const size = bet.rrSize ?? 2
    const combos = combinations(units, size)
    let payout = 0
    let won = 0
    let pushes = 0
    for (const c of combos) {
      const legs = c.flat()
      if (legs.some((l) => l.status === 'lost')) continue
      const live = legs.filter((l) => l.status === 'won')
      if (live.length === 0) {
        payout += bet.stake
        pushes++
        continue
      }
      const full = unitDecimal(legs)
      const comboDec = c.reduce((a, u) => a * (u.length > 1 ? 1 + (unitDecimal(u) - 1) * 0.85 : unitDecimal(u)), 1)
      const ratio = full > 1 ? (comboDec - 1) / (full - 1) : 1
      const dec = live.length === legs.length ? comboDec : 1 + (unitDecimal(live) - 1) * ratio
      payout += bet.stake * (dec - 1) * boost + (returnStake ? bet.stake : 0)
      won++
    }
    const status: BetStatus = won > 0 ? 'won' : pushes === combos.length ? 'push' : 'lost'
    return { status, payout: round2(payout), rrCombosWon: won }
  }
  return null
}
