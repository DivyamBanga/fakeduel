import { round2 } from './odds'
import type { Bet, BetLeg } from './types'

const MARGIN = 0.93

/**
 * Cash-out value = potential payout × P(all remaining legs win) × margin.
 * `probFor` returns the current win probability of a leg (1 for won, 0 for lost, null if unknown).
 */
export function cashOutValue(bet: Bet, probFor: (leg: BetLeg) => number | null): number | null {
  if (bet.status !== 'open') return null
  if (bet.type === 'round_robin' || bet.type === 'teaser') return null
  if (bet.legs.some((l) => l.status === 'lost')) return null
  let p = 1
  for (const l of bet.legs) {
    if (l.status === 'won' || l.status === 'push' || l.status === 'void') continue
    const pr = probFor(l)
    if (pr === null) return null
    p *= pr
  }
  const stakeReturn = bet.bonusBet ? 0 : bet.stake
  const value = round2((bet.potentialPayout - (bet.bonusBet ? 0 : 0)) * p * MARGIN)
  if (value < 0.01) return null
  // never offer more than 97% of the potential payout or less than a penny
  return Math.min(value, round2(bet.potentialPayout * 0.97), Math.max(value, stakeReturn * 0.02))
}
