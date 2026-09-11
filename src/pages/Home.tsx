import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EventList, ColumnHeader } from '@/components/bet/EventList'
import { FutureMarket } from '@/components/bet/FuturesList'
import { PopularSgpCard, ParlayHubLink } from '@/components/bet/PopularSgpCard'
import { SportIcon } from '@/components/Icons'
import { PromoCarousel } from '@/components/shell/PromoCarousel'
import { Card, MoreLink, SectionHeader } from '@/components/shell/SectionHeader'
import { SportChips } from '@/components/shell/SportChips'
import { HOME_CHIPS, LEAGUE_BY_ID, MOBILE_ICON_ROW, SPORT_BY_ID } from '@/data/sports'
import { useFutures } from '@/hooks/useFutures'
import { useLeagueEvents } from '@/hooks/useLeagueEvents'
import { useIsDesktop } from '@/hooks/useMediaQuery'
import { buildPopularSgp } from '@/lib/popular'

const CHIP_LABELS: Record<string, string> = { nfl: 'NFL', mlb: 'MLB', nba: 'NBA', nhl: 'NHL', wnba: 'WNBA', soccer: 'Soccer', ncaaf: 'NCAAF', ufc: 'UFC' }

function leagueIdsForChip(chip: string): string[] {
  if (LEAGUE_BY_ID[chip]) return [chip]
  return SPORT_BY_ID[chip]?.leagues.slice(0, 6) ?? []
}

export function HomePage() {
  const desktop = useIsDesktop()
  const [chip, setChip] = useState('nfl')
  const [sgpOpen, setSgpOpen] = useState(true)
  const leagueIds = useMemo(() => leagueIdsForChip(chip), [chip])
  const { events, loading } = useLeagueEvents(leagueIds)
  const league = LEAGUE_BY_ID[chip] ?? LEAGUE_BY_ID[leagueIds[0]]
  const futures = useFutures(LEAGUE_BY_ID[chip], !!LEAGUE_BY_ID[chip])
  const upcoming = events.filter((e) => e.status.state !== 'post')
  const sgp = useMemo(() => {
    for (const e of upcoming.slice(0, 6)) {
      const l = LEAGUE_BY_ID[e.leagueId]
      const s = l ? buildPopularSgp(e, l) : null
      if (s) return s
    }
    return null
  }, [upcoming])
  const seasonLabel = (() => {
    const y = new Date().getFullYear()
    const l = LEAGUE_BY_ID[chip]
    if (!l) return ''
    if (l.id === 'nfl' || l.id === 'nba' || l.id === 'nhl' || l.id === 'ncaaf' || l.id === 'ncaab') return `${y}-${String(y + 1).slice(2)}`
    return `${y}`
  })()
  const champ = futures.futures.find((f) => /Super Bowl|Championship Winner|Finals Winner|World Series|Stanley Cup|Champion$/i.test(f.name)) ?? futures.futures[0]
  const others = futures.futures.filter((f) => f !== champ && /Champion|Conference/i.test(f.name)).slice(0, 2)

  return (
    <div>
      {!desktop ? (
        <div className="no-scrollbar overflow-x-auto hdr-grad -mt-px" style={{ background: 'linear-gradient(180deg,#003d81 0%,#05285a 100%)' }}>
          <div className="flex items-start min-w-max px-3 py-2">
            {MOBILE_ICON_ROW.map((n) => (
              <Link key={n.id} to={n.to} className="flex flex-col items-center w-[52px] mx-1">
                <span className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.12)' }}>
                  <SportIcon id={n.icon} size={26} />
                </span>
                <span className="text-[10px] font-bold text-white mt-1 text-center leading-3">{n.label}</span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
      <PromoCarousel />
      <div className="mb-3 rounded-md overflow-hidden">
        <SportChips chips={HOME_CHIPS.map((c) => ({ id: c, label: CHIP_LABELS[c] ?? c.toUpperCase() }))} active={chip} onSelect={setChip} sticky={!desktop} />
      </div>

      <Card>
        <SectionHeader
          title={
            <span className="flex items-center gap-2">
              <span className="cond font-black italic rounded-[3px] border px-1 text-[10px]" style={{ color: '#ffdc2e', borderColor: '#ffdc2e', background: '#0a2262' }}>
                SGP
              </span>
              Popular Same Game Parlay™ Bets
            </span>
          }
          size="sm"
          collapsible
          open={sgpOpen}
          onToggle={() => setSgpOpen((v) => !v)}
        />
        {sgpOpen ? (
          <div className="p-4 pb-2" style={{ background: 'var(--fd-bg)' }}>
            {sgp ? <PopularSgpCard sgp={sgp} /> : <div className="skeleton h-[220px]" />}
          </div>
        ) : null}
        {sgpOpen ? <ParlayHubLink /> : null}
      </Card>

      {LEAGUE_BY_ID[chip] && champ ? (
        <Card>
          <SectionHeader title={`${league.name} ${seasonLabel} Futures`} />
          <FutureMarket future={champ} league={LEAGUE_BY_ID[chip]} defaultOpen resolveNames={futures.resolveNames} />
          {others.map((f) => (
            <FutureMarket key={f.id} future={f} league={LEAGUE_BY_ID[chip]} resolveNames={futures.resolveNames} />
          ))}
          <Link to={`/navigation/${chip}?tab=futures`} className="flex items-center justify-between h-11 px-4 text-[14px]" style={{ color: 'var(--fd-link)' }}>
            More {league.name}
            <span>›</span>
          </Link>
        </Card>
      ) : null}

      <Card>
        <SectionHeader title={`${LEAGUE_BY_ID[chip]?.name ?? SPORT_BY_ID[chip]?.name ?? ''} Odds`} right={<MoreLink to={`/navigation/${chip}`} label={`More ${LEAGUE_BY_ID[chip]?.name ?? SPORT_BY_ID[chip]?.name ?? ''}`} />} />
        {league ? <ColumnHeader league={league} label={league.name} /> : null}
        <EventList events={upcoming} league={LEAGUE_BY_ID[chip]} loading={loading} limit={desktop ? 12 : 10} showLeague={!LEAGUE_BY_ID[chip]} />
      </Card>
    </div>
  )
}
