import type { LeagueDef } from '@/data/sports'
import { impliedProb, normCdf, priceFromProb, roundHalf, toHalfLine } from './odds'
import { marginSigma, regulationPeriods, totalSigma } from './markets'
import type { BetLeg, GameEvent, GameLines, Grading } from './types'

function clockSeconds(clock: string): number {
  if (!clock) return 0
  const m = clock.match(/(\d+):(\d+)/)
  if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
  const s = clock.match(/^(\d+)(?:'|\+)/)
  if (s) return parseInt(s[1], 10) * 60
  const n = parseFloat(clock)
  return isFinite(n) ? n : 0
}

function periodLength(league: LeagueDef): number {
  switch (league.sport) {
    case 'football': return 15 * 60
    case 'basketball': return league.id === 'nba' ? 12 * 60 : league.id === 'ncaab' ? 20 * 60 : 10 * 60
    case 'hockey': return 20 * 60
    case 'soccer': return 45 * 60
    default: return 60
  }
}

/** Fraction of regulation remaining: 1 = not started, 0 = final. */
export function fractionRemaining(ev: GameEvent, league: LeagueDef): number {
  const st = ev.status
  if (st.state === 'pre') return 1
  if (st.state === 'post' || st.completed) return 0
  const reg = regulationPeriods(league)
  const period = Math.max(1, st.period || 1)
  if (league.periods === 'innings') {
    const isTop = /top/i.test(st.detail) || /top/i.test(st.shortDetail)
    const done = (period - 1) + (isTop ? 0 : 0.5)
    return Math.max(0, Math.min(1, 1 - done / reg))
  }
  if (league.periods === 'none' || reg <= 1) return 0.5
  if (period > reg) return 0.02
  const len = periodLength(league)
  let secsLeft = clockSeconds(st.clock)
  if (league.sport === 'soccer') {
    // soccer clock counts up
    const elapsed = clockSeconds(st.clock)
    const total = 90 * 60
    const played = Math.min(total, (period - 1) * 45 * 60 + Math.min(elapsed, 45 * 60 + 8 * 60))
    return Math.max(0.01, 1 - played / total)
  }
  secsLeft = Math.min(len, secsLeft)
  const remaining = (reg - period) * len + secsLeft
  return Math.max(0.01, Math.min(1, remaining / (reg * len)))
}

export interface LiveModel {
  t: number
  homeScore: number
  awayScore: number
  expMargin: number
  sigmaMargin: number
  expTotal: number
  sigmaTotal: number
}

export function liveModel(ev: GameEvent, league: LeagueDef, pregame: GameLines): LiveModel {
  const t = fractionRemaining(ev, league)
  const homeScore = ev.home.score
  const awayScore = ev.away.score
  const margin = homeScore - awayScore
  const preSpread = pregame.spread ?? 0
  const preTotal = pregame.total ?? (league.sport === 'football' ? 44 : league.sport === 'basketball' ? 220 : 5.5)
  const expMargin = margin + -preSpread * t
  const sigmaMargin = Math.max(0.35, marginSigma(league) * Math.sqrt(t))
  const expTotal = homeScore + awayScore + preTotal * t
  const sigmaTotal = Math.max(0.35, totalSigma(league) * Math.sqrt(t))
  return { t, homeScore, awayScore, expMargin, sigmaMargin, expTotal, sigmaTotal }
}

/** Live lines derived from the live model. */
export function liveLines(ev: GameEvent, league: LeagueDef, pregame: GameLines): GameLines {
  const m = liveModel(ev, league, pregame)
  const pHome = normCdf(m.expMargin / m.sigmaMargin)
  const out: GameLines = { provider: 'FakeDuel Live', synthesized: true }
  out.homeML = priceFromProb(pHome, 0.06)
  out.awayML = priceFromProb(1 - pHome, 0.06)
  if (league.hasDraw) {
    const pDraw = Math.max(0.03, 0.28 * Math.sqrt(m.t) * (1 - Math.abs(pHome - 0.5)))
    const s = 1 + pDraw
    out.homeML = priceFromProb(pHome / s, 0.06)
    out.awayML = priceFromProb((1 - pHome) / s, 0.06)
    out.drawML = priceFromProb(pDraw / s, 0.06)
  }
  if (pregame.spread !== undefined) {
    const spread = league.sport === 'hockey' || league.sport === 'baseball' || league.sport === 'soccer' ? (m.expMargin >= 0 ? -1.5 : 1.5) : roundHalf(-m.expMargin)
    out.spread = spread
    const pCover = 1 - normCdf((-spread - m.expMargin) / m.sigmaMargin)
    out.homeSpreadOdds = priceFromProb(pCover, 0.05)
    out.awaySpreadOdds = priceFromProb(1 - pCover, 0.05)
  }
  if (pregame.total !== undefined) {
    const total = toHalfLine(Math.max(m.homeScore + m.awayScore + 0.5, m.expTotal))
    out.total = total
    const pOver = 1 - normCdf((total - m.expTotal) / m.sigmaTotal)
    out.overOdds = priceFromProb(pOver, 0.05)
    out.underOdds = priceFromProb(1 - pOver, 0.05)
  }
  return out
}

/** Probability that a leg wins given the current event state (used for cash out). */
export function legWinProbability(leg: BetLeg, ev: GameEvent | null, league: LeagueDef | undefined, pregame: GameLines | undefined): number {
  if (leg.status === 'won') return 1
  if (leg.status === 'lost') return 0
  if (leg.status === 'push' || leg.status === 'void') return 1
  const implied = impliedProb(leg.odds) / 1.045
  if (!ev || !league || ev.status.state === 'pre') return Math.min(0.97, implied)
  if (ev.status.state === 'post') return implied
  const m = liveModel(ev, league, pregame ?? { provider: "none", synthesized: true })
  const g: Grading = leg.grading
  const homeSide = g.side === 'home' || (g.teamId && g.teamId === ev.home.team.id && g.side !== 'away')
  switch (g.kind) {
    case 'moneyline':
    case 'draw_no_bet': {
      const pHome = normCdf(m.expMargin / m.sigmaMargin)
      return homeSide ? pHome : 1 - pHome
    }
    case 'draw':
      return Math.max(0.02, 0.28 * Math.sqrt(m.t) * (1 - Math.abs(normCdf(m.expMargin / m.sigmaMargin) - 0.5)))
    case 'spread': {
      const line = g.line ?? 0
      // side covers if (their margin + line) > 0
      const exp = homeSide ? m.expMargin : -m.expMargin
      return 1 - normCdf((-line - exp) / m.sigmaMargin)
    }
    case 'total': {
      const line = g.line ?? m.expTotal
      const pOver = 1 - normCdf((line - m.expTotal) / m.sigmaTotal)
      return g.side === 'over' ? pOver : 1 - pOver
    }
    case 'team_total': {
      const line = g.line ?? 0
      const isHome = g.teamId === ev.home.team.id
      const cur = isHome ? m.homeScore : m.awayScore
      const share = isHome ? (pregame?.total ?? 0) / 2 - (pregame?.spread ?? 0) / 2 : (pregame?.total ?? 0) / 2 + (pregame?.spread ?? 0) / 2
      const exp = cur + share * m.t
      const sig = Math.max(0.3, m.sigmaTotal * 0.75)
      const pOver = 1 - normCdf((line - exp) / sig)
      return g.side === 'over' ? pOver : 1 - pOver
    }
    default: {
      // props and period markets: blend implied with time remaining
      return Math.min(0.97, implied * (0.6 + 0.4 * m.t) + (1 - m.t) * 0.02)
    }
  }
}
