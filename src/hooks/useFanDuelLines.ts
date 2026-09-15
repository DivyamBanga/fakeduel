import { useEffect } from 'react'
import { LEAGUE_BY_ID } from '@/data/sports'
import { fetchFeatured, linesFromFeatured, matchEvent, oddsApiEnabled, ODDS_API_SPORT } from '@/lib/oddsapi'
import type { GameEvent, GameLines } from '@/lib/types'
import { useOddsStore } from '@/store/odds'
import { useSettings } from '@/store/settings'

const REFRESH = 20 * 60_000

/** Loads FanDuel's featured lines for every league present in `events` (when an Odds API key is set). */
export function useFanDuelLines(events: GameEvent[]) {
  const key = useSettings((s) => s.oddsApiKey)
  const enabled = useSettings((s) => s.useFanDuelPrices)
  const ids = events
    .filter((e) => e.status.state === 'pre')
    .map((e) => e.id)
    .join(',')
  useEffect(() => {
    if (!oddsApiEnabled() || !ids) return
    let alive = true
    const run = async () => {
      const byLeague = new Map<string, GameEvent[]>()
      for (const e of events) if (e.status.state === 'pre' && ODDS_API_SPORT[e.leagueId]) (byLeague.get(e.leagueId) ?? byLeague.set(e.leagueId, []).get(e.leagueId)!).push(e)
      for (const [leagueId, evs] of byLeague) {
        const league = LEAGUE_BY_ID[leagueId]
        if (!league) continue
        const last = useOddsStore.getState().fetchedAt[leagueId] ?? 0
        if (Date.now() - last < REFRESH && evs.every((e) => useOddsStore.getState().oaIds[e.id] !== undefined)) continue
        const list = await fetchFeatured(league)
        if (!alive || !list.length) continue
        const lines: Record<string, GameLines> = {}
        const oaIds: Record<string, string> = {}
        for (const e of evs) {
          const oa = matchEvent(e, list)
          if (!oa) continue
          oaIds[e.id] = oa.id
          const l = linesFromFeatured(e, oa)
          if (l) lines[e.id] = l
        }
        useOddsStore.getState().setLeague(leagueId, lines, oaIds)
      }
    }
    run()
    const t = window.setInterval(run, REFRESH)
    return () => {
      alive = false
      window.clearInterval(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, key, enabled])
}
