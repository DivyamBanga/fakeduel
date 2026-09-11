import { Fragment, useMemo } from 'react'
import type { LeagueDef } from '@/data/sports'
import { LEAGUE_BY_ID } from '@/data/sports'
import { formatDayLabel } from '@/lib/format'
import { spreadLabel } from '@/lib/markets'
import type { GameEvent } from '@/lib/types'
import { EventRow } from './EventRow'
import { EmptyState } from '../shell/SectionHeader'

export function ColumnHeader({ league, label }: { league: LeagueDef; label: string }) {
  const athlete = !!league.athleteEvent
  return (
    <div className="flex items-center h-9 px-4 border-b" style={{ background: 'var(--fd-surface-2)', borderColor: 'var(--fd-line-2)' }}>
      <div className="flex-1 text-[12px] font-bold" style={{ color: 'var(--fd-fg-2)' }}>
        {label}
      </div>
      <div className="cond flex text-[11px] font-semibold tracking-[0.08em]" style={{ color: 'var(--fd-fg-3)', width: athlete ? 147 : undefined }}>
        {athlete ? (
          <span className="w-full text-center">MONEY</span>
        ) : (
          <>
            <span className="w-[147px] text-center hidden lg:block">{spreadLabel(league).toUpperCase()}</span>
            <span className="w-[147px] text-center hidden lg:block">MONEY</span>
            <span className="w-[147px] text-center hidden lg:block">TOTAL</span>
          </>
        )}
      </div>
      {!athlete ? (
        <div className="cond flex lg:hidden text-[11px] font-semibold tracking-[0.06em]" style={{ color: 'var(--fd-fg-3)', width: '66%' }}>
          <span className="flex-1 text-center">{spreadLabel(league).toUpperCase()}</span>
          <span className="flex-1 text-center">MONEY</span>
          <span className="flex-1 text-center">TOTAL</span>
        </div>
      ) : null}
    </div>
  )
}

export function EventList({ events, league, loading, groupByDay = true, limit, emptyText = 'No events available', showLeague }: { events: GameEvent[]; league?: LeagueDef; loading?: boolean; groupByDay?: boolean; limit?: number; emptyText?: string; showLeague?: boolean }) {
  const list = limit ? events.slice(0, limit) : events
  const groups = useMemo(() => {
    const out: { key: string; label: string; events: GameEvent[] }[] = []
    for (const e of list) {
      const key = e.status.state === 'in' ? 'live' : new Date(e.date).toDateString()
      const label = e.status.state === 'in' ? 'Live now' : formatDayLabel(e.date)
      let g = out.find((x) => x.key === key)
      if (!g) {
        g = { key, label, events: [] }
        out.push(g)
      }
      g.events.push(e)
    }
    return out
  }, [list])

  if (loading && !list.length) {
    return (
      <div className="p-4 space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-[120px]" />
        ))}
      </div>
    )
  }
  if (!list.length) return <EmptyState title={emptyText} body="Check back soon for more betting options." />

  return (
    <div>
      {groups.map((g) => {
        return (
          <Fragment key={g.key}>
            {(groupByDay && groups.length > 1) || g.key === 'live' ? (
              <div className="flex items-center h-10 px-4 text-[13px] font-bold border-b" style={{ background: 'var(--fd-surface)', borderColor: 'var(--fd-line-2)', color: 'var(--fd-fg-2)' }}>
                {g.key === 'live' ? (
                  <span className="flex items-center gap-2">
                    <span className="live-dot w-2 h-2 rounded-full" style={{ background: '#d22839' }} /> {g.label}
                  </span>
                ) : (
                  g.label
                )}
              </div>
            ) : null}
            {g.events.map((e) => {
              const l = league ?? LEAGUE_BY_ID[e.leagueId]
              if (!l) return null
              return <EventRow key={e.id} ev={e} league={l} showLeague={showLeague} />
            })}
          </Fragment>
        )
      })}
    </div>
  )
}
