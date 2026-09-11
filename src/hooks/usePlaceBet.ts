import { useCallback, useMemo } from 'react'
import { analyzeSlip, buildParlay, buildRoundRobin, buildSingle, buildTeaser, roundRobinInfo, tokenApplies, type SlipAnalysis } from '@/lib/bets'
import { round2 } from '@/lib/odds'
import type { Bet, PromoToken } from '@/lib/types'
import { useAccount } from '@/store/account'
import { useBetslip } from '@/store/betslip'
import { useSettings } from '@/store/settings'

export interface PlaceBetPlan {
  analysis: SlipAnalysis
  bets: Bet[]
  totalWager: number
  totalPayout: number
  canPlace: boolean
  reason: string | null
  boost: PromoToken | null
  noSweat: PromoToken | null
  eligibleBoosts: PromoToken[]
  eligibleNoSweat: PromoToken[]
}

export function usePlaceBet() {
  const slip = useBetslip()
  const tokens = useAccount((s) => s.tokens)
  const balance = useAccount((s) => s.balance)
  const bonusBalance = useAccount((s) => s.bonusBalance)
  const placeBets = useAccount((s) => s.placeBets)
  const useToken = useAccount((s) => s.useToken)
  const keep = useSettings((s) => s.keepSelectionsAfterBet)

  const plan = useMemo<PlaceBetPlan>(() => {
    const analysis = analyzeSlip(slip.selections, slip.rrDisabled)
    const bets: Bet[] = []
    const active = tokens.filter((t) => !t.used && new Date(t.expiresAt).getTime() > Date.now())
    const primaryType = slip.mode === 'teaser' ? 'teaser' : slip.mode === 'roundrobin' ? 'round_robin' : analysis.canParlay && slip.parlayStake > 0 ? analysis.parlayType : 'single'
    const primaryLegs = primaryType === 'single' ? 1 : analysis.legCount
    const primaryStake = primaryType === 'single' ? Math.max(0, ...slip.selections.map((s) => slip.stakes[s.selection.id] ?? 0)) : slip.mode === 'teaser' ? slip.teaserStake : slip.parlayStake
    const ctx = { type: primaryType, legs: primaryLegs, live: analysis.hasLive, stake: primaryStake, leagueId: slip.selections[0]?.event.leagueId }
    const eligibleBoosts = active.filter((t) => t.kind === 'profit_boost' && tokenApplies(t, ctx))
    const eligibleNoSweat = active.filter((t) => t.kind === 'no_sweat' && tokenApplies(t, ctx))
    const boost = eligibleBoosts.find((t) => t.id === slip.boostTokenId) ?? null
    const noSweat = eligibleNoSweat.find((t) => t.id === slip.noSweatTokenId) ?? null
    let boostUsed = false
    let nsUsed = false
    const opts = (isPrimary: boolean) => {
      const o = { boost: isPrimary && !boostUsed ? boost : null, noSweat: isPrimary && !nsUsed ? noSweat : null, bonusBet: slip.useBonusBet }
      if (o.boost) boostUsed = true
      if (o.noSweat) nsUsed = true
      return o
    }
    if (slip.mode === 'betslip') {
      if (analysis.canParlay && slip.parlayStake > 0) bets.push(buildParlay(analysis, slip.parlayStake, opts(true)))
      for (const u of analysis.units) {
        const st = slip.sgpStakes[u.eventId] ?? 0
        if (u.isSgp && st > 0 && analysis.units.length > 1) bets.push(buildParlay(analyzeSlip(u.legs), st, opts(false)))
      }
      for (const s of slip.selections) {
        const st = slip.stakes[s.selection.id] ?? 0
        if (st > 0 && !analysis.conflicts.has(s.selection.id)) bets.push(buildSingle(s, st, opts(primaryType === 'single')))
      }
    } else if (slip.mode === 'roundrobin') {
      for (const size of analysis.rrSizes) {
        const st = slip.rrStakes[size] ?? 0
        if (st > 0 && roundRobinInfo(analysis, size, slip.rrDisabled).wagers > 0) bets.push(buildRoundRobin(analysis, size, st, slip.rrDisabled, opts(true)))
      }
      if (analysis.canParlay && slip.parlayStake > 0) bets.push(buildParlay(analysis, slip.parlayStake, opts(true)))
    } else if (slip.mode === 'teaser' && analysis.teaserEligible && analysis.teaserSport && slip.teaserStake > 0) {
      const b = buildTeaser(slip.selections, analysis.teaserSport, slip.teaserPoints, slip.teaserStake, opts(true))
      if (b) bets.push(b)
    }
    const totalWager = round2(bets.reduce((a, b) => a + b.stake * (b.rrCombos ?? 1), 0))
    const totalPayout = round2(bets.reduce((a, b) => a + b.potentialPayout, 0))
    let reason: string | null = null
    if (!slip.selections.length) reason = 'Add selections to place bet'
    else if (analysis.conflicts.size) reason = 'Selections from the same market cannot be combined'
    else if (!bets.length) reason = 'Enter wager to place bet'
    else if (slip.useBonusBet ? totalWager > bonusBalance + 1e-9 : totalWager > balance + 1e-9) reason = 'Insufficient funds'
    else if (bets.some((b) => b.stake < 0.1)) reason = 'Minimum wager is $0.10'
    return { analysis, bets, totalWager, totalPayout, canPlace: !reason, reason, boost, noSweat, eligibleBoosts, eligibleNoSweat }
  }, [slip.selections, slip.stakes, slip.sgpStakes, slip.parlayStake, slip.rrStakes, slip.rrDisabled, slip.mode, slip.teaserStake, slip.teaserPoints, slip.boostTokenId, slip.noSweatTokenId, slip.useBonusBet, tokens, balance, bonusBalance])

  const place = useCallback(() => {
    if (!plan.canPlace) return false
    const ok = placeBets(plan.bets, { bonusBet: slip.useBonusBet })
    if (!ok) return false
    const boosted = plan.bets.find((b) => b.boostPct)
    if (plan.boost && boosted) useToken(plan.boost.id, boosted.id)
    const ns = plan.bets.find((b) => b.noSweat)
    if (plan.noSweat && ns) useToken(plan.noSweat.id, ns.id)
    slip.setReceipt({ betIds: plan.bets.map((b) => b.id), at: Date.now() })
    if (!keep) {
      useBetslip.setState({ selections: [], stakes: {}, sgpStakes: {}, parlayStake: 0, rrStakes: {}, teaserStake: 0, mode: 'betslip', boostTokenId: null, noSweatTokenId: null, useBonusBet: false, rrDisabled: {} })
    } else {
      useBetslip.setState({ stakes: {}, sgpStakes: {}, parlayStake: 0, rrStakes: {}, teaserStake: 0, boostTokenId: null, noSweatTokenId: null })
    }
    return true
  }, [plan, placeBets, slip, useToken, keep])

  return { plan, place }
}
