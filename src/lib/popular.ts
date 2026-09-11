import type { LeagueDef } from '@/data/sports'
import { toSlipSelection } from '@/hooks/useSlip'
import { sgpDecimal } from './bets'
import { getPregameLines } from './lines'
import { buildGameMarkets, buildTeamTotals } from './markets'
import { decimalToAmerican, seededRandom } from './odds'
import type { GameEvent, Market, Selection } from './types'
import type { SlipSelection } from '@/store/betslip'

export interface PopularSgp {
  event: GameEvent
  league: LeagueDef
  legs: { market: Market; selection: Selection }[]
  slip: SlipSelection[]
  odds: number
  description: string
  betsPlaced: number
}

/** A plausible "Popular Same Game Parlay" built from the main lines of an upcoming game. */
export function buildPopularSgp(ev: GameEvent, league: LeagueDef): PopularSgp | null {
  if (league.athleteEvent || ev.status.state !== 'pre') return null
  const rnd = seededRandom(`popsgp:${ev.id}`)
  const lines = getPregameLines(ev, league)
  const g = buildGameMarkets(ev, league, lines)
  const legs: { market: Market; selection: Selection }[] = []
  const spread = lines.spread ?? 0
  const favHome = spread < 0
  const fav = favHome ? ev.home : ev.away
  const ml = g.moneyline ?? g.threeWay
  const favSel = (m: Market | undefined) => m?.selections.find((s) => s.grading.side === (favHome ? 'home' : 'away'))
  const bigFav = Math.abs(spread) >= 6.5
  if (g.spread && !bigFav) {
    const s = favSel(g.spread)
    if (s) legs.push({ market: g.spread, selection: s })
  } else if (ml) {
    const s = favSel(ml)
    if (s) legs.push({ market: ml, selection: s })
  }
  const over = rnd() > 0.35
  if (g.total) {
    const s = g.total.selections.find((x) => x.grading.side === (over ? 'over' : 'under'))
    if (s) legs.push({ market: g.total, selection: s })
  }
  const tt = buildTeamTotals(ev, league, lines)
  const favTT = tt.find((m) => m.id.endsWith(`|${fav.team.id}`))
  if (favTT && rnd() > 0.5) {
    const s = favTT.selections.find((x) => x.grading.side === (over ? 'over' : 'under'))
    if (s) legs.push({ market: favTT, selection: s })
  }
  if (legs.length < 2) return null
  const slip = legs.map((l) => toSlipSelection(ev, l.market, l.selection))
  const dec = sgpDecimal(slip)
  const total = lines.total
  const description = over
    ? `${fav.team.shortDisplayName} handle business in a ${total ? `game that clears ${total} points` : 'high-scoring game'}`
    : `${fav.team.shortDisplayName} grind out a win in a ${total ? `game that stays under ${total}` : 'low-scoring affair'}`
  return { event: ev, league, legs, slip, odds: decimalToAmerican(dec), description, betsPlaced: 350 + Math.floor(rnd() * 1400) }
}
