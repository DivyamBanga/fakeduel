import { useEffect } from 'react'
import { LEAGUE_BY_ID } from '@/data/sports'
import { fetchLeagueEvents } from '@/lib/espn'
import { useLiveStore } from '@/store/live'

const LEAGUES = ['nfl', 'ncaaf', 'mlb', 'nba', 'wnba', 'nhl', 'epl', 'laliga', 'seriea', 'mls', 'ucl', 'ufc']
const INTERVAL = 3 * 60_000

/** Keeps the "Live now" badge count fresh in the background. */
export function useLiveCount() {
  const setLiveCount = useLiveStore((s) => s.setLiveCount)
  const setEvents = useLiveStore((s) => s.setEvents)
  useEffect(() => {
    let alive = true
    const run = async () => {
      const results = await Promise.all(LEAGUES.map((id) => fetchLeagueEvents(LEAGUE_BY_ID[id]).catch(() => [])))
      if (!alive) return
      const all = results.flat()
      setEvents(all)
      setLiveCount(all.filter((e) => e.status.state === 'in').length)
    }
    const t = window.setTimeout(run, 2500)
    const i = window.setInterval(run, INTERVAL)
    return () => {
      alive = false
      window.clearTimeout(t)
      window.clearInterval(i)
    }
  }, [setLiveCount, setEvents])
}
