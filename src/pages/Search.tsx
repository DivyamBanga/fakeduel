import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { TeamLogo } from '@/components/bet/TeamLogo'
import { SearchIcon, SportIcon } from '@/components/Icons'
import { Card, SectionHeader } from '@/components/shell/SectionHeader'
import { LEAGUES, LEAGUE_BY_ID, SPORTS } from '@/data/sports'
import { useLeagueEvents } from '@/hooks/useLeagueEvents'
import { eventPath } from '@/hooks/useSlip'
import { formatStartTime } from '@/lib/format'

const INDEX_LEAGUES = ['nfl', 'ncaaf', 'mlb', 'nba', 'nhl', 'wnba', 'epl', 'mls', 'ucl', 'laliga', 'ufc']
const TRENDING = ['NFL', 'Bills', 'Chiefs', 'Eagles', 'Premier League', 'MLB', 'UFC', 'Yankees', 'NBA']

export function SearchPage() {
  const [q, setQ] = useState('')
  const { events } = useLeagueEvents(INDEX_LEAGUES)
  const term = q.trim().toLowerCase()
  const results = useMemo(() => {
    if (!term) return { leagues: [], sports: [], events: [] }
    const leagues = LEAGUES.filter((l) => l.name.toLowerCase().includes(term) || l.longName.toLowerCase().includes(term)).slice(0, 6)
    const sports = SPORTS.filter((s) => s.name.toLowerCase().includes(term)).slice(0, 3)
    const evs = events.filter((e) => e.status.state !== 'post' && (e.name.toLowerCase().includes(term) || e.home.team.abbreviation.toLowerCase() === term || e.away.team.abbreviation.toLowerCase() === term)).slice(0, 20)
    return { leagues, sports, events: evs }
  }, [term, events])
  return (
    <div className="px-4 lg:px-0">
      <div className="flex items-center gap-2 h-12 px-3 mt-3 rounded-md border" style={{ borderColor: 'var(--fd-line)', background: 'var(--fd-input-bg)' }}>
        <SearchIcon size={20} color="var(--fd-fg-3)" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search teams, leagues, players" className="flex-1 bg-transparent outline-none text-[16px]" style={{ color: 'var(--fd-fg)' }} />
        {q ? (
          <button onClick={() => setQ('')} className="text-[13px]" style={{ color: 'var(--fd-link)' }}>
            Clear
          </button>
        ) : null}
      </div>
      {!term ? (
        <div className="mt-4">
          <div className="cond text-[12px] font-bold mb-2" style={{ color: 'var(--fd-fg-3)', letterSpacing: 1 }}>
            TRENDING SEARCHES
          </div>
          <div className="flex flex-wrap gap-2">
            {TRENDING.map((t) => (
              <button key={t} onClick={() => setQ(t)} className="h-9 px-4 rounded-full border text-[14px]" style={{ borderColor: 'var(--fd-line)', color: 'var(--fd-fg)' }}>
                {t}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-3">
          {results.sports.length || results.leagues.length ? (
            <Card>
              <SectionHeader title="Sports & leagues" size="sm" />
              {results.sports.map((s) => (
                <Link key={s.id} to={`/navigation/${s.id}`} className="flex items-center gap-3 h-12 px-4 border-b text-[15px]" style={{ borderColor: 'var(--fd-line-2)', color: 'var(--fd-fg)' }}>
                  <SportIcon id={s.icon} size={22} /> {s.name}
                </Link>
              ))}
              {results.leagues.map((l) => (
                <Link key={l.id} to={`/navigation/${l.id}`} className="flex items-center gap-3 h-12 px-4 border-b text-[15px]" style={{ borderColor: 'var(--fd-line-2)', color: 'var(--fd-fg)' }}>
                  <SportIcon id={l.icon} size={22} /> {l.longName}
                </Link>
              ))}
            </Card>
          ) : null}
          <Card>
            <SectionHeader title="Games" size="sm" />
            {results.events.length ? (
              results.events.map((e) => (
                <Link key={e.id} to={eventPath(e)} className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: 'var(--fd-line-2)' }}>
                  <span className="flex -space-x-1">
                    <TeamLogo team={e.away.team} size={24} />
                    <TeamLogo team={e.home.team} size={24} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-semibold truncate" style={{ color: 'var(--fd-fg)' }}>
                      {e.name}
                    </div>
                    <div className="cond text-[11px]" style={{ color: 'var(--fd-fg-3)', letterSpacing: 0.6 }}>
                      {LEAGUE_BY_ID[e.leagueId]?.name} · {e.status.state === 'in' ? 'LIVE' : formatStartTime(e.date)}
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="px-4 py-6 text-[14px] text-center" style={{ color: 'var(--fd-fg-3)' }}>
                No games match "{q}"
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
