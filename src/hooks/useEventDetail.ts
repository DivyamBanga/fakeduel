import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LEAGUE_BY_ID, type LeagueDef } from '@/data/sports'
import { fetchAthlete, fetchCoreOdds, fetchPropBets, fetchRoster, fetchSummary, fetchTeamLeaders, seasonYearFor, type EventSummary, type RawPropBet } from '@/lib/espn'
import { getDisplayLines } from '@/lib/lines'
import { buildAltMarkets, buildGameMarkets, buildPeriodMarkets, buildSpecials, buildTeamTotals } from '@/lib/markets'
import { buildPropMarkets, buildQuickBets, realPeriodLines, type TeamLeaders } from '@/lib/props'
import type { AthleteInfo, GameEvent, GameLines, Market } from '@/lib/types'
import { useLiveStore } from '@/store/live'
import { useOddsStore } from '@/store/odds'
import { useSettings } from '@/store/settings'
import { fetchEventMarkets, fetchEventsList, fetchFeatured, linesFromFeatured, matchEvent, oddsApiEnabled, PROP_MARKET_GROUPS } from '@/lib/oddsapi'
import { marketsFromOa, mergeMarkets } from '@/lib/oamarkets'
import type { OaMarket } from '@/lib/oddsapi'

export interface EventDetail {
  league: LeagueDef | undefined
  event: GameEvent | null
  summary: EventSummary | null
  lines: GameLines | null
  live: boolean
  markets: Market[]
  loading: boolean
  propsLoading: boolean
  error: string | null
  refresh: () => void
  fanduel: boolean
  loadFanDuelTab: (tab: string) => void
  fdLoadingTab: string | null
}

function gamesFromRecord(record?: string): number | undefined {
  if (!record) return undefined
  const nums = record.split('-').map((x) => parseInt(x, 10)).filter((n) => isFinite(n))
  if (!nums.length) return undefined
  const s = nums.reduce((a, b) => a + b, 0)
  return s > 0 ? s : undefined
}

