import { useMemo, useState } from 'react'
import { PopularSgpCard } from '@/components/bet/PopularSgpCard'
import { Card, EmptyState } from '@/components/shell/SectionHeader'
import { SportChips } from '@/components/shell/SportChips'
import { LEAGUE_BY_ID, HOME_CHIPS, SPORT_BY_ID } from '@/data/sports'
import { useLeagueEvents } from '@/hooks/useLeagueEvents'
import { useIsDesktop } from '@/hooks/useMediaQuery'
import { buildPopularSgp } from '@/lib/popular'

const LABELS: Record<string, string> = { nfl: 'NFL', mlb: 'MLB', nba: 'NBA', nhl: 'NHL', wnba: 'WNBA', soccer: 'Soccer', ncaaf: 'NCAAF', ufc: 'UFC' }

export function ParlayHubPage() {
  const desktop = useIsDesktop()
  const [chip, setChip] = useState('nfl')
  const ids = LEAGUE_BY_ID[chip] ? [chip] : (SPORT_BY_ID[chip]?.leagues.slice(0, 4) ?? [])
  const { events, loading } = useLeagueEvents(ids)
  const sgps = useMemo(
    () =>
      events
        .filter((e) => e.status.state === 'pre')
        .slice(0, 10)
        .map((e) => (LEAGUE_BY_ID[e.leagueId] ? buildPopularSgp(e, LEAGUE_BY_ID[e.leagueId]) : null))
        .filter((s): s is NonNullable<typeof s> => !!s),
    [events],
  )
  return (
    <div>
      <h1 className="hidden lg:flex items-center gap-2 text-[20px] font-bold mt-2 mb-2" style={{ color: 'var(--fd-fg)' }}>
        <span className="font-black italic" style={{ color: '#64aeff' }}>
          PH
        </span>
        Parlay Hub
      </h1>
      <div className="mb-3 rounded-md overflow-hidden">
        <SportChips chips={HOME_CHIPS.filter((c) => c !== 'ufc').map((c) => ({ id: c, label: LABELS[c] }))} active={chip} onSelect={setChip} sticky={!desktop} />
      </div>
      <div className="px-4 lg:px-0 space-y-3">
        {loading && !sgps.length ? (
          [0, 1, 2].map((i) => <div key={i} className="skeleton h-[260px]" />)
        ) : sgps.length ? (
          sgps.map((s) => <PopularSgpCard key={s.event.id} sgp={s} />)
        ) : (
          <Card>
            <EmptyState title="No parlays available" body="Popular Same Game Parlays appear once upcoming games are posted." />
          </Card>
        )}
      </div>
    </div>
  )
}
