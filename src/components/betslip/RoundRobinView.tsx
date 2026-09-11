import { usePlaceBet } from '@/hooks/usePlaceBet'
import { analyzeSlip, roundRobinInfo } from '@/lib/bets'
import { formatStartTime } from '@/lib/format'
import { formatOdds, round2 } from '@/lib/odds'
import { useBetslip } from '@/store/betslip'
import { useSettings } from '@/store/settings'
import { CheckIcon, SgpBadge } from '../Icons'
import { CashOutTag } from './SelectionCard'
import { WagerInput } from './WagerInput'

export function RoundRobinView() {
  const slip = useBetslip()
  const fmt = useSettings((s) => s.oddsFormat)
  const { plan } = usePlaceBet()
  const a = plan.analysis
  const full = analyzeSlip(slip.selections)
  return (
    <div>
      {slip.selections.map((s) => {
        const disabled = !!slip.rrDisabled[s.selection.id]
        return (
          <div key={s.selection.id} className="flex items-start gap-3 px-4 py-3 border-b" style={{ borderColor: 'var(--fd-line)', background: 'var(--fd-surface)' }}>
            <button onClick={() => slip.toggleRrSelection(s.selection.id)} aria-label="Include" className="mt-0.5 w-5 h-5 rounded flex items-center justify-center shrink-0" style={{ background: disabled ? 'transparent' : '#2b90ff', border: `1.5px solid ${disabled ? 'var(--fd-fg-3)' : '#2b90ff'}` }}>
              {!disabled ? <CheckIcon size={14} color="#fff" /> : null}
            </button>
            <div className="flex-1 min-w-0" style={{ opacity: disabled ? 0.5 : 1 }}>
              <div className="flex justify-between gap-2">
                <span className="text-[15px] font-bold" style={{ color: 'var(--fd-fg)' }}>
                  {s.selection.label}
                </span>
                <span className="text-[15px] font-bold tabular">{formatOdds(s.selection.odds, fmt)}</span>
              </div>
              <div className="cond text-[11px]" style={{ color: 'var(--fd-fg-3)', letterSpacing: 0.6 }}>
                {s.selection.sub ?? s.market.name}
              </div>
              <div className="flex justify-between gap-2 mt-1 text-[12px]" style={{ color: 'var(--fd-fg-2)' }}>
                <span className="truncate">{s.event.name}</span>
                <span className="cond shrink-0" style={{ color: 'var(--fd-fg-3)' }}>
                  {formatStartTime(s.event.date)}
                </span>
              </div>
            </div>
          </div>
        )
      })}
      {a.rrSizes.map((size) => {
        const info = roundRobinInfo(a, size, slip.rrDisabled)
        if (!info.wagers) return null
        const stake = slip.rrStakes[size] ?? 0
        const win = round2(stake * info.wagers * (info.decimalAvg - 1))
        return (
          <div key={size} className="px-4 py-3 border-b" style={{ borderColor: 'var(--fd-line)', background: 'var(--fd-surface)' }}>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-[16px] font-bold" style={{ color: 'var(--fd-fg)' }}>
                By {size}'s x{info.wagers} wager{info.wagers > 1 ? 's' : ''} <CashOutTag />
              </span>
              <span className="text-[16px] font-bold tabular">{formatOdds(info.odds, fmt)}</span>
            </div>
            <div className="mt-3">
              <WagerInput stake={stake} onChange={(n) => slip.setRrStake(size, n)} toWin={win} />
            </div>
            {stake > 0 ? (
              <div className="text-[12px] mt-1.5" style={{ color: 'var(--fd-fg-3)' }}>
                Total wager {round2(stake * info.wagers).toFixed(2)} ({info.wagers} × ${stake.toFixed(2)})
              </div>
            ) : null}
          </div>
        )
      })}
      {full.canParlay ? (
        <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--fd-line)', background: 'var(--fd-surface)' }}>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[16px] font-bold" style={{ color: 'var(--fd-fg)' }}>
              {full.parlayType !== 'parlay' ? <SgpBadge plus={full.parlayType === 'sgp_plus'} /> : null}
              {full.legCount} leg {full.parlayType === 'sgp' ? 'Same Game Parlay' : full.parlayType === 'sgp_plus' ? 'Same Game Parlay+' : 'parlay'}
            </span>
            <span className="text-[16px] font-bold tabular">{formatOdds(full.parlayOdds, fmt)}</span>
          </div>
          <div className="mt-1">
            <CashOutTag />
          </div>
          <div className="mt-3">
            <WagerInput stake={slip.parlayStake} onChange={slip.setParlayStake} toWin={round2(slip.parlayStake * (full.parlayDecimal - 1))} />
          </div>
        </div>
      ) : null}
    </div>
  )
}
