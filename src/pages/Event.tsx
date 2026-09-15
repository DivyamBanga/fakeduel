import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { LiveStatus } from '@/components/bet/EventRow'
import { MarketAccordion, MarketBody } from '@/components/bet/MarketAccordion'
import { OddsButton } from '@/components/bet/OddsButton'
import { PopularSgpCard, ParlayHubLink } from '@/components/bet/PopularSgpCard'
import { TeamLogo } from '@/components/bet/TeamLogo'
import { SgpBadge } from '@/components/Icons'
import { PromoCarousel } from '@/components/shell/PromoCarousel'
import { Card, EmptyState, SectionHeader } from '@/components/shell/SectionHeader'
import { TextTabs } from '@/components/shell/SportChips'
import { SPORT_BY_ID } from '@/data/sports'
import { useEventDetail } from '@/hooks/useEventDetail'
import { useIsDesktop } from '@/hooks/useMediaQuery'
import { useSlip } from '@/hooks/useSlip'
import { formatDateShort, formatTime } from '@/lib/format'
import { spreadLabel, totalLabel } from '@/lib/markets'
import { formatLine } from '@/lib/odds'
import { buildPopularSgp } from '@/lib/popular'
import { FOOTBALL_STATS, BASKETBALL_STATS, HOCKEY_STATS, BASEBALL_STATS, SOCCER_STATS } from '@/lib/props'
import type { Market } from '@/lib/types'
import { catalogTabs } from '@/lib/catalog'

const ALL_STATS = [...FOOTBALL_STATS, ...BASKETBALL_STATS, ...HOCKEY_STATS, ...BASEBALL_STATS, ...SOCCER_STATS]

const TAB_ORDER = ['Same Game Parlay™', 'Popular', 'Quick Bets', 'Passing Props', 'Receiving Props', 'Rushing Props', 'TD Scorer Props', 'Player Points', 'Player Rebounds', 'Player Assists', 'Player Threes', 'Player Combos', 'Player Defense', 'Goal Scorer', 'Player Shots', 'Player Points', 'Goalie Saves', 'Batter Props', 'Pitcher Props', 'Home Run Props', 'Game Specials', 'D/ST', 'Scoring', '1st Quarter', '1st Half', '2nd Half', '2nd Quarter', '3rd Quarter', '4th Quarter', '1st Period', '2nd Period', '3rd Period', '1st Inning', '1st 5 Innings', 'Alternates']

function tabFor(m: Market): string[] {
  if (m.tabs?.length) return m.tabs
  const out = new Set<string>()
  if (m.group === 'game') out.add('Popular')
  if (m.group === 'alt') {
    if (m.kind === 'prop_ladder') {
      const base = m.category?.replace(/^Alt /, '')
      const def = ALL_STATS.find((d) => d.name === base)
      if (def) out.add(def.category)
    } else out.add('Alternates')
  }
  if (m.group === 'team') out.add('Scoring')
  if (m.group === 'periods' && m.category) out.add(m.category)
  if (m.group === 'specials') out.add('Game Specials')
  if (m.group === 'props' && m.category) out.add(m.category)
  if (m.group === 'td' && m.category) out.add(m.category)
  if (m.group === 'popular') out.add('Quick Bets')
  if (m.sgp) out.add('Same Game Parlay™')
  return [...out]
}

