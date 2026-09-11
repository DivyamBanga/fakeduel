import { useEffect, useMemo, useState } from 'react'
import { ColumnHeader, EventList } from '@/components/bet/EventList'
import { Card, EmptyState, SectionHeader } from '@/components/shell/SectionHeader'
import { SportChips } from '@/components/shell/SportChips'
import { LEAGUE_BY_ID, LEAGUES } from '@/data/sports'
import { useLeagueEvents } from '@/hooks/useLeagueEvents'
import { useIsDesktop } from '@/hooks/useMediaQuery'
import { useLiveStore } from '@/store/live'

export const LIVE_LEAGUES = ['nfl', 'ncaaf', 'mlb', 'nba', 'wnba', 'nhl', 'epl', 'laliga', 'seriea', 'mls', 'ucl', 'ufc']

export function LivePage() {
  const desktop = useIsDesktop()
  const { events, loading } = useLeagueEvents(LIVE_LEAGUES)
  const setLiveCount = useLiveStore((s) => s.setLiveCount)
  const live = useMemo(() => events.filter((e) => e.status.state === 'in'), [events])
  const upcomingSoon = useMemo(() => events.filter((e) => e.status.state === 'pre' && new Date(e.date).getTime() - Date.now() < 3 * 3600_000).slice(0, 10), [events])
  useEffect(() => setLiveCount(live.length), [live.length, setLiveCount])
  const sports = useMemo(() => {
    const ids = [...new Set(live.map((e) => e.leagueId))]
    return ids.map((id) => ({ id, label: LEAGUE_BY_ID[id]?.name ?? id }))
  }, [live])
  const [chip, setChip] = useState('all')
  const shown = chip === 'all' ? live : live.filter((e) => e.leagueId === chip)
  const byLeague = LEAGUES.filter((l) => shown.some((e) => e.leagueId === l.id))
  return (
    <div>
      <h1 className="text-[20px] font-bold mt-2 mb-2 px-4 lg:px-0 flex items-center gap-2" style={{ color: 'var(--fd-fg)' }}>
        <span className="live-dot w-2.5 h-2.5 rounded-full" style={{ background: '#d22839' }} /> Live now
      </h1>
      {sports.length > 1 ? (
        <div className="mb-3 rounded-md overflow-hidden">
          <SportChips chips={[{ id: 'all', label: 'All' }, ...sports]} active={chip} onSelect={setChip} sticky={!desktop} />
        </div>
      ) : null}
      {loading && !events.length ? (
        <div className="p-4 space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-[120px]" />
          ))}
        </div>
      ) : !live.length ? (
        <Card>
          <EmptyState title="No live events right now" body="Games will appear here as soon as they kick off. Here's what's starting soon:" />
          {upcomingSoon.length ? <EventList events={upcomingSoon} showLeague /> : null}
        </Card>
      ) : (
        byLeague.map((l) => (
          <Card key={l.id}>
            <SectionHeader title={`${l.longName} · Live`} to={`/navigation/${l.id}`} />
            <ColumnHeader league={l} label={l.name} />
            <EventList events={shown.filter((e) => e.leagueId === l.id)} league={l} groupByDay={false} />
          </Card>
        ))
      )}
    </div>
  )
}
