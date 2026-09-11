import { Link } from 'react-router-dom'
import { formatDateTime } from '@/lib/format'
import { formatMoney, formatOdds } from '@/lib/odds'
import { useAccount } from '@/store/account'
import { useBetslip } from '@/store/betslip'
import { useSettings } from '@/store/settings'
import { CheckIcon, CloseIcon, SgpBadge } from '../Icons'

export function Receipt({ onClose, sheet }: { onClose?: () => void; sheet?: boolean }) {
  const receipt = useBetslip((s) => s.lastReceipt)
  const setReceipt = useBetslip((s) => s.setReceipt)
  const bets = useAccount((s) => s.bets.filter((b) => receipt?.betIds.includes(b.id)))
  const fmt = useSettings((s) => s.oddsFormat)
  const done = () => {
    setReceipt(null)
    onClose?.()
  }
  return (
    <div className="flex flex-col h-full min-h-0" style={{ background: 'var(--fd-bg)' }}>
      <div className="flex items-center h-[55px] px-4 border-b shrink-0" style={{ background: 'var(--fd-surface)', borderColor: 'var(--fd-line)' }}>
        <span className="text-[16px] font-bold" style={{ color: 'var(--fd-fg-2)' }}>
          Betslip
        </span>
        {sheet ? (
          <button onClick={done} aria-label="Close" className="ml-auto w-9 h-9 flex items-center justify-center">
            <CloseIcon size={22} />
          </button>
        ) : null}
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col items-center py-6 px-4 text-center fade-in">
          <span className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: '#128000' }}>
            <CheckIcon size={30} color="#fff" strokeWidth={2.6} />
          </span>
          <div className="text-[20px] font-bold mt-3" style={{ color: 'var(--fd-fg)' }}>
            Bet{bets.length > 1 ? 's' : ''} placed!
          </div>
          <div className="text-[13px] mt-1" style={{ color: 'var(--fd-fg-3)' }}>
            {receipt ? formatDateTime(new Date(receipt.at).toISOString()) : ''}
          </div>
        </div>
        {bets.map((b) => (
          <div key={b.id} className="mx-3 mb-3 rounded-md overflow-hidden border" style={{ borderColor: 'var(--fd-line)', background: 'var(--fd-surface)' }}>
            <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--fd-line)' }}>
              <div className="flex items-start justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[15px] font-bold" style={{ color: 'var(--fd-fg)' }}>
                  {b.type === 'sgp' || b.type === 'sgp_plus' ? <SgpBadge plus={b.type === 'sgp_plus'} small /> : null}
                  {b.title}
                </span>
                <span className="text-[15px] font-bold tabular">{formatOdds(b.odds, fmt)}</span>
              </div>
              {b.legs.length > 1 ? (
                <ul className="mt-2 space-y-1">
                  {b.legs.map((l) => (
                    <li key={l.selectionId} className="text-[13px]" style={{ color: 'var(--fd-fg-2)' }}>
                      <span className="font-semibold" style={{ color: 'var(--fd-fg)' }}>
                        {l.selectionLabel}
                      </span>{' '}
                      <span className="cond text-[11px]" style={{ color: 'var(--fd-fg-3)' }}>
                        {l.marketName}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="cond text-[11px] mt-0.5" style={{ color: 'var(--fd-fg-3)', letterSpacing: 0.6 }}>
                  {b.legs[0].marketName} · {b.legs[0].eventName}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 px-4 py-3 text-[13px]" style={{ color: 'var(--fd-fg-2)' }}>
              <div>
                <div className="cond text-[10px]" style={{ color: 'var(--fd-fg-3)', letterSpacing: 1 }}>
                  WAGER
                </div>
                <div className="text-[15px] font-semibold tabular" style={{ color: 'var(--fd-fg)' }}>
                  {formatMoney(b.stake * (b.rrCombos ?? 1))}
                </div>
              </div>
              <div>
                <div className="cond text-[10px]" style={{ color: 'var(--fd-fg-3)', letterSpacing: 1 }}>
                  TO WIN
                </div>
                <div className="text-[15px] font-semibold tabular" style={{ color: 'var(--fd-fg)' }}>
                  {formatMoney(b.toWin)}
                </div>
              </div>
              <div className="col-span-2 text-[11px] mt-2" style={{ color: 'var(--fd-fg-3)' }}>
                Bet ID {b.betId}
                {b.boostPct ? ` · ${b.boostPct}% Profit Boost` : ''}
                {b.noSweat ? ' · No Sweat Bet' : ''}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="p-2 shrink-0 space-y-2" style={{ background: 'var(--fd-surface)' }}>
        <Link to="/my-bets" onClick={done} className="flex items-center justify-center h-[44px] rounded border text-[15px] font-semibold" style={{ borderColor: '#ced4db', color: 'var(--fd-fg)' }}>
          View My Bets
        </Link>
        <button onClick={done} className="w-full h-[50px] rounded text-[16px] font-semibold text-white" style={{ background: '#128000' }}>
          Done
        </button>
      </div>
    </div>
  )
}