export function EventPage() {
  const { leagueId = '', slug = '' } = useParams()
  const eventId = slug.match(/-(\d+)$/)?.[1] ?? slug
  const desktop = useIsDesktop()
  const d = useEventDetail(leagueId, eventId)
  const { has, toggle } = useSlip()
  const ev = d.event
  const league = d.league
  const tabs = useMemo(() => {
    const present = new Set<string>()
    for (const m of d.markets) for (const t of tabFor(m)) present.add(t)
    const order = [...(league ? catalogTabs(league) : []), ...TAB_ORDER]
    const list = order.filter((t, i) => present.has(t) && order.indexOf(t) === i)
    for (const t of present) if (!list.includes(t)) list.push(t)
    if (!list.includes('Popular')) list.unshift('Popular')
    return list
  }, [d.markets, league])
  const [tab, setTab] = useState<string>('Same Game Parlay™')
  useEffect(() => {
    if (tabs.length && !tabs.includes(tab)) setTab(tabs[0])
  }, [tabs, tab])
  useEffect(() => {
    if (d.fanduel) d.loadFanDuelTab(tab)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, d.fanduel, d.loadFanDuelTab])
  const sgp = useMemo(() => (ev && league ? buildPopularSgp(ev, league) : null), [ev, league])

  if (d.error || (!d.loading && !ev)) {
    return (
      <Card className="mt-3">
        <EmptyState title="Event unavailable" body="This event could not be loaded. It may have already ended." />
      </Card>
    )
  }
  if (!ev || !league) {
    return (
      <div className="p-4 space-y-3">
        <div className="skeleton h-6 w-2/3" />
        <div className="skeleton h-[90px]" />
        <div className="skeleton h-11" />
        <div className="skeleton h-[200px]" />
      </div>
    )
  }
  const isLive = ev.status.state === 'in'
  const isFinal = ev.status.state === 'post'
  const sportName = SPORT_BY_ID[league.sport]?.name ?? league.sport
  const title = `${ev.away.team.displayName} @ ${ev.home.team.displayName} Odds`
  const visible = d.markets.filter((m) => tabFor(m).includes(tab))
  const gameLineMarkets = d.markets.filter((m) => m.group === 'game')
  const otherVisible = visible.filter((m) => m.group !== 'game')
  const grouped = groupByCategory(otherVisible, tab)

  return (
    <div>
      {desktop ? (
        <div className="px-0 pt-1 pb-2">
          <div className="text-[13px]" style={{ color: 'var(--fd-fg-3)' }}>
            <Link to={`/navigation/${league.sport}`}>{sportName}</Link> / <Link to={`/navigation/${league.id}`}>{league.name} Odds</Link> / <span style={{ color: 'var(--fd-fg-2)' }}>{title}</span>
          </div>
          <h1 className="text-[20px] font-bold mt-1" style={{ color: 'var(--fd-fg)' }}>
            {title}
          </h1>
        </div>
      ) : null}
      <div className="flex items-center justify-center gap-8 py-3 px-4" style={{ background: 'var(--fd-bg)' }}>
        <div className="flex flex-col items-center w-24">
          <TeamLogo team={ev.away.team} size={44} round={!!league.athleteEvent} />
          <span className="text-[14px] font-bold mt-1.5" style={{ color: 'var(--fd-fg)' }}>
            {league.athleteEvent ? ev.away.team.shortDisplayName : ev.away.team.abbreviation}
          </span>
          {ev.away.team.record ? (
            <span className="text-[11px]" style={{ color: 'var(--fd-fg-3)' }}>
              {ev.away.team.record}
            </span>
          ) : null}
        </div>
        <div className="flex flex-col items-center min-w-[120px]">
          {isLive || isFinal ? (
            <>
              <div className="flex items-center gap-4 text-[30px] font-bold tabular" style={{ color: 'var(--fd-fg)' }}>
                <span style={{ color: isFinal && ev.away.winner === false ? 'var(--fd-fg-3)' : undefined }}>{ev.away.score}</span>
                <span className="text-[16px]" style={{ color: 'var(--fd-fg-3)' }}>
                  -
                </span>
                <span style={{ color: isFinal && ev.home.winner === false ? 'var(--fd-fg-3)' : undefined }}>{ev.home.score}</span>
              </div>
              <div className="mt-1">
                {isLive ? (
                  <LiveStatus ev={ev} league={league} />
                ) : (
                  <span className="cond text-[12px] font-bold" style={{ color: 'var(--fd-fg-3)' }}>
                    FINAL
                  </span>
                )}
              </div>
              {ev.situation?.downDistanceText && isLive ? (
                <div className="text-[11px] mt-1" style={{ color: 'var(--fd-fg-2)' }}>
                  {ev.situation.downDistanceText}
                </div>
              ) : null}
            </>
          ) : (
            <>
              <span className="text-[14px] font-bold" style={{ color: 'var(--fd-fg)' }}>
                {formatDateShort(ev.date)}
              </span>
              <span className="text-[12px] mt-0.5" style={{ color: 'var(--fd-fg-2)' }}>
                {formatTime(ev.date)}
              </span>
              {ev.venue ? (
                <span className="text-[11px] mt-0.5 text-center" style={{ color: 'var(--fd-fg-3)' }}>
                  {ev.venue}
                </span>
              ) : null}
            </>
          )}
        </div>
        <div className="flex flex-col items-center w-24">
          <TeamLogo team={ev.home.team} size={44} round={!!league.athleteEvent} />
          <span className="text-[14px] font-bold mt-1.5" style={{ color: 'var(--fd-fg)' }}>
            {league.athleteEvent ? ev.home.team.shortDisplayName : ev.home.team.abbreviation}
          </span>
          {ev.home.team.record ? (
            <span className="text-[11px]" style={{ color: 'var(--fd-fg-3)' }}>
              {ev.home.team.record}
            </span>
          ) : null}
        </div>
      </div>
      {!isLive && !isFinal ? <PromoCarousel /> : null}

      {isFinal ? (
        <Card>
          <EmptyState title="This event has ended" body="Check My Bets for any settled wagers on this game." />
        </Card>
      ) : (
        <>
          {!isLive ? <TextTabs tabs={tabs.map((t) => ({ id: t, label: t }))} active={tab} onSelect={setTab} /> : null}
          <div className="mt-3">
            {tab === 'Same Game Parlay™' && sgp && !isLive ? (
              <Card>
                <SectionHeader
                  title={
                    <span className="flex items-center gap-2">
                      <SgpBadge small /> Popular Same Game Parlay™ Bets
                    </span>
                  }
                  size="sm"
                />
                <div className="p-4 pb-2" style={{ background: 'var(--fd-bg)' }}>
                  <PopularSgpCard sgp={sgp} showTeams={false} />
                </div>
                <ParlayHubLink />
              </Card>
            ) : null}

            {(tab === 'Popular' || tab === 'Same Game Parlay™' || isLive) && gameLineMarkets.length ? (
              <Card>
                <SectionHeader title={isLive ? 'Live Game Lines' : 'Game Lines'} right={<span className="flex items-center gap-2">{d.lines?.provider === 'FanDuel' ? <span className="cond text-[10px] font-bold px-1.5 rounded-[3px]" style={{ background: '#1493ff', color: '#fff', lineHeight: '16px' }}>FANDUEL ODDS</span> : null}{!league.athleteEvent && !isLive ? <SgpBadge small /> : null}</span>} />
                <GameLinesCoupon markets={gameLineMarkets} ev={ev} league={league} has={has} toggle={toggle} />
              </Card>
            ) : null}

            {grouped.map(([cat, ms]) => (
              <div key={cat}>
                {grouped.length > 1 ? (
                  <div className="cond text-[12px] font-bold px-1 pt-2 pb-1.5" style={{ color: 'var(--fd-fg-3)', letterSpacing: 1 }}>
                    {cat}
                  </div>
                ) : null}
                {ms.map((m, i) => (
                  <MarketAccordion key={m.id} ev={ev} market={m} defaultOpen={m.tabs?.length ? m.group !== 'alt' : i === 0 && (tab === 'Popular' || tab === 'Quick Bets' || ms.length <= 2)} />
                ))}
              </div>
            ))}

            {d.fdLoadingTab === tab ? (
              <div className="text-[12px] px-1 pb-2" style={{ color: 'var(--fd-fg-3)' }}>
                Loading FanDuel prices…
              </div>
            ) : null}
            {d.propsLoading && !otherVisible.length ? (
              <div className="space-y-2">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="skeleton h-11" />
                ))}
              </div>
            ) : null}
            {!d.propsLoading && !visible.length ? (
              <Card>
                <EmptyState title="No markets available" body={isLive ? 'Live markets will return shortly.' : 'Try another tab.'} />
              </Card>
            ) : null}
          </div>
        </>
      )}
    </div>
  )
}