export function useEventDetail(leagueId: string | undefined, eventId: string | undefined): EventDetail {
  const league = leagueId ? LEAGUE_BY_ID[leagueId] : undefined
  const [summary, setSummary] = useState<EventSummary | null>(null)
  const [coreLines, setCoreLines] = useState<GameLines | undefined>(undefined)
  const [raw, setRaw] = useState<RawPropBet[]>([])
  const [athletes, setAthletes] = useState<Record<string, AthleteInfo>>({})
  const [leaders, setLeaders] = useState<TeamLeaders[]>([])
  const [loading, setLoading] = useState(true)
  const [propsLoading, setPropsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const setStoreSummary = useLiveStore((s) => s.setSummary)
  const gen = useRef(0)
  const [oaId, setOaId] = useState<string | null>(null)
  const [oaMarkets, setOaMarkets] = useState<Record<string, OaMarket>>({})
  const [fdLoadingTab, setFdLoadingTab] = useState<string | null>(null)
  const apiKey = useSettings((s) => s.oddsApiKey)
  const useFd = useSettings((s) => s.useFanDuelPrices)
  const fdLines = useOddsStore((s) => (eventId ? s.lines[eventId] : undefined))

  const load = useCallback(
    async (force = false) => {
      if (!league || !eventId) return
      const my = ++gen.current
      try {
        const s = await fetchSummary(league, eventId, { force })
        if (gen.current !== my) return
        setSummary(s)
        setStoreSummary(eventId, s)
        setError(null)
        setLoading(false)
        const ev = s.event
        if (!ev) return
        // odds + props + rosters + leaders in parallel
        setPropsLoading(true)
        const [core, rosterA, rosterH] = await Promise.all([
          fetchCoreOdds(league, eventId),
          league.athleteEvent ? Promise.resolve([]) : fetchRoster(league, ev.away.team.id),
          league.athleteEvent ? Promise.resolve([]) : fetchRoster(league, ev.home.team.id),
        ])
        if (gen.current !== my) return
        if (core.lines) setCoreLines(core.lines)
        const props = core.propBetsRef ? await fetchPropBets(league, eventId, core.propBetsRef) : []
        if (gen.current !== my) return
        setRaw(props)
        const map: Record<string, AthleteInfo> = {}
        for (const a of [...rosterA, ...rosterH]) map[a.id] = a
        for (const r of s.rosters) for (const a of r.athletes) map[a.id] = { ...a, ...(map[a.id] ?? {}) }
        // resolve any prop athletes missing from rosters
        const missing = [...new Set(props.map((p) => p.athleteId).filter((id): id is string => !!id && !map[id]))].slice(0, 60)
        if (missing.length) {
          const found = await Promise.all(missing.map((id) => fetchAthlete(league, id, seasonYearFor(league))))
          for (const a of found) if (a) map[a.id] = a
        }
        if (gen.current !== my) return
        // leaders (for synthesized props + scorer markets)
        if (!league.athleteEvent) {
          const season = seasonYearFor(league)
          const fetchL = async (teamId: string, record?: string): Promise<TeamLeaders> => {
            let l = await fetchTeamLeaders(league, teamId, season)
            if (!Object.keys(l.categories).length) l = await fetchTeamLeaders(league, teamId, season - 1)
            return { teamId, categories: l.categories, gamesPlayed: gamesFromRecord(record) }
          }
          const ls = await Promise.all([fetchL(ev.away.team.id, ev.away.team.record), fetchL(ev.home.team.id, ev.home.team.record)])
          if (gen.current !== my) return
          // resolve leader athletes missing from the map (limit)
          const need = [...new Set(ls.flatMap((l) => Object.values(l.categories).flatMap((c) => c.slice(0, 8).map((x) => x.athleteId))))].filter((id) => !map[id]).slice(0, 40)
          if (need.length) {
            const found = await Promise.all(need.map((id) => fetchAthlete(league, id, season)))
            for (const a of found) if (a) map[a.id] = { ...a, teamId: a.teamId ?? ls.find((l) => Object.values(l.categories).some((c) => c.some((x) => x.athleteId === a.id)))?.teamId }
          }
          if (gen.current !== my) return
          setLeaders(ls)
        }
        setAthletes(map)
        if (oddsApiEnabled() && ev.status.state === 'pre') {
          try {
            const known = useOddsStore.getState().oaIds[eventId]
            if (known) setOaId(known)
            else {
              const list = await fetchEventsList(league)
              const oa = matchEvent(ev, list)
              if (oa) setOaId(oa.id)
            }
            if (!useOddsStore.getState().lines[eventId]) {
              const feat = await fetchFeatured(league)
              const oa = matchEvent(ev, feat)
              if (oa) {
                const l = linesFromFeatured(ev, oa)
                useOddsStore.getState().setLeague(league.id, l ? { [eventId]: l } : {}, { [eventId]: oa.id })
                setOaId(oa.id)
              }
            }
          } catch {
            /* models remain */
          }
        }
      } catch (e) {
        if (gen.current !== my) return
        setError((e as Error).message)
        setLoading(false)
      } finally {
        if (gen.current === my) setPropsLoading(false)
      }
    },
    [league, eventId, setStoreSummary],
  )

  useEffect(() => {
    setLoading(true)
    setSummary(null)
    setRaw([])
    setAthletes({})
    setLeaders([])
    setCoreLines(undefined)
    setOaId(null)
    setOaMarkets({})
    load()
  }, [load])

  const loadFanDuelTab = useCallback(
    async (tab: string) => {
      if (!league || !oaId || !oddsApiEnabled()) return
      const groups = PROP_MARKET_GROUPS[league.sport] ?? {}
      const keys = groups[tab] ?? (tab === 'Popular' || tab === 'Same Game Parlay™' ? [...(groups['Alternates'] ?? []), ...(groups['Scoring'] ?? [])] : [])
      const missing = keys.filter((k) => !(k in oaMarkets))
      if (!missing.length) return
      setFdLoadingTab(tab)
      try {
        const got = await fetchEventMarkets(league, oaId, missing)
        setOaMarkets((prev) => {
          const next = { ...prev }
          for (const k of missing) next[k] = got[k] ?? { key: k, outcomes: [] }
          return next
        })
      } finally {
        setFdLoadingTab(null)
      }
    },
    [league, oaId, oaMarkets],
  )

  // live polling
  const state = summary?.event?.status.state
  useEffect(() => {
    if (!summary?.event) return
    const interval = state === 'in' ? 20_000 : state === 'pre' ? 120_000 : 0
    if (!interval) return
    const t = window.setInterval(async () => {
      if (!league || !eventId) return
      const s = await fetchSummary(league, eventId, { force: true }).catch(() => null)
      if (s) {
        setSummary(s)
        setStoreSummary(eventId, s)
      }
    }, interval)
    return () => window.clearInterval(t)
  }, [summary?.event, state, league, eventId, setStoreSummary])

  const event = useMemo(() => {
    const ev = summary?.event ?? null
    if (!ev) return null
    if (coreLines && !ev.lines) return { ...ev, lines: coreLines }
    if (coreLines && ev.lines) return { ...ev, lines: { ...ev.lines, ...coreLines } }
    return ev
  }, [summary, coreLines])

  const built = useMemo(() => {
    if (!event || !league) return { lines: null, live: false, markets: [] as Market[] }
    const { lines, live, pregame } = getDisplayLines(event, league)
    const markets: Market[] = []
    const game = buildGameMarkets(event, league, lines)
    for (const m of [game.spread, game.moneyline, game.threeWay, game.dnb, game.total]) if (m) markets.push(m)
    if (!live) {
      const real = realPeriodLines(raw, event)
      markets.push(...buildAltMarkets(event, league, pregame))
      markets.push(...buildTeamTotals(event, league, pregame, real.teamTotals))
      markets.push(...buildPeriodMarkets(event, league, pregame, real))
      markets.push(...buildSpecials(event, league, pregame))
      const props = buildPropMarkets({ ev: event, league, lines: pregame, raw, athletes, leaders, probables: event.probables })
      markets.push(...props)
      const quick = buildQuickBets(event, props)
      if (quick.selections.length) markets.push(quick)
      const fd = marketsFromOa(event, league, oaMarkets, athletes)
      return { lines, live, markets: mergeMarkets(markets, fd) }
    } else {
      markets.push(...buildTeamTotals(event, league, lines))
    }
    return { lines, live, markets }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, league, raw, athletes, leaders, oaMarkets, fdLines, apiKey, useFd])

  return { league, event, summary, lines: built.lines, live: built.live, markets: built.markets, loading, propsLoading, error, refresh: () => load(true), fanduel: !!oaId, loadFanDuelTab, fdLoadingTab }
}
