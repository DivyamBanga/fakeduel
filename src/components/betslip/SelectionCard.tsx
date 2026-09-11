import { formatStartTime } from '@/lib/format'
import { formatOdds, toWin } from '@/lib/odds'
import { useBetslip, type SlipSelection } from '@/store/betslip'
import { useSettings } from '@/store/settings'
import { MinusCircle, SgpBadge } from '../Icons'
import { WagerInput } from './WagerInput'

export function CashOutTag() {
  return (
    <span className="cond inline-block rounded-[3px] px-1.5 text-[10px] font-bold" style={{ background: 'var(--fd-surface-3)', color: 'var(--fd-fg)', lineHeight: '16px', letterSpacing: 0.6 }}>
      CASH OUT
    </span>
  )
}

export function SelectionCard({ s, withInput, compact }: { s: SlipSelection; withInput?: boolean; compact?: boolean }) {
  const fmt = useSettings((x) => x.oddsFormat)
  const remove = useBetslip((x) => x.remove)
  const stake = useBetslip((x) => x.stakes[s.selection.id] ?? 0)
  const setStake = useBetslip((x) => x.setStake)
  const marketLabel = s.selection.sub ?? s.market.name
  return (
    <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--fd-line)', background: 'var(--fd-surface)' }}>
      <div className="flex items-start gap-2">
        {!compact ? (
          <button onClick={() => remove(s.selection.id)} aria-label="Remove" className="mt-0.5 shrink-0" style={{ color: '#d22839' }}>
            <MinusCircle size={18} />
          </button>
        ) : null}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="text-[15px] font-bold leading-tight" style={{ color: 'var(--fd-fg)' }}>
              {s.selection.label}
            </div>
            <div className="text-[15px] font-bold tabular shrink-0" style={{ color: 'var(--fd-fg)' }}>
              {formatOdds(s.selection.odds, fmt)}
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <div className="cond text-[11px] font-semibold truncate" style={{ color: 'var(--fd-fg-3)', letterSpacing: 0.6 }}>
              {marketLabel}
            </div>
            {!compact ? <CashOutTag /> : null}
          </div>
          {!compact ? (
            <div className="flex items-center justify-between gap-2 mt-1.5">
              <div className="text-[12px] truncate" style={{ color: 'var(--fd-fg-2)' }}>
                {s.event.name}
              </div>
              <div className="cond text-[11px] shrink-0" style={{ color: 'var(--fd-fg-3)', letterSpacing: 0.6 }}>
                {s.live ? 'LIVE' : formatStartTime(s.event.date)}
              </div>
            </div>
          ) : null}
        </div>
      </div>
      {withInput ? (
        <div className="mt-3">
          <WagerInput stake={stake} onChange={(n) => setStake(s.selection.id, n)} toWin={toWin(stake, s.selection.odds)} />
        </div>
      ) : null}
    </div>
  )
}

/** Same-game group as shown in the FanDuel betslip: event header + connected legs. */
export function SgpGroupCard({ legs, odds, children }: { legs: SlipSelection[]; odds: number; children?: React.ReactNode }) {
  const fmt = useSettings((x) => x.oddsFormat)
  const remove = useBetslip((x) => x.remove)
  const ev = legs[0].event
  return (
    <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--fd-line)', background: 'var(--fd-surface)' }}>
      <div className="flex items-start justify-between gap-2 pl-5">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <SgpBadge small />
            <span className="text-[13px] font-bold truncate" style={{ color: 'var(--fd-fg)' }}>
              {ev.name}
            </span>
          </div>
          <div className="cond text-[11px] mt-0.5" style={{ color: 'var(--fd-fg-3)', letterSpacing: 0.6 }}>
            {legs.length} SELECTIONS
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[15px] font-bold tabular" style={{ color: 'var(--fd-fg)' }}>
            {formatOdds(odds, fmt)}
          </div>
          <div className="cond text-[11px]" style={{ color: 'var(--fd-fg-3)', letterSpacing: 0.6 }}>
            {legs[0].live ? 'LIVE' : formatStartTime(ev.date)}
          </div>
        </div>
      </div>
      <div className="relative mt-2">
        <span className="absolute left-[8px] top-2 bottom-3 w-px" style={{ background: 'var(--fd-line)' }} />
        {legs.map((l) => (
          <div key={l.selection.id} className="flex items-start gap-2 py-1.5">
            <button onClick={() => remove(l.selection.id)} aria-label="Remove" className="relative z-10 shrink-0" style={{ color: '#d22839', background: 'var(--fd-surface)' }}>
              <MinusCircle size={18} />
            </button>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-bold leading-tight" style={{ color: 'var(--fd-fg)' }}>
                {l.selection.label}
              </div>
              <div className="cond text-[11px] font-semibold truncate" style={{ color: 'var(--fd-fg-3)', letterSpacing: 0.6 }}>
                {l.selection.sub ?? l.market.name}
              </div>
            </div>
          </div>
        ))}
      </div>
      {children}
    </div>
  )
}
