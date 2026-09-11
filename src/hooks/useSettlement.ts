import { useEffect, useRef } from 'react'
import { LEAGUE_BY_ID } from '@/data/sports'
import { fetchSummary } from '@/lib/espn'
import { computeBetOutcome, gradeLeg } from '@/lib/grading'
import type { Bet } from '@/lib/types'
import { useAccount } from '@/store/account'
import { useLiveStore } from '@/store/live'

const POLL = 60_000

/** Periodically grades open bets against real results and settles them. */
export function useSettlement() {
  const running = useRef(false)

  useEffect(() => {
    const run = async () => {
      if (running.current) return
      running.current = true
      try {
        const { bets, updateBet, settleBet } = useAccount.getState()
        const open = bets.filter((b) => b.status === 'open')
        if (!open.length) return
        const now = Date.now()
        const keys = new Map<string, { leagueId: string; eventId: string }>()
        for (const b of open) for (const l of b.legs) if (l.status === 'open' && l.grading.kind !== 'futures' && new Date(l.startTime).getTime() <= now) keys.set(`${l.leagueId}:${l.eventId}`, { leagueId: l.leagueId, eventId: l.eventId })
        const summaries = new Map<string, Awaited<ReturnType<typeof fetchSummary>>>()
        await Promise.all(
          [...keys.values()].map(async ({ leagueId, eventId }) => {
            const league = LEAGUE_BY_ID[leagueId]
            if (!league) return
            try {
              const s = await fetchSummary(league, eventId)
              summaries.set(`${leagueId}:${eventId}`, s)
              useLiveStore.getState().setSummary(eventId, s)
            } catch {
              /* ignore */
            }
          }),
        )
        for (const bet of open) {
          let changed = false
          const legs = bet.legs.map((l) => {
            if (l.status !== 'open') return l
            const s = summaries.get(`${l.leagueId}:${l.eventId}`)
            const league = LEAGUE_BY_ID[l.leagueId]
            if (!s || !league || !s.event) return l
            const ev = s.event
            const score = `${ev.away.team.abbreviation} ${ev.away.score} - ${ev.home.team.abbreviation} ${ev.home.score}`
            const res = gradeLeg(l, s, league)
            if (res.status === 'open') {
              if (l.score !== score) {
                changed = true
                return { ...l, score }
              }
              return l
            }
            changed = true
            return { ...l, status: res.status, resultText: res.resultText, score }
          })
          if (!changed) continue
          const updated: Bet = { ...bet, legs }
          const outcome = computeBetOutcome(updated)
          if (outcome) {
            updateBet(bet.id, { legs })
            settleBet(bet.id, { status: outcome.status, payout: outcome.payout, rrCombosWon: outcome.rrCombosWon })
          } else {
            updateBet(bet.id, { legs })
          }
        }
      } finally {
        running.current = false
      }
    }
    run()
    const t = window.setInterval(run, POLL)
    const onVis = () => {
      if (document.visibilityState === 'visible') run()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearInterval(t)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])
}
