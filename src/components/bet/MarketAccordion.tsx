import { useState } from 'react'
import { useSlip } from '@/hooks/useSlip'
import { formatOdds } from '@/lib/odds'
import type { GameEvent, Market, Selection } from '@/lib/types'
import { useSettings } from '@/store/settings'
import { ChevronDown, PlusCircle, SgpBadge } from '../Icons'
import { OddsButton } from './OddsButton'
import { Headshot } from './TeamLogo'

function ListRow({ s, selected, onClick, showSub }: { s: Selection; selected: boolean; onClick: () => void; showSub?: boolean }) {
  const fmt = useSettings((x) => x.oddsFormat)
  return (
    <div className="flex items-center justify-between h-[52px] px-4 border-b" style={{ borderColor: 'var(--fd-line-2)' }}>
      <div className="min-w-0 pr-3">
        <div className="text-[14px] truncate" style={{ color: 'var(--fd-fg)' }}>
          {s.label}
        </div>
        {showSub && s.sub ? (
          <div className="cond text-[11px] truncate" style={{ color: 'var(--fd-fg-3)' }}>
            {s.sub}
          </div>
        ) : null}
      </div>
      <button
        onClick={onClick}
        className="h-[38px] w-[72px] shrink-0 rounded border flex items-center justify-center text-[12px] font-bold tracking-[0.5px]"
        style={{ borderColor: selected ? '#2b90ff' : 'var(--fd-odds-border)', background: selected ? '#2b90ff' : 'var(--fd-odds-bg)', color: selected ? '#eaf0f6' : 'var(--fd-link)' }}
      >
        {formatOdds(s.odds, fmt)}
      </button>
    </div>
  )
}

export function MarketBody({ ev, market }: { ev: GameEvent; market: Market }) {
  const { has, toggle } = useSlip()
  const [showAll, setShowAll] = useState(false)
  const sels = market.selections
  if (market.layout === 'two-col' || market.layout === 'three-col') {
    return (
      <div className="px-4 py-3">
        {market.playerName && market.headshot ? (
          <div className="flex items-center gap-2 mb-2">
            <Headshot src={market.headshot} name={market.playerName} size={28} />
            <span className="text-[13px]" style={{ color: 'var(--fd-fg-2)' }}>
              {market.playerName}
              {market.playerPosition ? ` · ${market.playerPosition}` : ''}
            </span>
          </div>
        ) : null}
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${market.layout === 'three-col' ? 3 : 2}, minmax(0, 1fr))` }}>
          {sels.map((s) => (
            <OddsButton key={s.id} label={s.label} odds={s.odds} selected={has(s.id)} onClick={() => toggle(ev, market, s)} height={52} />
          ))}
        </div>
      </div>
    )
  }
  if (market.layout === 'grid') {
    const pairs: Selection[][] = []
    for (let i = 0; i < sels.length; i += 2) pairs.push(sels.slice(i, i + 2))
    const visible = showAll ? pairs : pairs.slice(0, 6)
    return (
      <div>
        <div className="grid grid-cols-2">
          {visible.map((pair, i) => (
            <div key={i} className="contents">
              {pair.map((s) => (
                <div key={s.id} className={i % 2 === 0 ? '' : ''}>
                  <ListRow s={s} selected={has(s.id)} onClick={() => toggle(ev, market, s)} />
                </div>
              ))}
            </div>
          ))}
        </div>
        {pairs.length > 6 ? (
          <button onClick={() => setShowAll((v) => !v)} className="w-full h-10 flex items-center justify-center gap-1 text-[14px]" style={{ color: 'var(--fd-link)' }}>
            {showAll ? 'Show less' : 'Show more'} <ChevronDown size={16} className={showAll ? 'rotate-180' : ''} />
          </button>
        ) : null}
      </div>
    )
  }
  // list / ladder
  const visible = showAll ? sels : sels.slice(0, 8)
  return (
    <div>
      {visible.map((s) => (
        <ListRow key={s.id} s={s} selected={has(s.id)} onClick={() => toggle(ev, market, s)} showSub={market.kind === 'prop_yesno'} />
      ))}
      {sels.length > 8 ? (
        <button onClick={() => setShowAll((v) => !v)} className="w-full h-10 flex items-center justify-center gap-1 text-[14px]" style={{ color: 'var(--fd-link)' }}>
          {showAll ? 'Show less' : 'Show more'} <ChevronDown size={16} className={showAll ? 'rotate-180' : ''} />
        </button>
      ) : null}
    </div>
  )
}

export function MarketAccordion({ ev, market, defaultOpen = false, title }: { ev: GameEvent; market: Market; defaultOpen?: boolean; title?: string }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="rounded-md overflow-hidden mb-2" style={{ background: 'var(--fd-surface)' }}>
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between h-11 px-4 text-left">
        <span className="text-[15px] font-bold truncate" style={{ color: 'var(--fd-fg)' }}>
          {title ?? market.name}
        </span>
        <span className="flex items-center gap-2 shrink-0" style={{ color: 'var(--fd-link)' }}>
          {market.kind === 'scorer' || market.kind === 'prop_ladder' ? <PlusCircle size={18} /> : null}
          {market.sgp ? <SgpBadge small /> : null}
          <ChevronDown size={18} strokeWidth={2} className={open ? 'rotate-180' : ''} />
        </span>
      </button>
      {open ? <MarketBody ev={ev} market={market} /> : null}
    </section>
  )
}