function groupByCategory(markets: Market[], tab: string): [string, Market[]][] {
  const out = new Map<string, Market[]>()
  for (const m of markets) {
    let key = m.category ?? m.name
    if (m.tabs?.length) key = (m.group === 'props' || m.kind === 'prop_ladder') && m.category ? m.category : m.name
    else if (m.group === 'props' || m.kind === 'prop_ladder') key = m.category ?? 'Props'
    else if (m.group === 'td') key = m.name
    else if (tab === 'Same Game Parlay™' || tab === 'Popular') key = m.group === 'periods' ? (m.category ?? 'Periods') : m.group === 'alt' ? 'Alternates' : m.group === 'team' ? 'Team Totals' : m.group === 'specials' ? 'Game Specials' : (m.category ?? m.name)
    ;(out.get(key) ?? out.set(key, []).get(key)!).push(m)
  }
  for (const [, ms] of out) ms.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  // the group named after the tab (e.g. "Receiving Props") leads; shared markets like Rushing + Receiving follow
  return [...out.entries()].sort((a, b) => Number(b[0] === tab) - Number(a[0] === tab))
}

function GameLinesCoupon({ markets, ev, league, has, toggle }: { markets: Market[]; ev: NonNullable<ReturnType<typeof useEventDetail>['event']>; league: NonNullable<ReturnType<typeof useEventDetail>['league']>; has: (id: string) => boolean; toggle: ReturnType<typeof useSlip>['toggle'] }) {
  const spread = markets.find((m) => m.kind === 'spread')
  const ml = markets.find((m) => m.kind === 'moneyline' || m.kind === 'three_way')
  const total = markets.find((m) => m.kind === 'total')
  const dnb = markets.find((m) => m.kind === 'draw_no_bet')
  const cols = [spread ? spreadLabel(league).toUpperCase() : null, ml ? 'MONEY' : null, total ? totalLabel(league).toUpperCase().replace('TOTAL ', 'TOTAL ') : null].filter(Boolean) as string[]
  const cell = (m: Market | undefined, side: string) => m?.selections.find((s) => s.grading.side === side)
  const row = (side: 'away' | 'home' | 'draw', comp: typeof ev.home | null) => (
    <div className="flex items-center gap-2 px-4 py-1.5">
      <div className="flex items-center gap-2 w-[120px] shrink-0">
        {comp ? <TeamLogo team={comp.team} size={22} round={!!league.athleteEvent} /> : <span className="w-[22px]" />}
        <span className="text-[13px] font-semibold truncate" style={{ color: 'var(--fd-fg)' }}>
          {comp ? comp.team.shortDisplayName : 'Draw'}
        </span>
      </div>
      <div className="flex-1 grid gap-2" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0,1fr))` }}>
        {spread ? (side === 'draw' ? <span /> : (() => { const s = cell(spread, side); return s ? <OddsButton line={formatLine(s.line ?? 0)} odds={s.odds} selected={has(s.id)} onClick={() => toggle(ev, spread, s)} /> : <span /> })()) : null}
        {ml ? (() => { const s = cell(ml, side); return s ? <OddsButton odds={s.odds} selected={has(s.id)} onClick={() => toggle(ev, ml, s)} /> : <span /> })() : null}
        {total ? (side === 'draw' ? <span /> : (() => { const s = cell(total, side === 'away' ? 'over' : 'under'); return s ? <OddsButton line={`${side === 'away' ? 'O' : 'U'} ${s.line}`} odds={s.odds} selected={has(s.id)} onClick={() => toggle(ev, total, s)} /> : <span /> })()) : null}
      </div>
    </div>
  )
  return (
    <div className="pb-2">
      <div className="flex items-center gap-2 px-4 h-8">
        <span className="w-[120px] shrink-0" />
        <div className="cond flex-1 grid text-[11px] font-semibold text-center" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0,1fr))`, color: 'var(--fd-fg-3)', letterSpacing: 1 }}>
          {cols.map((c) => (
            <span key={c}>{c}</span>
          ))}
        </div>
      </div>
      {row('away', ev.away)}
      {row('home', ev.home)}
      {ml?.kind === 'three_way' ? row('draw', null) : null}
      {dnb ? (
        <div className="px-4 pt-2">
          <div className="cond text-[11px] font-semibold mb-1.5" style={{ color: 'var(--fd-fg-3)', letterSpacing: 1 }}>
            DRAW NO BET
          </div>
          <MarketBody ev={ev} market={dnb} />
        </div>
      ) : null}
    </div>
  )
}
