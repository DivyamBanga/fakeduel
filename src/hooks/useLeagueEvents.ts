import { useCallback, useEffect, useRef, useState } from 'react'
import { LEAGUE_BY_ID } from '@/data/sports'
import { fetchLeagueEvents } from '@/lib/espn'
import type { GameEvent } from '@/lib/types'
import { useLiveStore } from '@/store/live'

export interface LeagueEventsResult {
  events: GameEvent[]
  loading: boolean
  error: string | null
  refresh: () => void
  loadedAt: number
}

const LIVE_POLL = 30_000
const IDLE_POLL = 3 * 60_000

export function useLeagueEvents(leagueIds: string[], opts: { enabled?: boolean } = {}): LeagueEventsResult {
  const key = leagueIds.join(',')
  const [events, setEvents] = useState<GameEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loadedAt, setLoadedAt] = useState(0)
  const timer = useRef<number | null>(null)
  const setStoreEvents = useLiveStore((s) => s.setEvents)
  const enabled = opts.enabled ?? true

  const load = useCallback(
    async (force = false) => {
      if (!enabled) return
      const ids = key ? key.split(',') : []
      try {
        const results = await Promise.all(
          ids.map(async (id) => {
            const league = LEAGUE_BY_ID[id]
            if (!league) return []
            try {
              return await fetchLeagueEvents(league, { force })
            } catch {
              return []
            }
          }),
        )
        const all = results.flat().filter((e) => !(e.status.state === 'post' && Date.now() - new Date(e.date).getTime() > 8 * 3600_000))
        all.sort((a, b) => {
          const la = a.status.state === 'in' ? 0 : 1
          const lb = b.status.state === 'in' ? 0 : 1
          if (la !== lb) return la - lb
          return new Date(a.date).getTime() - new Date(b.date).getTime()
        })
        setEvents(all)
        setStoreEvents(all)
        setError(null)
        setLoadedAt(Date.now())
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setLoading(false)
      }
    },
    [key, enabled, setStoreEvents],
  )

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  useEffect(() => {
    if (!enabled) return
    const anyLive = events.some((e) => e.status.state === 'in')
    const interval = anyLive ? LIVE_POLL : IDLE_POLL
    timer.current = window.setInterval(() => load(true), interval)
    return () => {
      if (timer.current) window.clearInterval(timer.current)
    }
  }, [events, load, enabled])

  return { events, loading, error, refresh: () => load(true), loadedAt }
}
