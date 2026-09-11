import { usePlaceBet } from '@/hooks/usePlaceBet'
import { teaserLeg } from '@/lib/bets'
import { formatStartTime } from '@/lib/format'
import { formatOdds, round2, teaserOdds, teaserPoints, americanToDecimal } from '@/lib/odds'
import { useBetslip } from '@/store/betslip'
import { useSettings } from '@/store/settings'
import { WagerInput } from './WagerInput'

export function TeaserView() {
  const slip = useBetslip()
  const fmt = useSettings((s) => s.oddsFormat)
  const { plan } = usePlaceBet()
  const sport = plan.analysis.teaserSport
  if (!sport) {
    return (
      <div className="p-6 text-center text-[14px]" style={{ color: 'var(--fd-fg-2)' }}>
        Teasers need 2 or more spread or total selections from different {sport === null ? 'football or basketball ' : ''}games.
      </div>
    )
  }
  const pts = teaserPoints(sport)
  const points = pts.includes(slip.teaserPoints) ? slip.teaserPoints : pts[0]
  const odds = teaserOdds(sport, points, slip.selections.length)
  const legs = slip.selections.map((s) => teaserLeg(s, points))
  return (
    <div>
      <div className="flex items-center gap-2 px-4 h-[52px] border-b" style={{ borderColor: 'var(--fd-line)', background: 'var(--fd-surface)' }}>
        <span className="text-[13px] mr-1" style={{ color: 'var(--fd-fg-2)' }}>
          Points
        </span>
        {pts.map((p) => (
          <button key={p} onClick={() => slip.setTeaserPoints(p)} className="h-8 px-4 rounded-full text-[14px] font-semibold" style={{ background: p === points ? '#2b90ff' : 'transparent', color: p === points ? '#fff' : 'var(--fd-link)', border: p === points ? 'none' : '1px solid var(--fd-line)' }}>
            {p}
          </button>
        ))}
      </div>
      {legs.map((l, i) => (
        <div key={l.selectionId} className="px-4 py-3 border-b" style={{ borderColor: 'var(--fd-line)', background: 'var(--fd-surface)' }}>
          <div className="text-[15px] font-bold" style={{ color: 'var(--fd-fg)' }}>
            {l.selectionLabel}
          </div>
          <div className="cond text-[11px]" style={{ color: 'var(--fd-fg-3)', letterSpacing: 0.6 }}>
            {l.marketName} · was {slip.selections[i].selection.label}
          </div>
          <div className="flex justify-between gap-2 mt-1 text-[12px]" style={{ color: 'var(--fd-fg-2)' }}>
            <span className="truncate">{l.eventName}</span>
            <span className="cond shrink-0" style={{ color: 'var(--fd-fg-3)' }}>
              {formatStartTime(l.startTime)}
            </span>
          </div>
        </div>
      ))}
      <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--fd-line)', background: 'var(--fd-surface)' }}>
        <div className="flex items-center justify-between">
          <span className="text-[16px] font-bold" style={{ color: 'var(--fd-fg)' }}>
            {legs.length} leg {points}pt teaser
          </span>
          <span className="text-[16px] font-bold tabular">{odds !== undefined ? formatOdds(odds, fmt) : '—'}</span>
        </div>
        <div className="mt-3">
          <WagerInput stake={slip.teaserStake} onChange={slip.setTeaserStake} toWin={odds !== undefined ? round2(slip.teaserStake * (americanToDecimal(odds) - 1)) : 0} />
        </div>
      </div>
    </div>
  )
}
