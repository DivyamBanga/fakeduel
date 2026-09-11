import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { ColumnHeader, EventList } from '@/components/bet/EventList'
import { FutureMarket } from '@/components/bet/FuturesList'
import { PopularSgpCard, ParlayHubLink } from '@/components/bet/PopularSgpCard'
import { PromoCarousel } from '@/components/shell/PromoCarousel'
import { Card, EmptyState, SectionHeader } from '@/components/shell/SectionHeader'
import { SportChips, TextTabs } from '@/components/shell/SportChips'
import { LEAGUE_BY_ID, leaguesForSport, resolveNavSlug, type LeagueDef } from '@/data/sports'
import { useFutures } from '@/hooks/useFutures'
import { useLeagueEvents } from '@/hooks/useLeagueEvents'
import { useIsDesktop } from '@/hooks/useMediaQuery'
import { buildPopularSgp } from '@/lib/popular'

const FALLBACK_TITLES: Record<string, string> = { athletics: 'Athletics', 'aussie-rules': 'Aussie Rules', boxing: 'Boxing', cricket: 'Cricket', darts: 'Darts', handball: 'Handball', lacrosse: 'Lacrosse', 'rugby-league': 'Rugby League', 'rugby-union': 'Rugby Union', snooker: 'Snooker', 'table-tennis': 'Table Tennis' }

function futuresTabName(name: string): string {
  if (/Super Bowl/i.test(name)) return 'Super Bowl'
  if (/World Series/i.test(name)) return 'World Series'
  if (/Stanley Cup/i.test(name)) return 'Stanley Cup'
  if (/Championship Winner|Finals Winner|^NBA Championship|Champion$/i.test(name) && !/Conference|Division/i.test(name)) return 'Championship'
  if (/MVP|Rookie|Player of the Year|Coach of the Year|Comeback|Protector|Cy Young|Sixth|6th Man|Defensive Player/i.test(name)) return 'Awards'
  if (/Division/i.test(name)) return 'Divisions'
  if (/Conference|AFC|NFC|Eastern|Western|League Winner|Pennant/i.test(name)) return 'Conference'
  if (/Wins|Win Total|Most Games/i.test(name)) return 'Win Totals'
  if (/Group/i.test(name)) return 'Groups'
  return 'More Futures'
}

export function LeaguePage() {
  const { slug = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const desktop = useIsDesktop()
  const resolved = resolveNavSlug(slug)
  const league: LeagueDef | undefined = resolved?.kind === 'league' ? resolved.league : undefined
  const sportLeagues = resolved?.kind === 'sport' ? leaguesForSport(resolved.sport.id) : []
  const [subLeague, setSubLeague] = useState('all')
  useEffect(() => setSubLeague('all'), [slug])
  const leagueIds = league ? [league.id] : subLeague === 'all' ? sportLeagues.map((l) => l.id) : [subLeague]
  const { events, loading, error, refresh } = useLeagueEvents(leagueIds, { enabled: leagueIds.length > 0 })
  const futures = useFutures(league, !!league)
  const tab = params.get('tab') ?? 'games'
  const setTab = (t: string) => setParams(t === 'games' ? {} : { tab: t }, { replace: true })
  const title = league ? `${league.name} Betting Odds` : resolved?.kind === 'sport' ? `${resolved.sport.name} Betting Odds` : `${FALLBACK_TITLES[slug] ?? slug} Odds`
  const futuresTabs = useMemo(() => {
    const groups = new Map<string, typeof futures.futures>()
    for (const f of futures.futures) {
      const t = futuresTabName(f.name)
      ;(groups.get(t) ?? groups.set(t, []).get(t)!).push(f)
    }
    const order = ['Super Bowl', 'World Series', 'Stanley Cup', 'Championship', 'Conference', 'Divisions', 'Awards', 'Win Totals', 'Groups', 'More Futures']
    return [...groups.entries()].sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
  }, [futures.futures])
  const upcoming = events.filter((e) => e.status.state !== 'post')
  const sgp = useMemo(() => {
    for (const e of upcoming.slice(0, 5)) {
      const l = LEAGUE_BY_ID[e.leagueId]
      const s = l ? buildPopularSgp(e, l) : null
      if (s) return s
    }
    return null
  }, [upcoming])

  if (!resolved) {
    return (
      <div>
        <h1 className="text-[20px] font-bold text-white mt-2 mb-3 px-4 lg:px-0">{title}</h1>
        <Card>
          <EmptyState title="No events available" body="There are no upcoming events for this sport right now." />
        </Card>
      </div>
    )
  }

  const tabs = [{ id: 'games', label: 'Games' }, ...futuresTabs.map(([name]) => ({ id: `f:${name}`, label: name }))]
  const activeTab = tab === 'futures' ? (tabs[1]?.id ?? 'games') : tabs.some((t) => t.id === tab) ? tab : 'games'
  const activeFutures = activeTab.startsWith('f:') ? futuresTabs.find(([n]) => `f:${n}` === activeTab)?.[1] ?? [] : []

  return (
    <div>
      <h1 className="text-[20px] font-bold mt-2 mb-1 px-4 lg:px-0" style={{ color: 'var(--fd-fg)' }}>
        {title}
      </h1>
      <PromoCarousel />
      {tabs.length > 1 ? <TextTabs tabs={tabs} active={activeTab} onSelect={setTab} /> : null}
      {resolved.kind === 'sport' && sportLeagues.length > 1 ? (
        <div className="mt-2 mb-2 rounded-md overflow-hidden">
          <SportChips chips={[{ id: 'all', label: 'All' }, ...sportLeagues.map((l) => ({ id: l.id, label: l.name }))]} active={subLeague} onSelect={setSubLeague} sticky={!desktop} />
        </div>
      ) : null}
      {activeTab === 'games' ? (
        <div className="mt-3">
          {sgp && league ? (
            <Card>
              <SectionHeader title="Popular Same Game Parlay™ Bets" size="sm" />
              <div className="p-4 pb-2" style={{ background: 'var(--fd-bg)' }}>
                <PopularSgpCard sgp={sgp} />
              </div>
              <ParlayHubLink />
            </Card>
          ) : null}
          {league ? (
            <Card>
              <SectionHeader title={`${league.name} Odds`} />
              <ColumnHeader league={league} label={league.name} />
              <EventList events={upcoming} league={league} loading={loading} error={error} onRetry={refresh} />
            </Card>
          ) : (
            (subLeague === 'all' ? sportLeagues : sportLeagues.filter((l) => l.id === subLeague)).map((l) => {
              const evs = upcoming.filter((e) => e.leagueId === l.id)
              if (!evs.length && !loading) return null
              return (
                <Card key={l.id}>
                  <SectionHeader title={l.longName} to={`/navigation/${l.id}`} />
                  <ColumnHeader league={l} label={l.name} />
                  <EventList events={evs} league={l} loading={loading && !evs.length} />
                </Card>
              )
            })
          )}
          {!league && !loading && !upcoming.length ? (
            <Card>
              <EmptyState title="No events available" body="Check back soon for more betting options." />
            </Card>
          ) : null}
        </div>
      ) : (
        <Card className="mt-3">
          {activeFutures.map((f, i) => (
            <FutureMarket key={f.id} future={f} league={league!} defaultOpen={i === 0} resolveNames={futures.resolveNames} limit={10} />
          ))}
        </Card>
      )}
    </div>
  )
}
