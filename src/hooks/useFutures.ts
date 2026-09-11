import { useCallback, useEffect, useState } from 'react'
import type { LeagueDef } from '@/data/sports'
import { fetchAthlete, fetchFutures, fetchTeams, seasonYearFor, type RawFuture } from '@/lib/espn'
import type { Future, FutureEntry, GameEvent, Market, Selection, Team } from '@/lib/types'

export interface FuturesResult {
  futures: Future[]
  loading: boolean
  resolveNames: (futureId: string) => Promise<void>
}

function sortEntries(a: FutureEntry, b: FutureEntry): number {
  const da = a.odds > 0 ? 1 + a.odds / 100 : 1 + 100 / Math.abs(a.odds)
  const db = b.odds > 0 ? 1 + b.odds / 100 : 1 + 100 / Math.abs(b.odds)
  return da - db
}

function toFutures(raw: RawFuture[], league: LeagueDef, teams: Record<string, Team>, names: Record<string, { name: string; headshot?: string }>): Future[] {
  return raw.map((f) => ({
    id: f.id,
    leagueId: league.id,
    sport: league.sport,
    name: f.name,
    entries: f.books
      .map((b) => {
        if (b.teamId) {
          const t = teams[b.teamId]
          return { id: `t${b.teamId}`, label: t?.displayName ?? `Team ${b.teamId}`, odds: b.odds, teamId: b.teamId, logo: t?.logo } as FutureEntry
        }
        const n = b.athleteId ? names[b.athleteId] : undefined
        return { id: `a${b.athleteId}`, label: n?.name ?? '', odds: b.odds, athleteId: b.athleteId, logo: n?.headshot } as FutureEntry
      })
      .sort(sortEntries),
  }))
}

export function useFutures(league: LeagueDef | undefined, enabled = true): FuturesResult {
  const [raw, setRaw] = useState<RawFuture[]>([])
  const [teams, setTeams] = useState<Record<string, Team>>({})
  const [names, setNames] = useState<Record<string, { name: string; headshot?: string }>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!league || !enabled) return
    let alive = true
    setLoading(true)
    ;(async () => {
      const season = seasonYearFor(league)
      let r = await fetchFutures(league, season)
      if (!r.length && season !== new Date().getFullYear()) r = await fetchFutures(league, new Date().getFullYear())
      const t = await fetchTeams(league)
      if (!alive) return
      setRaw(r)
      setTeams(t)
      setLoading(false)
    })()
    return () => {
      alive = false
    }
  }, [league, enabled])

  const resolveNames = useCallback(
    async (futureId: string) => {
      if (!league) return
      const f = raw.find((x) => x.id === futureId)
      if (!f) return
      const ids = f.books.map((b) => b.athleteId).filter((x): x is string => !!x && !names[x]).slice(0, 40)
      if (!ids.length) return
      const season = seasonYearFor(league)
      const found = await Promise.all(ids.map((id) => fetchAthlete(league, id, season)))
      setNames((prev) => {
        const next = { ...prev }
        for (const a of found) if (a) next[a.id] = { name: a.name, headshot: a.headshot }
        return next
      })
    },
    [league, raw, names],
  )

  return { futures: league ? toFutures(raw, league, teams, names) : [], loading, resolveNames }
}

/** Pseudo-event + market so futures can flow through the normal betslip. */
export function futureToMarket(f: Future, league: LeagueDef): { event: GameEvent; market: Market } {
  const date = new Date(Date.now() + 120 * 86400_000).toISOString()
  const dummy: Team = { id: '0', abbreviation: league.name, name: f.name, displayName: f.name, shortDisplayName: f.name }
  const event: GameEvent = {
    id: `future:${league.id}:${f.id}`,
    leagueId: league.id,
    sport: league.sport,
    name: f.name,
    shortName: f.name,
    date,
    status: { state: 'pre', completed: false, period: 0, clock: '', detail: 'Futures', shortDetail: 'Futures', name: 'STATUS_SCHEDULED' },
    home: { team: dummy, homeAway: 'home', score: 0 },
    away: { team: dummy, homeAway: 'away', score: 0 },
  }
  const market: Market = {
    id: `${event.id}|futures`,
    eventId: event.id,
    leagueId: league.id,
    name: f.name,
    group: 'futures',
    kind: 'futures',
    layout: 'list',
    sgp: false,
    selections: f.entries
      .filter((e) => e.label)
      .map(
        (e): Selection => ({
          id: `${event.id}|futures|${e.id}`,
          marketId: `${event.id}|futures`,
          eventId: event.id,
          leagueId: league.id,
          label: e.label,
          sub: f.name,
          odds: e.odds,
          grading: { kind: 'futures', futureId: f.id, teamId: e.teamId, playerId: e.athleteId },
          teamId: e.teamId,
          playerId: e.athleteId,
        }),
      ),
  }
  return { event, market }
}
