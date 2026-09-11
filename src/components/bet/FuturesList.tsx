import { useEffect, useState } from 'react'
import type { LeagueDef } from '@/data/sports'
import { futureToMarket } from '@/hooks/useFutures'
import { useSlip } from '@/hooks/useSlip'
import { formatOdds } from '@/lib/odds'
import type { Future } from '@/lib/types'
import { useSettings } from '@/store/settings'
import { ChevronDown, SgpBadge } from '../Icons'
import { Headshot, TeamLogo } from './TeamLogo'

export function FutureMarket({ future, league, defaultOpen, resolveNames, limit = 6 }: { future: Future; league: LeagueDef; defaultOpen?: boolean; resolveNames: (id: string) => Promise<void>; limit?: number }) {
  const [open, setOpen] = useState(!!defaultOpen)
  const [showAll, setShowAll] = useState(false)
  const fmt = useSettings((s) => s.oddsFormat)
  const { has, toggle } = useSlip()
  useEffect(() => {
    if (open) resolveNames(future.id)
  }, [open, future.id, resolveNames])
  const { event, market } = futureToMarket(future, league)
  const entries = market.selections
  const visible = showAll ? entries : entries.slice(0, limit)
  const unresolved = open && entries.length === 0 && future.entries.length > 0
  return (
    <section className="border-b" style={{ borderColor: 'var(--fd-line)', background: 'var(--fd-surface)' }}>
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between h-11 px-4">
        <span className={`${open ? 'text-[14px] font-bold' : 'text-[16px]'} truncate`} style={{ color: 'var(--fd-fg)' }}>
          {future.name}
        </span>
        <ChevronDown size={18} color="var(--fd-link)" className={open ? 'rotate-180' : ''} />
      </button>
      {open ? (
        <div style={{ background: 'var(--fd-bg)' }}>
          {unresolved ? (
            <div className="p-4 space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-10" />
              ))}
            </div>
          ) : null}
          {visible.map((s) => {
            const e = future.entries.find((x) => `${event.id}|futures|${x.id}` === s.id)
            return (
              <div key={s.id} className="flex items-center justify-between h-[52px] px-4 border-b" style={{ borderColor: 'var(--fd-line-2)', background: 'var(--fd-surface)' }}>
                <div className="flex items-center gap-2 min-w-0">
                  {e?.teamId ? <TeamLogo team={{ id: e.teamId, abbreviation: s.label.slice(0, 3), name: s.label, displayName: s.label, shortDisplayName: s.label, logo: e.logo }} size={24} /> : <Headshot src={e?.logo} name={s.label} size={26} />}
                  <span className="text-[14px] truncate" style={{ color: 'var(--fd-fg)' }}>
                    {s.label}
                  </span>
                </div>
                <button
                  onClick={() => toggle(event, market, s)}
                  className="h-[38px] w-[60px] shrink-0 rounded border flex items-center justify-center text-[12px] font-bold tracking-[0.5px]"
                  style={{ borderColor: has(s.id) ? '#2b90ff' : 'var(--fd-odds-border)', background: has(s.id) ? '#2b90ff' : 'var(--fd-odds-bg)', color: has(s.id) ? '#eaf0f6' : 'var(--fd-link)' }}
                >
                  {formatOdds(s.odds, fmt)}
                </button>
              </div>
            )
          })}
          {entries.length > limit ? (
            <div className="flex items-center justify-between h-10 px-4" style={{ background: 'var(--fd-surface)' }}>
              <span className="flex items-center gap-2">
                <SgpBadge small />
                <span className="cond text-[11px] font-semibold" style={{ color: 'var(--fd-fg-2)', letterSpacing: 0.8 }}>
                  FUTURES
                </span>
              </span>
              <button onClick={() => setShowAll((v) => !v)} className="flex items-center gap-1 text-[14px]" style={{ color: 'var(--fd-link)' }}>
                {showAll ? 'Show less' : 'Show more'} <ChevronDown size={16} className={showAll ? 'rotate-180' : ''} />
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
